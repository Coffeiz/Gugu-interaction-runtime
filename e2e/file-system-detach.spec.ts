import { test, expect } from '@playwright/test'

test('文件页 detach 支持文件夹卡和面包屑目录目标', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '文件系统' }).click()
  await page.getByRole('button', { name: 'detach' }).last().click()

  const file = page.locator('.file-item[data-file-id="file:readme"]')
  const fileTarget = page.locator('.file-item.folder[data-file-id="folder:references"]')
  const fileBox = await file.boundingBox()
  const fileTargetBox = await fileTarget.boundingBox()
  if (!fileBox || !fileTargetBox) throw new Error('文件或目标文件夹未渲染')
  await page.mouse.move(fileBox.x + fileBox.width / 2, fileBox.y + fileBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(fileTargetBox.x + fileTargetBox.width / 2, fileTargetBox.y + fileTargetBox.height / 2, { steps: 12 })
  await page.mouse.up()
  await expect(page.locator('[data-runtime-proxy="true"]')).toHaveCount(0)

  // 文件完成吸收后，原目标文件夹仍必须保留 Runtime 的 pointerdown 入口。
  const targetFolderAfterFileDrop = page.locator('.file-item.folder[data-file-id="folder:references"]')
  const targetAfterFileDropBox = await targetFolderAfterFileDrop.boundingBox()
  if (!targetAfterFileDropBox) throw new Error('文件夹目标在文件落地后消失')
  await page.mouse.move(targetAfterFileDropBox.x + targetAfterFileDropBox.width / 2, targetAfterFileDropBox.y + targetAfterFileDropBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(targetAfterFileDropBox.x + targetAfterFileDropBox.width / 2 + 28, targetAfterFileDropBox.y + targetAfterFileDropBox.height / 2 + 8, { steps: 5 })
  await expect(page.locator('[data-runtime-proxy="true"]')).toHaveCount(1)
  await page.mouse.up()
  await expect(page.locator('[data-runtime-proxy="true"]')).toHaveCount(0)

  const source = page.locator('.file-item.folder[data-file-id="folder:plans"]')
  const target = page.locator('.folder-sidebar button[data-file-id="folder:assets"]')
  const sourceBox = await source.boundingBox()
  if (!sourceBox) throw new Error('文件夹卡片未渲染')
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
  await page.mouse.down()
  const targetBox = await target.boundingBox()
  if (!targetBox) throw new Error('目标文件夹未渲染')
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 12 })
  await page.mouse.up()
  await expect(page.locator('[data-runtime-proxy="true"]')).toHaveCount(0)
  await target.click()
  await expect(page.locator('.file-item[data-file-id^="folder:plans"]')).toHaveCount(1)

  await page.locator('.breadcrumbs button').filter({ hasText: '个人文件' }).click()
  const rootFile = page.locator('.file-item[data-file-id="file:roadmap"]')
  const rootFileBox = await rootFile.boundingBox()
  const root = page.locator('.breadcrumbs button').filter({ hasText: '个人文件' })
  const rootBox = await root.boundingBox()
  if (!rootFileBox || !rootBox) throw new Error('文件或面包屑未渲染')
  await page.mouse.move(rootFileBox.x + rootFileBox.width / 2, rootFileBox.y + rootFileBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(rootBox.x + rootBox.width / 2, rootBox.y + rootBox.height / 2, { steps: 12 })
  await page.mouse.up()
  await expect(page.locator('[data-runtime-proxy="true"]')).toHaveCount(0)
})

test('切换到子目录后，空白落点仍回到当前浏览器中的原卡片', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '文件系统' }).click()
  await page.getByRole('button', { name: 'detach' }).last().click()

  await page.locator('.folder-sidebar button[data-file-id="folder:plans:research"]').click()
  const file = page.locator('.file-item[data-file-id="file:competitor"]')
  const browser = page.locator('.file-surface')
  const fileBox = await file.boundingBox()
  const browserBox = await browser.boundingBox()
  if (!fileBox || !browserBox) throw new Error('子目录卡片或浏览 surface 未渲染')

  await page.mouse.move(fileBox.x + fileBox.width / 2, fileBox.y + fileBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(browserBox.x + browserBox.width - 40, browserBox.y + browserBox.height - 40, { steps: 12 })
  await page.mouse.up()

  await expect(page.locator('[data-runtime-proxy="true"]')).toHaveCount(0)
  await expect(file).toHaveCount(1)
  await expect(file).toContainText('竞品截图.zip')
})

test('多选文件拖入文件夹时以主卡带动选中项', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '文件系统' }).click()
  await page.getByRole('button', { name: 'detach' }).last().click()
  await page.getByRole('button', { name: '多选' }).click()

  const readme = page.locator('.file-item[data-file-id="file:readme"]')
  const roadmap = page.locator('.file-item[data-file-id="file:roadmap"]')
  await readme.click()
  await roadmap.click()
  await expect(page.locator('.file-item.is-selected')).toHaveCount(2)

  const target = page.locator('.file-item.folder[data-file-id="folder:references"]')
  const sourceBox = await readme.boundingBox()
  const targetBox = await target.boundingBox()
  if (!sourceBox || !targetBox) throw new Error('多选源卡或目标文件夹未渲染')
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 12 })
  await page.mouse.up()

  await expect(page.locator('[data-runtime-proxy="true"]')).toHaveCount(0)
  await expect(page.locator('.file-item.is-selected')).toHaveCount(0)
  await target.click()
  await expect(page.locator('.file-item[data-file-id="file:readme"]')).toHaveCount(1)
  await expect(page.locator('.file-item[data-file-id="file:roadmap"]')).toHaveCount(1)
})

test('普通点击单卡不会打开多选工具栏，空白拖动可以框选文件', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '文件系统' }).click()
  await page.getByRole('button', { name: 'detach' }).last().click()

  await page.locator('.file-item[data-file-id="file:readme"]').click()
  await expect(page.locator('.selection-bar')).toHaveCount(0)

  await page.getByRole('button', { name: '多选' }).click()
  const readme = page.locator('.file-item[data-file-id="file:readme"]')
  const roadmap = page.locator('.file-item[data-file-id="file:roadmap"]')
  const items = page.locator('.file-items')
  const readmeBox = await readme.boundingBox()
  const roadmapBox = await roadmap.boundingBox()
  const itemsBox = await items.boundingBox()
  if (!readmeBox || !roadmapBox || !itemsBox) throw new Error('框选目标或文件列表未渲染')

  const startX = itemsBox.x + 6
  const startY = Math.min(readmeBox.y, roadmapBox.y) - 6
  const endX = Math.max(readmeBox.x + readmeBox.width, roadmapBox.x + roadmapBox.width) + 6
  const endY = Math.max(readmeBox.y + readmeBox.height, roadmapBox.y + roadmapBox.height) + 6
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(endX, endY, { steps: 8 })
  await page.mouse.up()

  await expect(page.locator('.file-item.is-selected')).toHaveCount(5)
  await expect(page.locator('.file-item.is-selected[data-file-id="file:readme"]')).toHaveCount(1)
  await expect(page.locator('.file-item.is-selected[data-file-id="file:roadmap"]')).toHaveCount(1)
  await expect(page.locator('.selection-box')).toHaveCount(0)
})
