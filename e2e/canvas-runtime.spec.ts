import { test, expect, type Page } from '@playwright/test'

async function openCanvas(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: '自由画布' }).click()
  await expect(page.locator('.canvas-demo')).toBeVisible()
}

async function dragCanvasCard(page: Page, cardId: string, viewportPoint: { x: number; y: number }): Promise<void> {
  const viewport = page.locator('.canvas-viewport')
  const card = page.locator(`[data-card="${cardId}"]`)
  const viewportBox = await viewport.boundingBox()
  const cardBox = await card.boundingBox()
  if (!viewportBox || !cardBox) throw new Error(`画布卡片或视口未渲染：${cardId}`)

  const startX = cardBox.x + cardBox.width / 2
  const startY = cardBox.y + cardBox.height / 2
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + 18, startY + 12, { steps: 4 })
  await page.mouse.move(viewportBox.x + viewportBox.width * viewportPoint.x, viewportBox.y + viewportBox.height * viewportPoint.y, { steps: 10 })
  await page.mouse.up()
  await expect(page.locator('[data-runtime-proxy="true"]')).toHaveCount(0)
}

test('自由画布卡片落地后代理清理并保留连接线', async ({ page }) => {
  await openCanvas(page)

  await expect(page.locator('[data-card="canvas:idea"] [data-card-port]')).toHaveCount(2)
  await expect(page.locator('[data-card="drawer:project"] [data-card-port]')).toHaveCount(0)

  const viewport = page.locator('.canvas-viewport')
  const card = page.locator('[data-card="canvas:idea"]')
  const viewportBox = await viewport.boundingBox()
  const cardBox = await card.boundingBox()
  if (!viewportBox || !cardBox) throw new Error('画布或源卡片未渲染')

  await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(viewportBox.x + viewportBox.width * 0.62, viewportBox.y + viewportBox.height * 0.62, { steps: 12 })
  await expect(page.locator('[data-runtime-proxy="true"]')).toHaveCount(1)
  await page.mouse.up()

  await expect(page.locator('[data-runtime-proxy="true"]')).toHaveCount(0)
  await expect(card).toBeVisible()
  await expect(page.locator('.relation-line')).toHaveCount(2)
})

test('普通模式落地后代理清理且卡片仍在画布上', async ({ page }) => {
  await openCanvas(page)
  await page.getByRole('button', { name: '收起项目抽屉' }).click({ force: true })
  await expect(page.getByRole('button', { name: '展开项目抽屉' })).toBeVisible()
  await page.getByRole('button', { name: '普通' }).click()

  const viewport = page.locator('.canvas-viewport')
  const card = page.locator('[data-card="canvas:task"]')
  const viewportBox = await viewport.boundingBox()
  const cardBox = await card.boundingBox()
  if (!viewportBox || !cardBox) throw new Error('普通模式的画布或源卡片未渲染')

  await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(viewportBox.x + viewportBox.width * 0.35, viewportBox.y + viewportBox.height * 0.35, { steps: 12 })
  await page.mouse.up()

  await expect(page.locator('[data-runtime-proxy="true"]')).toHaveCount(0)
  await expect(card).toBeVisible()
})

test('连续快速拖拽两张画布卡片后各自清理代理', async ({ page }) => {
  await openCanvas(page)

  // 覆盖“第一张 landing 尚未完全结束就开始第二次拖拽”的入口，防止旧 session 的
  // completion 回调清理新 session 代理或覆盖第二张卡片的最终状态。
  await dragCanvasCard(page, 'canvas:idea', { x: 0.22, y: 0.24 })
  await dragCanvasCard(page, 'canvas:brief', { x: 0.72, y: 0.72 })

  await expect(page.locator('[data-card="canvas:idea"]')).toBeVisible()
  await expect(page.locator('[data-card="canvas:brief"]')).toBeVisible()
  await expect(page.locator('[data-runtime-proxy="true"]')).toHaveCount(0)
})

test('长序列快速拖拽画布卡片后没有残留代理或失联卡片', async ({ page }) => {
  test.setTimeout(90000)
  await openCanvas(page)

  // 用固定、有限的 16 次序列模拟长时间连续操作；每次都重新读取卡片盒，覆盖
  // 卡片位置已经被前一次 Action 更新后的连续拖拽，而不是重复使用旧坐标。
  const cards = ['canvas:idea', 'canvas:reference', 'canvas:brief', 'canvas:task']
  const points = [
    { x: 0.18, y: 0.22 }, { x: 0.72, y: 0.24 },
    { x: 0.68, y: 0.72 }, { x: 0.24, y: 0.70 },
  ]
  for (let index = 0; index < 16; index += 1) {
    await dragCanvasCard(page, cards[index % cards.length], points[index % points.length])
  }

  await expect(page.locator('[data-runtime-proxy="true"]')).toHaveCount(0)
  for (const cardId of cards) {
    await expect(page.locator(`[data-card="${cardId}"]`)).toBeVisible()
  }
})

test('抽屉卡片可跨 Surface 进出，连接删除后不残留路径', async ({ page }) => {
  await openCanvas(page)

  const source = page.locator('[data-card="drawer:project"]')
  const viewport = page.locator('.canvas-viewport')
  const dropZone = page.locator('.drawer-drop-zone')
  const sourceBox = await source.boundingBox()
  const viewportBox = await viewport.boundingBox()
  if (!sourceBox || !viewportBox) throw new Error('抽屉卡片或画布未渲染')

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(viewportBox.x + viewportBox.width * 0.45, viewportBox.y + viewportBox.height * 0.4, { steps: 12 })
  await page.mouse.up()
  await expect(page.locator('[data-runtime-proxy="true"]')).toHaveCount(0)
  await expect(page.locator('[data-card="drawer:project"]')).toHaveCount(1)

  const moved = page.locator('[data-card="drawer:project"]')
  const movedBox = await moved.boundingBox()
  const dropBox = await dropZone.boundingBox()
  if (!movedBox || !dropBox) throw new Error('跨 Surface 后卡片或抽屉落点未渲染')
  await page.mouse.move(movedBox.x + movedBox.width / 2, movedBox.y + movedBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(dropBox.x + dropBox.width / 2, dropBox.y + dropBox.height / 2, { steps: 12 })
  await page.mouse.up()
  await expect(page.locator('[data-runtime-proxy="true"]')).toHaveCount(0)

  const firstRelation = page.locator('.relation-group').first()
  await expect(firstRelation).toBeVisible()
  await firstRelation.click()
  await expect(page.locator('.relation-group')).toHaveCount(1)
})
