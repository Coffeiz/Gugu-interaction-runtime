# Vue 适配层实施计划

> 状态：Phase 6 已完成，文件系统 Demo 与 Gugu-web 文件业务接入已完成，后续进入适配层维护与业务接入
>
> 本文是 Vue 适配层的执行计划。Vue API 的设计基线见
> [VUE.md](../../integration/VUE.md)，框架无关的 Core API 仍以
> [INTEGRATION.md](../../INTEGRATION.md) 为准。

当前进度：Phase 0 至 Phase 6 已完成；后续只做兼容性维护和业务接入。

## 目标

让 Vue 业务组件只声明 Runtime 资源和业务数据，不再手写以下胶水逻辑：

- Object、Surface、Target 注册和注销；
- DOM ref 与 Runtime 注册表同步；
- `surfaceId`、`accepts`、`priority` 等响应式字段更新；
- generation 判断和旧节点解绑保护；
- Action 订阅和 ownership 订阅的卸载清理；
- 列表项变化时的注册表增量同步。

目标接入形状：

```ts
provideRuntime(runtime)

const { elementRef } = useObject({
  id: `project:${project.id}`,
  type: 'project-card',
  surface: () => `column:${project.status}`,
  abilities: ['move', 'sort'],
})
```

```vue
<div ref="elementRef" class="project-card" />
```

业务侧最终只保留：

1. 业务数据到 Runtime 描述符的映射；
2. `useObject`、`useSurface`、`useTarget` 声明；
3. Action 到业务 Store 的处理；
4. 业务专属的布局变化和视觉配置。

拖拽输入、命中、FLIP、proxy、landing、reveal、regrab 和清理继续由 Runtime Core 负责。

## 非目标

本轮不做以下内容：

- 不修改拖拽物理参数和现有动画曲线；
- 不重写 `DetachAdapter`、`DetachMoveDriver` 或视觉代理结构；
- 不改变 Demo 的 CSS、卡片尺寸、Teleport 拓扑和视觉样式；
- 不为 Vue 重新实现拖拽、命中或 landing 语义；
- 不引入 `v-runtime-object` 等指令语法；
- 不在 Vue 适配层重新实现 Group Session、多选拖拽和业务级批量操作；Group Session 已由 Core
  提供，业务侧只消费标准 `move-group` Action。
- 不把 Vue 类型或生命周期引入 Core 模块。

## 目标目录

```text
src/vue/
  context.ts                 # Runtime provide/inject
  useObject.ts               # Object 声明与生命周期
  useSurface.ts              # Surface 声明与生命周期
  useTarget.ts               # Target 声明与生命周期
  useRuntimeAction.ts        # Action 订阅
  useRuntimeTransition.ts    # ownership 到 Vue 响应式状态
  useRuntimeLayoutMutation.ts# 可选的布局事务封装
  index.ts                   # Vue 入口导出

src/adapters/
  dom.ts                     # 框架无关的低层 DOM 适配器
  vue.ts                     # 迁移期兼容入口

src/demo/kanban/
  KanbanColumn.vue           # Surface 生命周期
  KanbanCard.vue             # Object 生命周期
  KanbanGroup.vue            # 分组展示和布局交互

src/demo/files/
  FileBrowserSurface.vue     # 浏览区域 Surface
  FileItemCard.vue           # 文件/文件夹 Object
  FolderSidebarItem.vue      # 文件夹 Surface/Target
  BreadcrumbItem.vue         # 面包屑 Target
```

正式 Vue API 从独立入口导出：

```text
gugu-interaction-runtime
gugu-interaction-runtime/vue
```

Core 主入口不直接导出 Vue composable，避免框架生命周期进入框架无关 API。

## 生命周期约束

每个 `useObject`、`useSurface`、`useTarget` 必须属于独立的 Vue 组件实例。

因此父组件不能在裸 `v-for` 节点上直接调用 composable。列表迁移前必须先拆出行组件，
例如 `FileItemCard.vue`、`BreadcrumbItem.vue`。这是 generation 安全和卸载时序正确的前提。

适配层必须保证：

