# 底部卡片顶动：resize 竞态与调度时机

## 现象

底部卡片抓起后立即松手，Surface 偶尔会把上方内容顶动一下；拖动一段时间再松手通常正常。日志显示同一列的 Surface 高度在短时间内出现 `594 → 548 → 594` 的恢复过程。

后续排查同一族问题时还发现两个变体：
- 卡片拖到列尾松手（无论是跨列追加还是同列回到底部），兄弟卡片会被瞬间顶起一下再落位；
- 已完成列这类有自定义排序/分组规则的列（按 `doneAt` 分年月分组），把卡片拖到中间松手，业务重排逻辑会把它按日期塞回原来的分组位置——视觉上没有真的移动，但仍然复现顶动。

## 根因一：过期 resize 回调竞态

卡片抓起会启动 Surface resize。旧 resize 尚未结束时，下一次快速抓放已经开始，并基于中间高度重新 capture。旧事务排队的 RAF/timeout 仍然可能在新事务期间执行，把 Surface 的 inline height 恢复成旧值。这个位移不是兄弟卡片 FLIP，也不是滚动锚点，而是过期 resize 回调与新事务竞争。

修复：
- 新布局事务 capture 时立即取消正在运行的 Surface resize，并恢复其基础 inline 样式；
- detach 的延后一帧布局调度增加 token，旧事务的回调在新事务开始后失效；
- 保持 landing 先接管目标，再启动布局 FLIP/Surface resize 的顺序。

## 根因二：调度时机——列尾追加必须用 rAF，中间插入必须用 microtask

`scheduleLayoutFlip` 用什么时机调度直接决定了顶动/闪现两种互斥的 bug：

- **用 `queueMicrotask`**：能在浏览器绘制前完成 Invert 写入，中间插入这类有 transform 位移的场景不会闪现最终布局；但对于列尾追加场景，容器 resize 的 `toHeight` 测量可能发生在 Vue 真正 patch 落地之前，量到的还是旧布局，表现为兄弟卡片被瞬间顶起（松手位置在列表底部时最明显）。
- **用 `requestAnimationFrame`**：能保证浏览器已经完成一次真实布局，`toHeight` 测量准确，列尾追加不会顶动；但 rAF 只保证"下一次绘制之前执行"，不保证"这一帧还没画完就执行"——如果 DOM 变化发生在非 rAF 驱动的事件（如 pointerup）里，浏览器可能先画一帧，这时候 FLIP 的 Invert 步骤还没执行，画出来的是"已经变化完、但动画还没开始"的最终布局，下一帧才摁回起点开始播放，表现为闪一下最终布局再回到起点做动画（中间插入场景最明显）。

两种调度各自能修一种 bug、必然复现另一种，无法只选一个全局适用。

修复：拆成两条并存的调度路径（[`GroupLayout.ts`](../../src/dom/GroupLayout.ts)）：
- `scheduleLayoutFlip`：保持 `queueMicrotask`，给有位移 FLIP（有 Invert）的中间插入/重排使用；
- `scheduleLayoutFlipOnRaf`：新增，用 `requestAnimationFrame`，给列尾追加使用——此时目标位置已有卡片无位移，rAF 不会闪现，且能等到 Vue patch 真正落地后再测量高度。

`playLayout` 在 [`RuntimeMove.ts`](../../src/runtime/RuntimeMove.ts) 的 `MoveCommitCoordinator.commit` 里按落点分流到两条路径中的一条（`behavior.playLayout` / `behavior.playLayoutOnRaf`），经 [`DetachMoveDriver.ts`](../../src/runtime/DetachMoveDriver.ts) 的 `createDetachLayoutLifecycle.play(_, snapshot, useRaf)` 落到对应的 `scheduleLayoutFlip*`。

## 根因三：落点判定要用真实渲染位置，不能用拖拽算出的 toIndex

最初判断"是不是列尾追加"用的是拖拽落点算出的 `toIndex` 跟目标列对象数 `count` 比较（`toIndex >= count - 1`）。这个判定假设"拖拽算出的插入位置 == 卡片最终真实停留的位置"，对没有自定义排序的普通列成立，但对已完成列这类按业务规则（日期分组）重新排序的列不成立——`toIndex` 只是"打算插到哪"，业务重排逻辑可能把卡片放回完全不同的位置。

修复：新增 `Runtime.ts` 已有的 `getObjectSurfaceIndex`（按屏幕上卡片真实 `getBoundingClientRect` 排序算出的索引，不依赖任何业务排序假设）作为判定依据，通过 `MoveCommitPort.getObjectIndex` 接入 `MoveCommitCoordinator.resolveIsAppend`：优先用这个真实 DOM 索引判断是否列尾，只有拿不到时才退回旧的 `toIndex`/`count` 兜底。判定统一放到 `emit` 之后（DOM 已经落地）才计算，正常提交和无效落点回弹两条路径都走同一个方法。

## 验证

覆盖底部卡片快速抓放、连续快速抓放、同列回放、跨列落地、列尾追加、已完成列分组重排回弹；类型检查通过，`vitest` 64/64 通过，诊断探针已在确认原因后移除。
