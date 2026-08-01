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

但实际拖拽入口仍然是：

```text
ProjectCard / drawerDrag
→ startThresholdDrag
→ startPhysicsDrag
→ interaction/single.ts
→ legacy deps
```

因此 Runtime 目前主要承担注册、配置和部分布局能力，项目卡的完整拖拽生命周期仍由业务侧旧编排控制。

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

### Phase 1：统一项目卡入口

- 为 `project-card` 注册 `resolveElement`、`resolveSurface` 和 VisualAdapter。
- 将 ProjectCard 的 pointerdown 改为 `runtime.start()`。
- 暂时保留旧 `startPhysicsDrag` 作为 Runtime 内部桥接，不再由业务组件直接调用。
- 验证首次抓取、阈值、跨列和无效落点。

### Phase 2：迁移单卡 Session 与输入

- 将 threshold、pointer follow、release、cancel、interrupt 和 regrab 收入 Runtime。
- 移除项目页对 `startThresholdDrag` 的直接依赖。
- 统一 session token、RAF、listener、Lease 清理。
- 验证快速抓放、原地点击、landing 中 regrab。

### Phase 3：迁移 VisualAdapter

- 将 detach 的 source/proxy/landing/reveal 生命周期接入 Runtime。
- 保持现有项目卡视觉结果不变。
- 让 Runtime 负责 proxy 创建、姿态继承、样式快照和 dispose。
- 验证抓取位置、毛玻璃开关、圆角、字体、hover 和落地交接。

### Phase 4：迁移目标、FLIP 和滚动

- Runtime 统一调用 HitResolver 和 LandingTargetTracker。
- 将同列、跨列、完成列目标等待统一到 Runtime。
- 将 surface FLIP、group FLIP、collection presence 和 resize 排序统一编排。
- 将 keep-visible 和滚动补偿收进 Surface/AutoScroll 协议。
- 删除 `single.ts` 中项目页专用的 `.done-layout-root`、`animateOpen` 和目标等待分支。

### Phase 5：删除项目页旧编排

- 删除项目页直接传入的 legacy deps。
- 删除项目页对 `flipCoordinator`、`clone`、`landing`、`morphLifecycle` 的直接调用。
- 保留文件、画布和多选所需的 adapter，不影响其他页面。
- 将项目页代码收敛为注册、目标解析、Action 和样式配置。

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