1. setup 阶段注册静态身份；
2. DOM 挂载后同步 `element`；
3. 响应式配置变化调用 Store 的增量更新；
4. 每次注册保存 generation；
5. 旧实例卸载时不能注销新实例；
6. `elementRef` 变为 `null` 时只解绑自己的旧节点；
7. 组件卸载后不残留 Object、Surface、Target 或订阅。

## Core 前置工作

当前 ObjectStore 已有 generation，但 SurfaceStore 和 TargetStore 还没有完整的生命周期
保护。实现 composable 前先完成以下 Core 能力。

### ObjectStore

- 增加通用 `update(id, patch)`；
- 保留现有 `setElement`、`setSurface` 的兼容入口；
- 支持更新 `type`、`abilities`、`visual`、`visualMode` 和 `target`；
- 不因响应式字段变化重复 register。

### SurfaceStore

- `register()` 返回 generation；
- SurfaceItem 记录 generation；
- 增加 `update(id, patch)`；
- 保留 `setElement()` 作为 ref 同步入口；
- 旧组件只能注销自己注册的 generation。

### TargetStore

- `register()` 返回 generation；
- TargetItem 记录 generation；
- 增加 `update(id, patch)`；
- 支持更新 `surfaceId`、`accepts`、`priority` 和 `resolve`；
- `setElement()` 只负责 DOM 引用更新；
- 不使用“先 unregister 再 register”模拟响应式更新，避免拖拽期间 Target 身份断裂。

## Vue API

### `useObject`

负责 Object 注册、Surface 变化、DOM ref 和卸载保护。

```ts
const { elementRef } = useObject({
  id,
  type,
  surface: () => surfaceId,
  abilities: ['move', 'sort'],
  visual,
  visualMode,
  target,
})
```

`surface`、能力和 target 配置可以是响应式 getter，但更新只调用 Store 的 patch 接口。

### `useSurface`

负责 Surface 注册、DOM ref、视口 getter 和卸载保护。

```ts
const { elementRef } = useSurface({
  id,
  type,
  accepts,
  viewport,
  motion,
})
```

### `useTarget`

负责没有独立 Object 身份的语义落点，例如面包屑和侧栏文件夹。

```ts
const { elementRef } = useTarget({
  id,
  surfaceId,
  accepts,
  priority,
})
```

### Action 与 ownership

```ts
useRuntimeAction(action => {
  if (action.type === 'move') store.applyMove(action)
})

const { controlled } = useRuntimeTransition(surfaceId)
```

这两个 composable 自动在组件卸载时解除订阅，不修改 Action 或 ownership 的 Core 语义。

### 布局事务

`runLayoutMutation` 先保留在低层 DOM adapter，等 Kanban 和 FileSystem 都完成迁移后，
再决定是否提供：

```ts
const { runLayoutMutation } = useRuntimeLayoutMutation()
```

它只封装“捕获布局、执行业务 mutation、等待 Vue patch、播放布局”，不负责拖拽动画。

## 分阶段实施

### Phase 0：基线与 API 冻结 ✅

内容：

- 固定 `useObject/useSurface/useTarget` 的参数形状；
- 固定 Runtime provider 方式；
- 确定 Vue 入口为 `gugu-interaction-runtime/vue`；
- 为当前 Demo 增加 Object、Surface、Target 残留检查；
- 记录 Kanban 和 FileSystem 的现有 E2E 基线。

已完成：

- 冻结 `provideRuntime`、`useObject`、`useSurface`、`useTarget` 的目标形状；
- 确定 Vue 独立入口为 `gugu-interaction-runtime/vue`；
- 保留旧版 generation 和旧节点解绑保护作为兼容基线；
- 明确列表项必须拆成独立 Vue 组件；
- 记录当前 Demo 迁移边界和回滚策略。

### Phase 1：Core 生命周期能力 ✅

内容：

- 补齐 ObjectStore、SurfaceStore、TargetStore 的 update/generation；
- 补齐 generation 竞态、重复注册和空 ref 单测；
- 不迁移 Demo，不修改动画代码。

已完成：

