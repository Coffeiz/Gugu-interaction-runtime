import { expect, test } from '@playwright/test'

test('dnd-kit kanban card can be manually dragged and commits a measured move', async ({ page }) => {
  await page.goto('/benchmark?scenario=kanban&count=50&interaction=same-list&implementation=dnd-kit')
  await expect(page.locator('[data-benchmark-ready="true"]')).toBeVisible()

  const source = page.locator('[data-card="item-202"]')
  const target = page.locator('[data-card="item-203"]')
  const sourceBox = await source.boundingBox()
  const targetBox = await target.boundingBox()
  if (!sourceBox || !targetBox) throw new Error('kanban source or target card not found')

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height - 4, { steps: 8 })
  await page.mouse.up()

  await expect(page.locator('[data-benchmark-status]')).toHaveText('complete')
  const sample = await page.evaluate(() => window.__benchmark?.samples[0])
  expect(sample?.commit?.committed).toBe(true)
  expect(sample?.settleTimedOut).toBe(false)
  expect(sample?.phases.inputMs).toBeGreaterThan(0)
  expect(sample?.phases.commitMs).toBeGreaterThanOrEqual(0)
  expect(sample?.phases.settleMs).toBeGreaterThanOrEqual(0)
  expect(sample?.frames.count).toBeGreaterThan(0)
  expect(sample?.longTasks).toBeDefined()
  expect(sample?.layoutFlipTelemetry).toEqual({ status: 'unsupported', transactionCount: 0 })
})

test('runtime benchmark records only FLIP telemetry published during this drag', async ({ page }) => {
  await page.goto('/benchmark?scenario=grouped&count=50&interaction=grouped&implementation=runtime')
  await expect(page.locator('[data-benchmark-ready="true"]')).toBeVisible()

  const source = page.locator('[data-card="item-1"]')
  const target = page.locator('[data-card="item-2"]')
  const sourceBox = await source.boundingBox()
  const targetBox = await target.boundingBox()
  if (!sourceBox || !targetBox) throw new Error('grouped source or target card not found')

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height - 4, { steps: 8 })
  await page.mouse.up()

  await expect(page.locator('[data-benchmark-status]')).toHaveText('complete')
  const sample = await page.evaluate(() => window.__benchmark?.samples[0])
  expect(sample?.commit?.committed).toBe(true)
  expect(sample?.layoutFlipTelemetry.status).toBe('captured')
  if (sample?.layoutFlipTelemetry.status !== 'captured') throw new Error('runtime drag did not publish a new FLIP telemetry transaction')
  expect(sample.layoutFlipTelemetry.transactionCount).toBeGreaterThan(0)
  expect(sample.layoutFlipTelemetry.aggregation).toBe('last-published-transaction')
  for (const value of Object.values(sample.layoutFlipTelemetry.values)) expect(Number.isFinite(value)).toBe(true)
})

declare global {
  interface Window {
    __benchmark?: {
      samples: Array<{
        commit?: { committed: boolean }
        settleTimedOut: boolean
        layoutFlipTelemetry:
          | { status: 'unsupported'; transactionCount: 0 }
          | { status: 'missing'; transactionCount: 0 }
          | { status: 'captured'; transactionCount: number; aggregation: string; values: Record<string, number> }
        phases: { inputMs?: number; commitMs?: number; settleMs?: number }
        frames: { count: number }
        longTasks: unknown[]
      }>
    }
  }
}
