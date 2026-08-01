# 项目页 Runtime 收口方案

## 目标

将 Gugu 项目页的单卡拖拽完整接入 Runtime。业务侧只负责注册 object、surface、卡片样式、目标解析和业务 Action；Session、输入、视觉代理、FLIP、landing、reveal、regrab、滚动和清理由 Runtime 统一编排。

本方案只处理项目页单卡 detach 流程，不同时迁移文件、多选拖拽和画布特殊逻辑。

## 当前状态

项目页已经接入 Runtime 的部分包括：

- `useObject` / `useSurface`
- object ownership
- Action 订阅
- group height transition
- group FLIP
- collection presence
- 全局 motion 配置
- `project-card` 对象类型注册

截至 `97de590`，项目页入口已经由 `useObject` 自动绑定到 Runtime；业务组件不再直接启动项目卡的旧拖拽入口。

历史版本的拖拽入口曾经是：

```text
ProjectCard / drawerDrag
→ startThresholdDrag
→ startPhysicsDrag
→ interaction/single.ts
→ legacy deps
```

因此 Runtime 当前已承担项目卡的输入、Session、视觉代理、落点等待和布局主链；业务侧
只保留对象/Surface 注册、项目样式和 Action 提交。

## 收口后的目标结构

```text
ProjectCard
  └─ runtime.start(objectId, pointerEvent)
       ├─ PointerSessionInput
       ├─ RuntimeSession
       ├─ MoveBehavior
       ├─ SurfaceStore / HitResolver
       ├─ VisualAdapter
       │    ├─ grabbing
       │    ├─ landing
       │    ├─ reveal
       │    ├─ regrab
       │    └─ dispose
       ├─ Layout / Group / Collection FLIP
       └─ runtime.onAction(action)
```

业务侧只保留：

```ts
runtime.registerObjectType('project-card', {
  defaultVisualMode: 'detach',
  resolveSurface,
  resolveElement,
  visualAdapter: projectCardVisualAdapter,
})

runtime.onAction(commitProjectMove)
```

## 需要从业务侧收口的职责

### 1. 拖拽事务

从 `interaction/single.ts`、`useDragEngine.ts` 收回：

- threshold 判定
- pointer listener
- Session 创建和状态转换
- cancel / interrupt / regrab
- release 判定
- 异步回调 token 校验
- listener、RAF、Lease 和行为清理

### 2. 视觉生命周期

从 `interaction/single.ts`、`visual/clone.ts`、`CardVisualController.ts` 收回：

- source snapshot
- grabbing proxy
- source 隐藏与占位
- landing proxy
- proxy → target 的视觉交接
- reveal / hover 清理
- regrab 时的视觉节点接管
- proxy dispose

业务 adapter 只提供卡片样式快照、可选的抓取玻璃效果和目标样式策略。

### 3. 落点与布局

从业务侧收回：

- 最后 pointer 位置记录
- Surface / index 解析
- target 等待
- 同列 / 跨列判断
- scroll parent 和 keep-visible
- surface resize 后的最终坐标
- landing 前后的 FLIP 顺序

Runtime 统一执行：

```text
resolveDestination
→ emitAction
→ waitTarget
→ captureLayout
→ playSurface / Group / Collection FLIP
→ landing
→ reveal
→ dispose
```

## 应保留在业务 adapter 的内容

以下内容不进入 Runtime 核心：

- 项目卡 DOM 和 CSS class
- 完成状态、星级、按钮等业务视觉
- 年/月/最近完成分组规则
- 项目列名称和业务状态映射
- Action 的业务 payload 和 Store 提交
- 项目页特有的目标过滤规则
- 可选的毛玻璃抓取样式

## 分阶段执行计划

### Phase 1：统一项目卡入口（已完成）

- `ProjectCard` 通过 `useObject` 注册并由 Runtime 自动绑定 element。
- `project-card` 已注册默认 detach 视觉模式与抓取对齐配置。
- Action、Surface、Object ownership 和布局编排均通过 Runtime API 接入。
- 项目页不再直接调用 `startPhysicsDrag` / `startThresholdDrag`。
- 已验证首次抓取、阈值、跨列和无效落点；点击事件由 Runtime 阈值门保留。

### Phase 2：迁移单卡 Session 与输入（已完成）

- threshold、pointer follow、release、cancel、interrupt 和 regrab 已由 Runtime 的
  `RuntimeInputCoordinator`、`PointerSessionInput`、`RuntimeSessionCoordinator` 和
  `MoveBehavior` 统一编排。
- 对象类型现在可以通过 `pointerInput.dragThreshold` 配置拖拽阈值；默认值为 5px，
  未越过阈值时不会调用视觉 adapter，从而保留业务 click。
- pointer listener、RAF、Session Cleanup、Lease 和旧 session token 均在 Runtime 侧收口。
- 已增加对象级阈值回归测试，并通过 Runtime typecheck/test。

