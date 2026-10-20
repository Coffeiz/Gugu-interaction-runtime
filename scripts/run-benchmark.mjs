import { chromium } from '@playwright/test'
import { gzipSync } from 'node:zlib'
import { mkdir, writeFile } from 'node:fs/promises'
import { execFileSync, spawn } from 'node:child_process'
import { once } from 'node:events'
import { basename, resolve } from 'node:path'
import os from 'node:os'

const root = resolve(import.meta.dirname, '..')
const reportRoot = resolve(root, 'docs/reports')
const rawRoot = resolve(reportRoot, 'raw')
const args = new Map(process.argv.slice(2).map((value, index, all) => value.startsWith('--') ? [value.slice(2), all[index + 1]?.startsWith('--') ? '' : all[index + 1]] : null).filter(Boolean))
const scenarios = ['flat', 'flat-thumbnails', 'kanban', 'grouped', 'canvas']
const interactionsByScenario = {
  flat: ['same-list', 'regrab', 'multi-select'],
  'flat-thumbnails': ['same-list', 'regrab', 'multi-select'],
  kanban: ['same-list', 'cross-column', 'regrab', 'multi-select'],
  grouped: ['grouped', 'folded-context', 'regrab'],
  canvas: ['canvas-node', 'regrab'],
}
const allCounts = [50, 200, 500, 1000, 2000]
const scenarioFilter = args.get('scenario') || 'all'
const interactionFilter = args.get('interaction') || 'all'
const countFilter = args.get('count') || 'all'
const implementationFilter = args.get('implementation') || 'all'
const repetitions = Number(args.get('repetitions') || 5)
const throttleArgument = args.get('throttle') || 'all'
const throttles = throttleArgument === 'all' ? [1, 4, 6] : throttleArgument.split(',').map(Number)
const headed = args.has('headed')
const port = Number(args.get('port') || 5197)
const baseUrl = `http://127.0.0.1:${port}`
const runTag = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
const sourceRevision = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
const sourceDirty = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim().length > 0
const manifestPath = resolve(reportRoot, `run-${runTag}.json`)
const rows = []
const excluded = []
const attempts = []
const manifest = { schemaVersion: 3, runTag, startedAt: new Date().toISOString(), status: 'running', browserVersion: null, sourceRevision, sourceDirty, throttles, repetitions, headed, implementationFilter, excluded, attempts, rows: [] }
const persistManifest = () => writeFile(manifestPath, JSON.stringify(manifest, null, 2))