- ObjectStore、SurfaceStore、TargetStore 均支持 generation；
- 三个 Store 均支持 generation 安全的 `unregister(id, generation)`；
- Object、Surface、Target 均支持增量 `update()`；
- Object 内嵌 Target 后续更新不再重复 register；
- 新增生命周期和身份连续性回归测试。

### Phase 2：实现 Vue composables ✅

内容：

- 新增 `src/vue/`；
- 实现 provider、Object、Surface、Target、Action、Transition；
- 复用旧版 `useObject/useSurface` 的 generation 和解绑保护；
- 为每个 composable 增加生命周期单测。

已完成：

- 新增 `src/vue/` provider、Object、Surface、Target、Action、Transition composable；
- composable 保留 generation 和旧节点解绑保护；
- 最小 Vue fixture 覆盖注册、DOM ref、响应式更新和卸载；
- 覆盖同 ID 新旧组件交替挂载，旧组件不能清理新组件；
- 当前 typecheck 和 77 个单元测试保持通过。

### Phase 3：迁移 Kanban Demo ✅

先拆组件，再迁移注册逻辑：

1. 提取 `KanbanColumn.vue`；
2. 提取 `KanbanCard.vue`；
3. 卡片接入 `useObject`；
4. 列接入 `useSurface`；
5. Action 和 ownership 接入 composable；
6. 保留分组展开、Teleport、布局事务和现有 CSS。

完成标准：

- detach/clone 都能拖拽；
- 跨列、同列、列尾、分组折叠、regrab 行为不变；
- Demo 不再手写 generation、setElement 和 Object 注销。

已完成：

- 新增 `KanbanColumn.vue`，用 `useSurface` 管理列的注册、DOM ref、ownership 和卸载；
- 新增 `KanbanCard.vue`，用 `useObject` 管理卡片 descriptor、DOM ref、generation 和 Teleport；
- `KanbanBoard.vue` 改为只负责分组、布局事务和 Action 到业务 Store 的编排；
- Action 和列 ownership 改用 `useRuntimeAction`、`useRuntimeTransition`；
- Runtime provider 提升到 `App.vue`，确保看板子组件共享同一个 Runtime；
- 保留原有 detach/clone、分组、Teleport、CSS 和 motion 配置；
- 看板拖拽 6 条 E2E、文件系统 2 条回归 E2E 通过，typecheck 和单元测试保持通过。

### Phase 4：迁移 FileSystem Demo

迁移顺序：

1. 提取 `FileItemCard.vue`，统一网格和列表视图；
2. 提取 `FileBrowserSurface.vue`；
3. 提取 `FolderSidebarItem.vue`；
4. 提取 `BreadcrumbItem.vue`；
5. 文件/文件夹接入 `useObject`；
6. 浏览区域和文件夹区域接入 `useSurface`；
7. 侧栏和面包屑接入 `useTarget`；
8. 删除 `objectGenerations`、bind 函数和手写 Target ID 映射。

完成标准：

- 网格/列表样式完全不变；
- file/folder clone 和 detach 的抓取、落地、缩小、面包屑目标动画不变；
- 文件夹 Target、面包屑 Target、浏览区域 Surface 卸载后无残留；
- 目录切换仍正确播放布局动画。

已完成：

- 新增 `FileItemCard.vue`，用 `useObject` 管理文件/文件夹 Object、对象目标和 DOM ref；
- 新增 `FileBrowserSurface.vue`，用 `useSurface` 管理浏览区域；
- 新增 `FolderSidebarItem.vue` 和 `BreadcrumbItem.vue`，分别用 `useSurface` 与 `useTarget` 管理目录目标；
- `FileSystemDemo.vue` 删除手写 generation、Object/Surface/Target 注册、ref 绑定和 Action 清理；
- `createVueRuntimeAdapter` 仅保留布局 mutation 与 adapter dispose，不再负责 Runtime 注册表同步；
- 保留网格/列表布局、proxy compact 样式、文件夹循环保护、面包屑落点和现有视觉配置；
- FileSystem 两条既有 E2E、typecheck 和单元测试通过。

