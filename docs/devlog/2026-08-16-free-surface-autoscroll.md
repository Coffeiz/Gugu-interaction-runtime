# Free Surface 被误触发自动滚动

## 现象

画布卡片拖到浏览器底部并持续移出、移回时，画布内卡片会持续向上移动；点阵背景看起来没有移动。问题只在自由画布出现，列表和抽屉的拖拽自动滚动不受影响。

## 定位

Runtime 的 `MoveAdapter` 原本对每个拖拽 Session 都创建 `AutoScroller`，并把当前命中的 Surface 元素交给它。`AutoScroller` 只根据容器边缘和 `scrollTop` 工作，没有区分 Surface 的布局语义。

自由画布虽然使用 `overflow: hidden`，但世界层内容高度仍可能大于 viewport，脚本写入 `scrollTop` 仍会移动内容。由于点阵背景绘制在 viewport 层、camera 本身没有变化，最终表现为“卡片整体向上飞、点阵不动”。

## 修复

`Runtime.resolveMoveSurfaceElement()` 对注册表命中的 `layout: 'free'` Surface 返回 `null`，因此 free 画布不会进入列表自动滚动路径；`layout: 'grid'` 的列表、抽屉和文件夹仍保持原有自动滚动行为。

## 回归边界

- free 画布拖拽越过 viewport 边缘，不得修改画布 `scrollTop` 或伪造 camera 平移。
- grid/drawer Surface 仍可在靠近边缘时自动滚动。
- free landing、释放惯性和 camera 坐标换算不由本修复改变。

## 验证

新增 `runtimeOrchestration.test.ts` 回归：free Surface 的移动滚动元素解析结果必须为 `null`。Runtime 定向测试通过，Gugu-web 前端 typecheck 通过。