await mkdir(rawRoot, { recursive: true })
await persistManifest()
const server = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, stdio: 'inherit' })
let serverExit = null
server.once('exit', (code, signal) => { serverExit = { code, signal } })
try {
  await waitForServer(`${baseUrl}/benchmark`, () => serverExit)
  if (serverExit && serverExit.code !== 0) throw new Error(`Vite exited before the benchmark started: ${JSON.stringify(serverExit)}`)
  const browser = await chromium.launch({ headless: !headed })
  const browserVersion = browser.version()
  manifest.browserVersion = browserVersion
  await persistManifest()
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  for (const scenario of scenarios.filter(value => scenarioFilter === 'all' || scenarioFilter.split(',').includes(value))) {
    const counts = scenario === 'kanban' ? [800] : allCounts.filter(value => countFilter === 'all' || countFilter.split(',').map(Number).includes(value))
    for (const count of counts) {
      for (const interaction of interactionsByScenario[scenario].filter(value => interactionFilter === 'all' || interactionFilter.split(',').includes(value))) {
        for (const throttle of throttles) {
          await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle })
        // Interleave both implementations in the same page/context/browser session to reduce warm-cache bias.
        for (let repetition = 0; repetition < repetitions; repetition += 1) {
          const implementations = (repetition % 2 === 0 ? ['runtime', 'dnd-kit'] : ['dnd-kit', 'runtime'])
            .filter(value => implementationFilter === 'all' || implementationFilter.split(',').includes(value))
          for (const implementation of implementations) {
            if (interaction === 'regrab' && implementation === 'dnd-kit') {
              excluded.push({ scenario, count, interaction, implementation, throttle, repetition: repetition + 1, reason: 'regrab is a runtime-specific landing-proxy interaction without an equivalent dnd-kit behavior' })
              await persistManifest()
              continue
            }
            const sampleId = `${scenario}-${count}-${interaction}-${implementation}-cpu${throttle}-r${repetition + 1}`
            const attempt = { sampleId, scenario, count, interaction, implementation, throttle, repetition: repetition + 1, status: 'running', startedAt: new Date().toISOString() }
            attempts.push(attempt)
            await persistManifest()
            const url = new URL(`${baseUrl}/benchmark`)
            url.searchParams.set('scenario', scenario)
            url.searchParams.set('count', String(count))
            url.searchParams.set('interaction', interaction)
            url.searchParams.set('implementation', implementation)
            url.searchParams.set('run', sampleId)
            await page.goto(url.href)
            await page.locator('[data-benchmark-ready="true"]').waitFor()
            await page.waitForTimeout(500)
            await page.evaluate(() => { performance.clearResourceTimings(); performance.clearMeasures(); performance.clearMarks() })
            const traceEvents = []
            const onTrace = event => traceEvents.push(...event.value)
            cdp.on('Tracing.dataCollected', onTrace)
            await cdp.send('Tracing.start', {
              transferMode: 'ReportEvents',
              categories: 'devtools.timeline,disabled-by-default-devtools.timeline,blink.user_timing,v8',
            })
            let samples = []
            let failure = null
            try {
              samples = await runInteraction(page, cdp, interaction)
              const committedSample = samples.at(-1)
              if (!committedSample?.commit?.committed || committedSample.commit.objectIds.length === 0) {
                throw new Error('interaction did not produce a committed object move')
              }
            } catch (error) {
              failure = { message: String(error), diagnostics: await page.evaluate(() => ({
                status: document.querySelector('[data-benchmark-status]')?.textContent,
                proxies: document.querySelectorAll('[data-runtime-proxy="true"]').length,
                samples: window.__benchmark?.samples.length,
                actions: window.__benchmark?.actions,
              })) }
            }
            const sample = samples.at(-1)
            const traceComplete = once(cdp, 'Tracing.tracingComplete')
            await cdp.send('Tracing.end')
            await traceComplete
            cdp.off('Tracing.dataCollected', onTrace)
            const path = resolve(rawRoot, `${sampleId}-${runTag}.json.gz`)
            const trace = {
              traceEvents,
              metadata: {
                sampleId, scenario, count, interaction, implementation, browserVersion, throttle, runTag, sourceRevision, sourceDirty,
                host: { platform: process.platform, arch: process.arch, cpu: os.cpus()[0]?.model, cores: os.cpus().length, memoryGb: Number((os.totalmem() / 1024 ** 3).toFixed(1)) },
                node: process.version,
              },
              sample,
              samples,
              failure,
            }
            await writeFile(path, gzipSync(JSON.stringify(trace)))
            const manifestRow = { sampleId, path: path.slice(root.length + 1), sample, failure }
            rows.push(manifestRow)
            manifest.rows.push({ sampleId, path: manifestRow.path, status: failure ? 'failed' : 'succeeded', error: failure?.message ?? null })
            Object.assign(attempt, { status: failure ? 'failed' : 'succeeded', completedAt: new Date().toISOString(), trace: manifestRow.path, error: failure?.message ?? null })
            await persistManifest()
            process.stdout.write(`${sampleId} ${failure ? `FAILED ${failure.message}` : path}\n`)
            if (failure) throw new Error(`${sampleId} failed; trace saved to ${path}: ${JSON.stringify(failure.diagnostics)}`)
          }
        }
        }
      }
    }
  }

  manifest.status = 'completed'
  manifest.finishedAt = new Date().toISOString()
  await persistManifest()
  await context.close()
  await browser.close()
} catch (error) {
  manifest.status = 'failed'
  manifest.finishedAt = new Date().toISOString()
  manifest.error = String(error)
  const unfinishedAttempt = attempts.find(attempt => attempt.status === 'running')
  if (unfinishedAttempt) Object.assign(unfinishedAttempt, { status: 'failed', completedAt: manifest.finishedAt, error: String(error) })
  await persistManifest()
  throw error
} finally {
  server.kill('SIGTERM')
}