### Phase 5：适配层收敛

内容：

- Demo 默认使用 Vue composable；
- `createVueRuntimeAdapter` 降级为低层兼容入口；
- 评估 `useRuntimeLayoutMutation` 是否稳定；
- 删除 Demo 中已经没有调用方的注册、ref、watch 和清理代码；
- 不删除 Core API，不改变动画实现。

完成标准：

- Demo 业务组件只保留声明式 Runtime 接入和业务 Store；
- 没有重复的 generation、DOM ref 同步和 ownership 订阅；
- 代码删除经过 typecheck 和 E2E 验证。

已完成：

- Demo 的对象、Surface、Target、Action 和 ownership 接入均由 Vue composable 负责；
- `createVueRuntimeAdapter` 仅保留布局事务与低层 DOM 兼容能力；
- 跨 Surface 移动时对象注册延迟到 session 结束再注销，避免 Vue 重排导致 landing 丢失对象配置；
- 保留 Core API 和现有动画实现，不改变业务视觉行为。

### Phase 6：正式导出与文档收口

内容：

- 导出 `gugu-interaction-runtime/vue`；
- 更新 `docs/integration/VUE.md` 为正式指南；
- 更新 `docs/INTEGRATION.md` 的 Vue 入口链接；
- 增加安装、provider、SSR/测试环境说明；
- 保留低层 DOM adapter 的迁移说明。

完成标准：

- package build 可以生成 Core 和 Vue 两个入口；
- Demo 从正式 Vue 入口编译；
- Runtime Core 不依赖 Vue；
- 文档示例与实际导出 API 一致。

已完成：

- 增加 `gugu-interaction-runtime/vue` package export；
- 库构建增加 `vue` 独立入口并生成对应类型声明；
- `VUE.md` 更新为正式接入指南，保留低层 adapter 迁移说明；
- Core 主入口不直接依赖 Vue composable。

## 测试清单

### Core 单测

- Object/Surface/Target generation 递增；
- 旧实例 unregister 不影响新实例；
- `update()` 不改变注册身份；
- Target 更新期间仍可命中；
- 空 element 解绑安全；
- 重复注册和重复卸载幂等；
- Store 清理后无残留。

### Vue 适配层单测

- setup 注册；
- ref 挂载和卸载；
- 响应式 surface 更新；
- 响应式 Target 字段更新；
- 组件快速重挂载；
- 跨列 Vue patch 顺序；
- Action/ownership 自动解除订阅。

### Demo E2E

- Kanban detach/clone 跨列拖拽；
- Kanban 分组展开和折叠；
- FileSystem 网格/列表切换；
- 文件和文件夹拖到侧栏；
- 文件和文件夹拖到面包屑；
- clone/detach 目标落地动画；
- 快速连续抓起、松手和 regrab；
- Demo 页面卸载后 Runtime 注册表清空。

## 风险与回滚

- 每个 Phase 独立提交，不混入视觉调整；
- 先迁移 Kanban，再迁移 FileSystem；
- 组件拆分提交与 composable 接入提交分开；
- 任何动画回归优先回滚 Demo 接入层，不回滚 Core 物理代码；
- 发现列表行生命周期问题时，停止迁移并先补独立行组件；
- `createVueRuntimeAdapter` 在 Phase 5 前保留，确保可以快速回退；
- 不使用 fallback 掩盖注册失败，缺少 provider、Object 或 Surface 时直接抛出开发期错误。

## 当前状态

| 模块 | 状态 |
| --- | --- |
| Core Object generation | 已有，待 composable 接入 |
| Surface generation/update | 已完成 |
| Target generation/update | 已完成 |
| `createVueRuntimeAdapter` | 已有低层实现 |
| `useObject/useSurface` | 已实现，Kanban/FileSystem Demo 已迁移 |
| `useTarget` | 已实现，FileSystem Demo 已迁移 |
| Vue Action/Transition composable | 已实现 |
| Kanban Demo composable 接入 | 已完成 |
| FileSystem Demo composable 接入 | 已完成 |
| Vue 独立导出入口 | 已完成 |
