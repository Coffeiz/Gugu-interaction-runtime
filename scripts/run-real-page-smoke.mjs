import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { execFileSync, spawn } from 'node:child_process'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const sourceRevision = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
const sourceDirty = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim().length > 0
const guguRoot = resolve(process.env.GUGU_WEB_ROOT || resolve(root, '..', 'Gugu-web'))
const frontendRoot = resolve(guguRoot, 'frontend')
const port = Number(process.env.REAL_PAGE_PORT || 5198)
const baseUrl = `http://127.0.0.1:${port}`
const server = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: frontendRoot,
  env: { ...process.env, VITE_USE_LOCAL_RUNTIME: '1' },
  stdio: 'inherit',
})
let serverExit
server.once('exit', (code, signal) => { serverExit = { code, signal } })

try {
  await waitForServer(baseUrl)
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const errors = []
  const apiRequests = []
  const mockProjects = Array.from({ length: 80 }, (_, index) => ({
    id: index + 1,
    name: `真实看板项目 ${String(index + 1).padStart(3, '0')}`,
    client: `测试客户 ${index % 7 + 1}`,
    status: index % 3 === 0 ? 'active' : 'pending',
    startDate: '2026-01-01', deadline: '2026-12-31', color: '#6382d9', progress: index % 100,
    stages: [{ key: 'planning', label: '规划', todos: [{ id: 'todo-1', text: '需求确认与资料整理', done: false }] }],
    currentStage: 'planning', archived: false, version: 1, createdAt: '2026-01-01T00:00:00Z', fileCount: index % 5,
  }))
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    apiRequests.push({ method: request.method(), path: url.pathname })
    if (request.method() === 'PATCH' && /\/projects\/1$/.test(url.pathname)) {
      const payload = request.postDataJSON()
      const updated = { ...mockProjects[0], status: payload.status ?? 'pending', version: 2 }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(updated) })
      return
    }
    if (request.method() !== 'GET') {
      await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ detail: 'Unexpected write blocked by benchmark fixture' }) })
      return
    }
    let body = {}
    if (url.pathname.endsWith('/auth/me')) {
      body = { id: '00000000-0000-4000-8000-000000000001', username: 'benchmark', displayName: 'Benchmark User', email: 'benchmark@example.invalid', isActive: true, createdAt: '2026-01-01T00:00:00Z', imChannels: [], emailSubscribed: false, timezone: 'UTC' }
    } else if (url.pathname.endsWith('/projects/file-counts')) {
      body = []
    } else if (url.pathname.endsWith('/projects')) {
      body = mockProjects
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })

  const startedAt = Date.now()
  await page.goto(`${baseUrl}/projects`)
  await page.locator('.proj-card').first().waitFor({ state: 'visible', timeout: 60000 })
  await page.waitForTimeout(1200)
  const source = page.locator('.proj-card').filter({ hasText: '真实看板项目 001' }).first()
  const target = page.locator('.proj-card').filter({ hasText: '真实看板项目 002' }).first()
  const sourceColumn = source.locator('xpath=ancestor::*[@data-col-status][1]')
  const targetColumn = target.locator('xpath=ancestor::*[@data-col-status][1]')
  const sourceSurface = await sourceColumn.getAttribute('data-col-status')
  const targetSurface = await targetColumn.getAttribute('data-col-status')
  if (!sourceSurface || !targetSurface || sourceSurface === targetSurface) throw new Error(`Expected cross-column test cards; got ${sourceSurface} and ${targetSurface}`)
  const sourceDraggable = await source.getAttribute('data-runtime-draggable')
  const pointerEvents = []
  await page.evaluate(() => {
    window.__benchmarkPointerEvents = []
    for (const type of ['pointerdown', 'pointermove', 'pointerup']) {
      document.addEventListener(type, event => window.__benchmarkPointerEvents.push({ type, x: event.clientX, y: event.clientY, target: event.target?.closest?.('.proj-card')?.getAttribute('data-project-id') ?? null }), true)
    }
  })
  const sourceBox = await source.boundingBox()
  const targetBox = await target.boundingBox()
  if (!sourceBox || !targetBox) throw new Error('Real project card bounding boxes are unavailable')
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
  await page.mouse.down()
  for (let step = 1; step <= 12; step += 1) {
    const progress = step / 12
    await page.mouse.move(sourceBox.x + sourceBox.width / 2 + (targetBox.x + targetBox.width / 2 - sourceBox.x - sourceBox.width / 2) * progress,
      sourceBox.y + sourceBox.height / 2 + (targetBox.y + targetBox.height / 2 - sourceBox.y - sourceBox.height / 2) * progress,
      { steps: 1 })
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)))
  }
  await page.mouse.up()
  await page.waitForTimeout(1200)
  pointerEvents.push(...await page.evaluate(() => window.__benchmarkPointerEvents))
  const cardOne = page.locator('.proj-card[data-project-id="1"]')
  await cardOne.waitFor({ state: 'attached', timeout: 10000 })
  const committedSurface = await cardOne.locator('xpath=ancestor::*[@data-col-status][1]').getAttribute('data-col-status')
  const mutationRequests = apiRequests.filter(request => request.method !== 'GET')
  if (committedSurface !== targetSurface || mutationRequests.length !== 1 || mutationRequests[0].method !== 'PATCH') {
    throw new Error(`Real cross-column drag did not commit: ${sourceSurface} -> ${committedSurface} (target ${targetSurface}); draggable=${sourceDraggable}; writes=${JSON.stringify(mutationRequests)}; events=${JSON.stringify(pointerEvents.slice(0, 5))}...${JSON.stringify(pointerEvents.slice(-5))}`)
  }
  const result = await page.evaluate(() => ({
    cardCount: document.querySelectorAll('.proj-card').length,
    cardOrder: [...document.querySelectorAll('.proj-card')].slice(0, 12).map(element => element.getAttribute('data-project-id')),
    movedProjectSurface: document.querySelector('.proj-card[data-project-id="1"]')?.closest('[data-col-status]')?.getAttribute('data-col-status') ?? null,
  }))
  if (errors.length) throw new Error(`Page errors: ${errors.join('; ')}`)
  if (result.cardCount !== 80) throw new Error(`Expected 80 real project cards, found ${result.cardCount}`)

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceRevision,
    sourceDirty,
    target: 'Gugu-web Projects Kanban actual Vue page and ProjectCard components',
    runtime: 'local sibling runtime through VITE_USE_LOCAL_RUNTIME=1',
    browser: `Chromium ${browser.version()} (headless)`,
    durationMs: Date.now() - startedAt,
    fixture: { projects: result.cardCount, dataSource: 'Playwright-mocked API responses', persistentWrites: false },
    drag: { sourceProjectId: '1', targetProjectId: '2', fromSurface: sourceSurface, toSurface: targetSurface, method: 'Playwright mouse, 12 animation-frame-paced steps', committed: true, mutationMocked: true },
    result,
    apiRequests,
    pageErrors: errors,
    passed: true,
  }
  const reportPath = resolve(root, 'docs/reports/real-page-smoke.json')
  await mkdir(resolve(root, 'docs/reports'), { recursive: true })
  await writeFile(reportPath, JSON.stringify(report, null, 2))
  console.log(`Real Gugu-web page smoke passed: ${reportPath}`)
  await browser.close()
} finally {
  server.kill('SIGTERM')
}

async function waitForServer(url) {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    if (serverExit) throw new Error(`Gugu-web Vite exited: ${JSON.stringify(serverExit)}`)
    try {
      if ((await fetch(url)).ok) return
    } catch { /* server is starting */ }
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  throw new Error(`Gugu-web Vite did not start at ${url}`)
}
