import { test, expect } from '@playwright/test'

declare global {
  interface Window {
    __runtimeDebug: {
      getActionCount: () => number
      resetActionCount: () => void
      getProxyCount: () => number
    }
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => window.__runtimeDebug.resetActionCount())
})

test('同列拖拽只产生一次 Action，结束后无残留 proxy', async ({ page }) => {
  const card = page.locator('[data-card="c1"]')
  const box = await card.boundingBox()
  if (!box) throw new Error('card c1 not found')

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height + 120, { steps: 10 })
  await expect.poll(() => page.evaluate(() => window.__runtimeDebug.getProxyCount())).toBe(1)
  await page.mouse.up()

  await expect.poll(() => page.evaluate(() => window.__runtimeDebug.getActionCount())).toBe(1)
  await expect.poll(() => page.evaluate(() => window.__runtimeDebug.getProxyCount())).toBe(0)
})

test('跨列拖拽只产生一次 Action', async ({ page }) => {
  const card = page.locator('[data-card="c1"]')
  const doingColumn = page.locator('[data-column="doing"]')
  const cardBox = await card.boundingBox()
  const columnBox = await doingColumn.boundingBox()
  if (!cardBox || !columnBox) throw new Error('card or column not found')

  await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(columnBox.x + columnBox.width / 2, columnBox.y + 100, { steps: 15 })
  await page.mouse.up()

  await expect.poll(() => page.evaluate(() => window.__runtimeDebug.getActionCount())).toBe(1)
  await expect.poll(() => page.evaluate(() => window.__runtimeDebug.getProxyCount())).toBe(0)
})

test('无效落点松手不产生 Action，卡片回到原列', async ({ page }) => {
  const card = page.locator('[data-card="c1"]')
  const invalidArea = page.locator('.kb-strategy-switch')
  const cardBox = await card.boundingBox()
  const invalidBox = await invalidArea.boundingBox()
  if (!cardBox || !invalidBox) throw new Error('card or invalid drop area not found')

  await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(invalidBox.x + invalidBox.width / 2, invalidBox.y + invalidBox.height / 2, { steps: 15 })
  await page.mouse.up()

  await expect.poll(() => page.evaluate(() => window.__runtimeDebug.getActionCount())).toBe(0)
  await expect.poll(() => page.evaluate(() => window.__runtimeDebug.getProxyCount())).toBe(0)
  await expect(page.locator('[data-column="todo"] [data-card="c1"]')).toBeVisible()
})

test('完成列年/月分组内拖拽只产生一次 Action', async ({ page }) => {
  const card = page.locator('[data-card="c6"]')
  const box = await card.boundingBox()
  if (!box) throw new Error('card c6 not found')

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height + 60, { steps: 10 })
  await page.mouse.up()

  await expect.poll(() => page.evaluate(() => window.__runtimeDebug.getActionCount())).toBe(1)
  await expect.poll(() => page.evaluate(() => window.__runtimeDebug.getProxyCount())).toBe(0)
})

test('无效落点回飞途中 regrab 后正常落地，只产生一次 Action', async ({ page }) => {
  const card = page.locator('[data-card="c1"]')
  const invalidArea = page.locator('.kb-strategy-switch')
  const doingColumn = page.locator('[data-column="doing"]')
  const cardBox = await card.boundingBox()
  const invalidBox = await invalidArea.boundingBox()
  const columnBox = await doingColumn.boundingBox()
  if (!cardBox || !invalidBox || !columnBox) throw new Error('card, invalid area or column not found')

  // 第一次拖到无效落点松手，触发回飞（cancel，不产生 Action）
  await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(invalidBox.x + invalidBox.width / 2, invalidBox.y + invalidBox.height / 2, { steps: 15 })
  await page.mouse.up()

  // regrab 目标是回飞中的 proxy（松手后短暂延迟才会把 pointer-events 打开成
  // 可交互），不是原卡片 DOM；这里显式定位 proxy 当前位置，而不是猜测松手点。
  const proxy = page.locator('[data-runtime-proxy]')
  await expect(proxy).toHaveCount(1)
  await expect.poll(async () => (await proxy.evaluate(el => (el as HTMLElement).style.pointerEvents))).toBe('auto')
  const proxyBox = await proxy.boundingBox()
  if (!proxyBox) throw new Error('landing proxy not found')

  // 回飞动画途中立刻重新抓起（regrab），不等它落定
  await page.mouse.move(proxyBox.x + proxyBox.width / 2, proxyBox.y + proxyBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(columnBox.x + columnBox.width / 2, columnBox.y + 100, { steps: 15 })
  await page.mouse.up()

  await expect.poll(() => page.evaluate(() => window.__runtimeDebug.getActionCount())).toBe(1)
  await expect.poll(() => page.evaluate(() => window.__runtimeDebug.getProxyCount())).toBe(0)
  await expect(page.locator('[data-column="doing"] [data-card="c1"]')).toBeVisible()
})

test('连续快速拖拽两张卡片，各产生一次 Action', async ({ page }) => {
  const doingColumn = page.locator('[data-column="doing"]')
  const reviewColumn = page.locator('[data-column="review"]')
  const columnBox1 = await doingColumn.boundingBox()
  const columnBox2 = await reviewColumn.boundingBox()
  if (!columnBox1 || !columnBox2) throw new Error('column not found')

  const card1 = page.locator('[data-card="c1"]')
  const box1 = await card1.boundingBox()
  if (!box1) throw new Error('card c1 not found')
  await page.mouse.move(box1.x + box1.width / 2, box1.y + box1.height / 2)
  await page.mouse.down()
  await page.mouse.move(columnBox1.x + columnBox1.width / 2, columnBox1.y + 100, { steps: 10 })
  await page.mouse.up()

  const card2 = page.locator('[data-card="c2"]')
  const box2 = await card2.boundingBox()
  if (!box2) throw new Error('card c2 not found')
  await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2)
  await page.mouse.down()
  await page.mouse.move(columnBox2.x + columnBox2.width / 2, columnBox2.y + 100, { steps: 10 })
  await page.mouse.up()

  await expect.poll(() => page.evaluate(() => window.__runtimeDebug.getActionCount())).toBe(2)
  await expect.poll(() => page.evaluate(() => window.__runtimeDebug.getProxyCount())).toBe(0)
})
