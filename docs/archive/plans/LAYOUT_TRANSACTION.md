# Layout Transaction

## 状态

Phase 0/1/2/3/4/5 已完成：Runtime 已提供按布局根节点合并意图的事务协调器，组切换、detach/clone 移动布局生命周期和浮动 Surface observer 已登记到同一事务边界；统一提交器已支持 deferred plan，在最后一个参与者提交时执行布局计划。Demo 与 Gugu-web 的浮动抽屉接入已移除重复的高度/FLIP 编排。

## 目标

同一布局根节点在同一轮交互中只产生一笔布局事务。组切换、卡片落地和 Surface 尺寸变化应合并后再统一测量与播放，避免旧事务回写新高度。

## 规则

- 同一个 `root` 上的未完成事务会合并原因和 mutation。
- `move`、`group-toggle` 属于交互事务，优先级高于 `surface-observer`。
- Observer 只能加入已有事务，不能覆盖交互优先级。
- 事务参与者提交或取消后不可再次结束事务；旧参与者令牌不能结束后续新事务。
- 事务协调器只收集意图，不读取 DOM、不写样式、不启动动画。
- 旧事务的动画回调必须在后续阶段通过 token/事务 ID 校验后才能写回。

## 接口

```ts
const tx = runtime.layout.begin(root, 'group-toggle')
runtime.layout.request(root, { type: 'open-group', status: 'pending' })
runtime.layout.begin(root, 'move', 'interaction')
runtime.layout.request(root, { type: 'move-card', objectId: 'card-1' })
const committed = runtime.layout.commit(root)
```

## 实施记录

### Phase 0：契约收口

- [x] 定义事务根节点、事务原因和交互/observer 优先级。
- [x] 明确 observer 不得覆盖交互事务，也不得独立启动第二条交互动画。
- [x] 明确旧参与者 token 不能结束后续新事务。

### Phase 1：协调器与测试骨架

- [x] 新增 `LayoutTransactionCoordinator`。
- [x] 支持同一根节点合并原因、mutation 和优先级。
- [x] 支持参与者计数、提交、取消和 token 校验。
- [x] 增加合并、优先级、生命周期和旧 token 回归测试。

### Phase 2：交互入口接入

- [x] `runGroupToggle()` 登记 `group-toggle` 参与者。
- [x] detach/clone 移动布局 capture/play/cancel 登记 `move` 参与者。
- [x] 保留现有 FLIP 测量和动画行为，先只统一事务边界。
- [x] 验证 group-toggle 与 move 同根并发时不会互相提前结束事务。

### Phase 3：Surface observer 收敛

- [x] `useSurface` 的 ResizeObserver 以 `surface-observer` 低优先级登记 mutation。
- [x] 交互事务 active 时 observer 只加入并立即提交，不直接调用高度动画。
- [x] 没有交互事务时 observer 才执行自然尺寸补偿动画。
- [x] 保留 ResizeObserver 的节流、generation 保护和卸载清理。
- [x] 增加 observer 与交互事务并发时不启动第二条 Surface 动画的回归测试。

### Phase 4：统一测量提交器

- [x] 将 group、move、observer 的动画意图登记为带类型的事务 `LayoutPlan`（`group-flip` / `move-flip` / `surface-resize`）。
- [x] 在最后一个参与者提交时统一执行 deferred plan，避免入口提前播放。
- [x] 为 deferred plan 增加参与者 token 校验，旧参与者不能提交或执行新事务计划。
- [x] deferred plan 绑定参与者；参与者取消时只丢弃自己的计划，不影响其他参与者。
- [x] `LayoutPlan` 记录 `queued/running/completed/cancelled/failed` 生命周期。
- [x] 单个计划失败时继续执行同一事务中的后续计划，并把错误抛回提交调用方。
- [x] 提供事务快照，记录当前计划队列及其生命周期，便于调试和性能观测。
- [x] 增加 1000 次合并事务的轻量基线，防止协调器引入明显的同步开销。
- [x] 通过 Runtime 浏览器 E2E 验证移动 FLIP、无效落点回飞、regrab 和文件系统布局回归路径。
- [x] 保留现有 `surfaceResizeStates`、group token 和 move layout token，避免改变已验证的测量/清理语义。
- [x] 增加“最后参与者提交才执行计划”和“旧 token 不能覆盖新事务”的回归测试。
- [x] 将多入口的 before/after DOM 测量计划收敛为独立 `LayoutPlan` 数据结构。
- [x] 建立统一 plan token 管理高度、Relative FLIP、presence 和 scroll compensation 的计划入口；具体动画内部 token 继续负责自身清理。
- [x] 使用现有 Runtime 浏览器 E2E 作为真实布局行为基线，并保留单元级 1000 次事务协调器性能基线。

### Phase 5：业务侧收敛与发布

- [x] 清理 Demo 抽屉的 ResizeObserver、自然高度缓存和手写高度过渡；改由 `useSurface({ floating })` 统一测量和动画。
- [x] 清理 Gugu 画布抽屉的 JS 高度同步和重复分组高度编排；业务侧只保留 `data-layout-open`、分组状态和 `runGroupToggle()` 调用。
- [x] 保留业务真正拥有的内容显隐、滚动状态、数据 Store 和列表自身的独立 FLIP，不把业务状态误迁入 Runtime。
- [x] 为 Vue 适配层补充事务接入指南、错误处理约定和迁移边界。
- [x] 更新 Demo、Gugu 文件系统、看板、画布抽屉的接入说明。
- [x] 完成 Runtime typecheck、unit、build，以及 Gugu 前端 typecheck。
- [x] 更新版本号、CHANGELOG 和迁移说明。

## 当前风险边界

- Phase 3 只改变 observer 在交互事务期间的调度方式，不改变自然高度计算公式。
- Phase 4 才会合并测量和动画状态；在此之前不能删除现有 token、surface resize 或 group animation 清理逻辑。
- 任何测试失败都必须先核对实现与测试夹具，禁止通过删除断言、跳过用例或放宽校验来恢复绿色。
