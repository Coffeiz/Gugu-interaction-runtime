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

  // landing proxy 始终保持 pointer-events:none，避免自身或子节点重新命中 :hover；
  // regrab 由 Runtime 在 document 捕获阶段按代理实时矩形判断。
  const proxy = page.locator('[data-runtime-proxy]')
  await expect(proxy).toHaveCount(1)
  await expect.poll(async () => (await proxy.evaluate(el => (el as HTMLElement).style.pointerEvents))).toBe('none')

  // proxy 正在持续回飞，不能先在 Playwright 侧读取 boundingBox、再隔一个异步步骤
  // 去点击旧坐标。这里在浏览器同一任务内读取当前 rect 并把 pointerdown 交给
  // document 捕获监听器，验证 Runtime 的实时矩形命中；随后 move/up 仍进入新
  // Session 的 window pointer 输入链路。
  await page.evaluate(async ({ x, y }) => {
    const landingProxy = document.querySelector<HTMLElement>('[data-runtime-proxy]')
    if (!landingProxy) throw new Error('landing proxy not found')
    const rect = landingProxy.getBoundingClientRect()
    document.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      pointerType: 'mouse',
      button: 0,
      buttons: 1,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    }))
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    window.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true,
      pointerType: 'mouse',
      button: 0,
      buttons: 1,
      clientX: x,
      clientY: y,
    }))
    // PointerSessionInput 会把 move 合并到下一帧；等它提交命中后再 release。
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    window.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true,
      pointerType: 'mouse',
      button: 0,
      buttons: 0,
      clientX: x,
      clientY: y,
    }))
  }, { x: columnBox.x + columnBox.width / 2, y: columnBox.y + 100 })

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