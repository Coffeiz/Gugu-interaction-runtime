# 跨列拖拽落地瞬间原列闪一次 flip：ownership 释放时机与 Vue Teleport 的微任务竞态

## 现象

在接入了业务侧的 `<Teleport :disabled="!isDetached(...)">`（详见下方"背景"）之后，跨列拖拽卡片松手落地的瞬间，原来的列会瞬间闪一次 flip：卡片的原位占位符突然出现，紧接着其他卡片收位。同列拖拽、原地松手都没有这个问题，只有真正跨列时才会复现。

## 背景

`gugu-interaction-runtime` 的 detach 拖拽策略不会自己重新挂载业务 DOM 节点（[`SourceVisualLease.ts`](../../src/dom/SourceVisualLease.ts) 的注释明确记录过手动 reparent 业务节点会导致 Vue 认不出节点、多挂一份的教训）。卡片要在抓起时逃出所在列的 `overflow:hidden` 裁切、松手后收位，必须由业务组件自己用 Vue 的 `<Teleport>` 声明，Runtime 只负责通过 `runtime.owner`（ownership）广播"这个对象现在归不归 Runtime 接管"这个信号，业务侧订阅这个信号驱动 `Teleport` 的 `disabled` prop。这次接入这层 Teleport 时对齐的正是 [`gugu-interaction-runtime/src/demo/KanbanBoard.vue`](../../src/demo/KanbanBoard.vue) 的既有写法。

## 根因

`objectLease?.release()`（[`DetachAdapter.ts`](../../src/runtime/detach/DetachAdapter.ts) `onUp()`）原本是松手瞬间同步调用的，早于业务 Action 真正落地：

```
onUp() 同步执行:
  objectLease.release()   → owner.isControlled(objectId) 立刻变 false
                             → Teleport 立刻把卡片传送回原列（这时 store 还没变）
...（异步）
MoveCommitCoordinator.commit():
  await emit(...)          → 业务 store 变更，卡片真正归属新列
```

`release()` 太早触发，Teleport 会先把卡片传送回**原列**（此时 store 里它确实还属于原列），过一会儿 `emit()` 生效后卡片才真正挪到新列——这两次传送中间隔着 `emit()` 内部至少一次 Vue 渲染节拍，足够露出一帧"原列突然多出一张卡片"。

## 第一次尝试与教训：release 挪太晚

直觉的修复是把 `release()` 挪到 landing 完全结束（`finishReveal`，真实卡片即将揭示的那一刻）再调用——结果引入了新的回归：卡片飞向页面默认兜底位置。原因是 `resolveMoveTarget`/`waitForMoveTarget` 解析落地目标本身就要等卡片被 Teleport 传送回真实 DOM 才能找到它；`finishReveal` 在 landing 动画播完（约 250~400ms）之后才触发，这中间目标解析早就超时/找不到目标了。

## 第二次尝试与教训：release 挪对了位置但顺序反了

改成 `emit()` 成功之后立刻通过新增的 `lifecycle.surface.enter` 钩子释放，时机上没错，但 `surface.enter` 原本排在 `playLayout()`（内部 `scheduleLayoutFlip` 会 `queueMicrotask` 一个 FLIP 播放任务）**之后**调用。这暴露了一个容易被忽略的细节：

- `objectLease.release()` 内部同步 `emit()`（Runtime 自己的事件系统，[`Owner.ts`](../../src/owner/Owner.ts) 的 `Emitter.emit` 是同步 `forEach` 广播），业务侧订阅回调（`ownershipVersion.value++`）也是同步执行的；
- 但 Vue 响应这次 ref 变化、真正把 Teleport 目标 DOM patch 完成，是异步排到 **Vue 自己的**微任务队列的；
- 谁的 job 先入队，谁先执行。`playLayout()` 先跑（先把 FLIP 的 microtask 排进队列），`surface.enter`（触发 Vue 渲染 job 入队）后跑——FLIP 的 microtask 反而先执行，这时候卡片还没被 Teleport 传送回目标列，FLIP 量到的是旧布局，复现了之前 devlog 记录过的"松手瞬间闪一帧最终布局"的三帧问题的另一个诱因。

## 最终修复

把 `surface.enter` 调用挪到 `playLayout()` **之前**（[`RuntimeMove.ts`](../../src/runtime/RuntimeMove.ts) `MoveCommitCoordinator.commit()`），紧跟在 `emit()` 之后：

```
await emit()
await lifecycle.surface.enter(...)   // release() 同步触发 Vue 渲染 job 入队，
                                      // await 让出一轮微任务，Vue 的 job 先执行
playLayout(context)                  // 这里再排 FLIP 的 microtask，
                                      // 拿到的已经是 Teleport 落位后的最终布局
```

`objectLease` 的释放按落点分两条路径：
- **无效落点**（没有 `emit`，卡片弹回原位）：`onUp()` 里立刻释放，没有中间态风险，也等不到 `surface.enter`（这个钩子只在有 `emitAction` 时才会触发）。
- **有效落点**：改到上面这个"emit 之后、playLayout 之前"的位置释放。

## 验证

跨列拖拽落地不再有原列瞬间闪一次 flip，同时确认没有复现三帧问题（松手瞬间闪一帧最终布局），也确认跨列拖拽能正常落到目标列（不再飞向页面兜底位置）。类型检查通过，`vitest` 64/64 通过，诊断探针已在确认原因后移除。