下一步进入 Phase 3：将 detach 的 source/proxy/landing/reveal 生命周期进一步收拢为
Runtime VisualAdapter 的单一入口，同时保持当前项目页视觉结果不变。

### Phase 3：迁移 VisualAdapter（已完成）

- detach 的 source/proxy/landing/reveal 主链路已接入 Runtime VisualAdapter。
- 已修正代理销毁边界：adapter 提供 `dispose` 时由 adapter 完整接管，Runtime 不再重复调用
  `proxy.dispose`。
- 已增加 adapter dispose 幂等边界回归测试；代理替换也统一经过 Runtime 的销毁边界，
  不再由 `VisualProxyCoordinator` 直接清理旧代理。
- 已增加 `runtime.resolveLandingTarget()`，统一同步目标解析与跨 Surface DOM 等待，
  detach adapter 不再自行组合两套解析路径。
- 已增加 `runtime.takeoverRegrab()`，统一 landing → regrab 的旧 Session 失效、
  completion gate 清理和视觉代理失效；detach adapter 只保留 source 可见性与监听器处理。
- landing 前后的 capture、commit、surface enter、FLIP 播放顺序已经由
  `RuntimeMoveCoordinator` 统一执行；detach adapter 不再自行决定这条顺序。
- Phase3 回归测试已覆盖 proxy dispose、regrab 接管、landing/reveal 顺序和旧 Promise
  失效。

### Phase 4：迁移目标、FLIP 和滚动（已完成）

- Runtime 已统一调用 HitResolver、LandingTargetTracker 和 `resolveLandingTarget()`。
- 同列、跨列、完成列目标等待已统一到 Runtime。
- 将 surface FLIP、group FLIP、collection presence 和 resize 排序统一编排。
- keep-visible 已收进 `runtime.keepSurfaceTargetVisible()`，并增加 Surface viewport 回归测试；
  AutoScroll 已收进 `runtime.createAutoScroller()`，控制器生命周期绑定当前 Session。
- `captureMoveLayout()` / `playMoveLayout()` 已作为 Runtime 门面，`RuntimeMoveCoordinator`
  不再直接驱动 `MoveBehavior` 的布局播放。
- `runtime.captureLayout()` / `runtime.scheduleLayout()` 已开放统一的
  Surface/group/collection FLIP 快照入口，detach adapter 不再直接调度抓取后的初始 FLIP。
- `runtime.runGroupToggle()` 已成为组展开/收起的统一门面，项目页不再直接调用底层
  `runGroupToggle` 函数。
- collection presence 已作为布局快照的一部分由 Runtime FLIP 管线统一播放。
- 已完成的部分已覆盖目标等待、同列/跨列落点、Surface viewport 滚动、列尾 rAF FLIP、
  group resize、collection presence 和快速连续事务。
- 已删除项目页 `single.ts` 中残留的 `.done-layout-root` 特判、项目专用目标等待分支和
  `onPickupFromDoneLayout` 入口；通用拖拽仍保留 `animateOpen`，供文件、画布和抽屉策略使用。

### Phase 5：删除项目页旧编排（已完成）

- 项目看板卡片不再直接传入 legacy deps，也不再调用 `startPhysicsDrag`、
  `startThresholdDrag`、`flipCoordinator`、拖拽视觉 `clone/landing` 或 `morphLifecycle`。
- 项目页组展开/收起已通过 `runtime.runGroupToggle()` 接入。
- 文件、画布、抽屉和多选仍保留各自 adapter 及共享 `single.ts`，没有误删跨页面能力。
- 项目页业务代码已收敛为 Object/Surface 注册、卡片样式和 Action 提交。

Phase5 验证完成：项目页旧拖拽入口无引用，Runtime 源码接入通过 68 项回归测试和类型检查。

## 验证清单

### 交互

- 原地抓起后松手
- 超过阈值后拖动
- 同列重排
- 跨列移动
- 无效落点飞回
- landing 中 regrab
- 快速连续抓放
- 最底部卡片抓取和放回

### 布局

- 兄弟卡 FLIP 不瞬移
- 年/月组展开和收起不中断
- 完成列 collection presence 正常
- Surface resize 可打断并从当前进度继续
- 目标在可视区外时只滚动一次并正确落点

### 视觉

- 抓取点和鼠标偏移正确
- proxy 不受容器裁切
- grabbing / landing 样式一致
- 姿态、圆角、字体和背景正确继承
- reveal 不受 native hover 干扰
- 旧 session 不会清理新 session 的 proxy

### 验收标准

- 项目页业务组件不再直接调用 `startPhysicsDrag` 或 `startThresholdDrag`。
- 项目页业务侧不再编排 proxy、landing、FLIP、滚动和 Session 清理。
- 每次拖拽只有一次 commit、一次 landing、一次 reveal 和一次 dispose。
- Runtime 行为与当前已验证 demo 效果一致。
- 文件和画布 adapter 不因本次项目页收口而改变。