async function runInteraction(page, cdp, interaction) {
  const card = page.locator('.bench-card').first()
  const first = await card.boundingBox()
  if (!first) throw new Error('benchmark source card has no box')
  let start = { x: first.x + first.width / 2, y: first.y + first.height / 2 }
  let end = { x: start.x + 4, y: start.y + Math.max(44, first.height + 10) }
  if (interaction === 'cross-column') {
    const target = await page.locator('.bench-list').nth(1).boundingBox()
    if (!target) throw new Error('cross-column target not found')
    end = { x: target.x + target.width / 2, y: target.y + 100 }
  } else if (interaction === 'canvas-node') {
    end = { x: start.x + 90, y: start.y + 65 }
  } else if (interaction === 'multi-select') {
    const target = await page.locator('.bench-card').nth(Math.min(8, await page.locator('.bench-card').count() - 1)).boundingBox()
    if (!target) throw new Error('multi-select drop target not found')
    end = { x: target.x + target.width / 2, y: target.y + target.height / 2 }
  } else if (interaction === 'grouped' || interaction === 'folded-context') {
    // `grouped` is the uncollapsed baseline; only `folded-context` hides month 12.
    if (interaction === 'folded-context') {
      const folded = page.locator('.bench-month-title').nth(11)
      await folded.evaluate(element => element.click())
    }
    let targetGroup = page.locator('.bench-month').first()
    let targetCard = await targetGroup.locator('.bench-card').nth(1).boundingBox()
    if (!targetCard) {
      targetGroup = page.locator('.bench-month').nth(1)
      targetCard = await targetGroup.locator('.bench-card').first().boundingBox()
    }
    if (targetCard) end = { x: targetCard.x + targetCard.width / 2, y: targetCard.y + targetCard.height + 4 }
  }

  const refreshedSource = await card.boundingBox()
  if (!refreshedSource) throw new Error('source card disappeared after scenario setup')
  start = { x: refreshedSource.x + refreshedSource.width / 2, y: refreshedSource.y + refreshedSource.height / 2 }

  await page.evaluate(() => { window.__benchmark?.reset(); performance.clearMeasures(); performance.clearMarks() })
  if (interaction === 'regrab' && implementationFromUrl(page.url()) === 'dnd-kit') {
    const invalidDrop = { x: 12, y: 24 }
    await dispatchDrag(page, cdp, start, invalidDrop, false)
    await waitForPublishedSample(page, 1)
    const sourceAgain = await page.locator('.bench-card').nth(1).boundingBox()
    const targetAgain = await page.locator('.bench-card').nth(Math.min(9, await page.locator('.bench-card').count() - 1)).boundingBox()
    if (!sourceAgain || !targetAgain) throw new Error('could not locate second dnd-kit grab')
    await dispatchDrag(page, cdp, { x: sourceAgain.x + sourceAgain.width / 2, y: sourceAgain.y + sourceAgain.height / 2 }, { x: targetAgain.x + targetAgain.width / 2, y: targetAgain.y + targetAgain.height / 2 })
    await waitForPublishedSample(page, 2)
  } else if (interaction === 'regrab') {
    const invalidDrop = { x: 12, y: 24 }
    await dispatchDrag(page, cdp, start, invalidDrop, false)
    await page.waitForFunction(() => document.querySelector('[data-runtime-proxy="true"]') || document.querySelector('[data-benchmark-status]')?.textContent?.includes('second-drag'), null, { timeout: 30000 })
    let secondStart = start
    if (await page.locator('[data-runtime-proxy="true"]').count()) {
      const proxy = await page.locator('[data-runtime-proxy="true"]').first().boundingBox()
      if (proxy) secondStart = { x: proxy.x + proxy.width / 2, y: proxy.y + proxy.height / 2 }
    } else {
      await page.waitForFunction(() => document.querySelector('[data-benchmark-status]')?.textContent?.includes('second-drag'), null, { timeout: 30000 })
    }
    const secondTarget = await page.locator('.bench-card').nth(Math.min(8, await page.locator('.bench-card').count() - 1)).boundingBox()
    if (secondTarget) end = { x: secondTarget.x + secondTarget.width / 2, y: secondTarget.y + secondTarget.height / 2 }
    await dispatchDrag(page, cdp, secondStart, end)
  } else {
    await dispatchDrag(page, cdp, start, end)
  }
  await waitForPublishedSample(page, 1)
  return page.evaluate(() => [...window.__benchmark.samples])
}

async function waitForPublishedSample(page, count) {
  await page.waitForFunction(expected => window.__benchmark?.samples.length >= expected || document.querySelector('[data-benchmark-status]')?.textContent === 'settle-timeout', count, { timeout: 60000 })
  const status = await page.locator('[data-benchmark-status]').textContent()
  if (status === 'settle-timeout') throw new Error('settle timeout: sample discarded')
}

function implementationFromUrl(url) {
  return new URL(url).searchParams.get('implementation')
}

async function dispatchDrag(page, cdp, start, end, paced = true) {
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: start.x, y: start.y, button: 'none' })
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: start.x, y: start.y, button: 'left', buttons: 1, clickCount: 1 })
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: start.x + 4, y: start.y + 4, button: 'left', buttons: 1 })
  const steps = 12
  for (let step = 1; step <= steps; step += 1) {
    const progress = step / steps
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: start.x + (end.x - start.x) * progress, y: start.y + (end.y - start.y) * progress, button: 'left', buttons: 1 })
    if (paced) await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)))
  }
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: end.x, y: end.y, button: 'left', buttons: 0, clickCount: 1 })
}

async function waitForServer(url, getServerExit) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const exit = getServerExit()
    if (exit) throw new Error(`Vite process exited before serving ${url}: ${JSON.stringify(exit)}`)
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch { /* vite is still starting */ }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error(`Vite did not start: ${basename(url)}`)
}
