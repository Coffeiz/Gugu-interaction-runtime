# Vue 接入指南

> 状态：Vue 适配层已完成并作为 `gugu-interaction-runtime/vue` 正式导出（2026-08-11）。
>
> 本文记录稳定的 Vue 适配层 API。Core API 的完整契约仍以
> [../INTEGRATION.md](../INTEGRATION.md) 为准。
>
> 分阶段执行计划见 [VUE_IMPLEMENTATION_PLAN.md](./VUE_IMPLEMENTATION_PLAN.md)。

## 目标

Vue 业务组件只声明 Object、Surface、Target，不手写注册、DOM 同步、响应式
`surfaceId` 更新、generation 校验或卸载注销逻辑。

```text
Vue composable
    ↓
Vue DOM / lifecycle adapter
    ↓
Runtime Core
```

Vue 适配层只负责把 Vue 的组件生命周期和 DOM ref 映射到 Core API，不实现拖拽、命中、
proxy、landing、reveal、FLIP 或业务 Store。

## 兼容基线

旧版可用 API 来自 `f4ea296` 的父提交（对应历史 Vue 适配层）：

- `useObject(options)`：返回 `elementRef`，监听 Object 所在 Surface，并在卸载时注销；
- `useSurface(options)`：返回 `elementRef`，监听 Surface DOM，并在卸载时注销；
- `useTarget(options)`：返回 `elementRef`，管理语义 Target 的响应式字段和生命周期；
- `useRuntimeAction(handler)` / `useRuntimeTransition(surfaceId)`：管理 Action 与 ownership 订阅。

新实现应尽量保留这三个 API 的认知形状。旧版 `useObject` 已经包含 generation
和旧节点解绑保护，新实现必须保留并继续扩展这套保护，而不是重新发明一套更弱的
注销逻辑。

其中 `useObject`、`useSurface`、`useTarget` 和 `useRuntimeTransition` 已完成 generation
保护、响应式更新和卸载清理；历史实现仅作为兼容行为基线。

## 目标 API

### Object

```ts
const { elementRef } = useObject({
  id: `project:${project.id}`,
  type: 'project-card',
  surface: () => `column:${project.status}`,
  abilities: ['move', 'sort'],
  visualMode: 'detach',
})
```

```vue
<div ref="elementRef" class="project-card" />
```

`surface` 继续支持 getter，以便业务状态改变时自动更新 Object 的归属。

### Surface

```ts
const { elementRef } = useSurface({
  id: `column:${status}`,
  type: 'project-column',
  accepts: ['project-card'],
})
```

当命中区域和实际需要做布局 FLIP 的元素不是同一个节点时，可以额外声明：

```ts
const { elementRef } = useSurface({
  id: 'mind:drawer',
  type: 'mind-drawer',
  accepts: ['project-card'],
  layoutElement: () => viewportRef.value,
  measureLayout: () => ({ height: contentRef.value?.scrollHeight ?? 0 }),
})
```

`elementRef` 仍是命中区域；`layoutElement` 是 Runtime 捕获和播放 Surface
FLIP 的元素；`measureLayout` 返回内容变化后的自然高度。抽屉、固定高度 viewport
等场景应使用这两个声明，不能再由业务在拖拽回调里重复驱动高度动画。Runtime 会在
布局事务中读取自然尺寸、执行 resize，并在事务结束后保留目标高度、清理其余临时样式。

浮动 Surface 可以使用 Vue 适配层的自动发现能力：

```ts
const { elementRef } = useSurface({
  id: 'mind:drawer',
  type: 'mind-drawer',
  accepts: ['mind-project-object'],
  layout: 'grid',
  floating: {
    open: () => expanded.value,
    scrollKey: () => panel.value,
    maxHeight: () => window.innerHeight * 0.55,
  },
})
```

根节点下标注 `data-layout-role="viewport"` 的节点会作为布局节点，
`data-drawer-scroll="projects"` 会作为真实滚动视口。显式传入的
`layoutElement`、`viewport`、`measureLayout` 优先于自动发现；复杂 DOM 拓扑不应依赖
适配层猜测。`floating` 只属于 Vue 接入层，不改变 Core 的 grid/free 或 landing 语义。
提供 `open` 后，浮动 Surface 的自然高度、限高和开合动画也由 Runtime 统一管理；业务组件
不应再维护 `panelHeights`、`measurePanel`、`ResizeObserver` 或直接调用高度过渡函数。

### Target

新增与 `useSurface` 同形状的 `useTarget`，用于面包屑、文件夹等没有独立 Object
身份的语义落点：

```ts
const { elementRef } = useTarget({
  id: `breadcrumb:${folder.id}`,
  surfaceId: `file:surface:${folder.id}`,
  accepts: ['file-item', 'folder-item'],
  priority: 1,
})
```

`useTarget` 已满足以下实现条件：

- `TargetStore.register()` 返回 generation；
- `TargetItem` 能记录当前 generation，或 Store 能提供等价的代次查询；
- TargetStore 提供 `update(id, patch)`，支持响应式更新 `surfaceId`、`accepts`、
  `priority` 和 `resolve`；
- `setElement()` 继续作为 DOM ref 的增量更新入口；
- 旧组件卸载时只能注销自己注册的 generation。

不能通过“字段变化时先 unregister 再 register”替代 `update()`，因为拖拽期间需要
保持 Target 的身份连续性。

### Action 与 Transition

```ts
useRuntimeAction(action => {
  store.applyMove(action)
})

const { controlled } = useRuntimeTransition(`column:${status}`)
```

Action 订阅由适配层自动在组件卸载时解除。Transition composable 只负责把 ownership
状态映射成 Vue 可消费的响应式值，不重新实现动画。

### Node / Connection

画布卡片可以直接在 `useObject` 中声明端口，端口位置不需要业务保存屏幕坐标：

```ts
const card = useObject({
  id: `canvas:card:${id}`,
  type: 'canvas-card',
  surface: 'canvas:main',
  abilities: ['move', 'link'],
  node: {
    ports: [
      { id: 'left', side: 'left', position: 0.5 },
      { id: 'right', side: 'right', position: 0.5 },
    ],
  },
})
```

Runtime 提供 `getNodePorts()`、`hitNodePort()`、`beginNodeConnection()`、
`updateNodeConnection()`、`finishNodeConnection()` 和 `cancelNodeConnection()`；它们每次
从当前 DOMRect 计算端点，覆盖卡片移动、尺寸变化和相机变换后的几何变化。创建、取消、删除
通过 `connection-create`、`connection-cancel`、`connection-delete` Action 输出，Vue 侧只需
用 `useRuntimeAction()` 接收并持久化；SVG 线条仍由业务 RelationLayer 绘制。

已有关系可在初始化或数据同步时调用 `registerNodeConnection()`，关系删除时调用
`unregisterNodeConnection()`，避免只依赖当前连接会话做重复校验。

## 生命周期要求

每个使用 `useObject` 或 `useSurface` 的资源必须属于自己的 Vue 组件实例。对于父组件
模板中直接渲染的裸 `v-for` 节点，应先拆成 `FileListRow`、`FolderListRow` 等组件，
再在行组件中使用 composable。

适配层必须保证：

1. setup 阶段登记静态身份，DOM 挂载后同步 element；
2. 响应式配置变化只更新对应字段，不重复注册；
3. 每次注册保留 generation；
4. 卸载时只注销属于当前 generation 的资源；
5. Vue 旧节点的异步卸载回调不能清理同 ID 的新节点；
6. `elementRef` 为 `null` 时安全解绑，不触发错误 fallback。

## 不兼容旧实现的修正

旧版实现使用全局 `runtime`，新版本应改为接收 Runtime 实例，或通过明确的 Vue
provider 注入实例。旧版已经用 Core 返回的 generation 防止旧组件注销新组件，
新实现必须保留这条语义，并继续覆盖 element 解绑和 Surface/Target 更新场景。

Target 仍作为独立资源处理，不能隐式塞入 Object 配置。文件 Demo 已用该 API 接入面包屑
和文件夹目标，Gugu-web 文件库与项目文件面板也按同一生命周期约束接入。

## 列表组件约束

列表视图不能在父组件的裸 `v-for` 中为每一项调用 composable。迁移时应先提取：

- `FileListRow.vue`
- `FolderListRow.vue`
- `BreadcrumbItem.vue`（如果面包屑需要独立 Target 生命周期）

这些组件只负责保留现有模板、样式和 DOM 结构，并把 Runtime 资源声明放到自己的
`setup()` 中。本次适配层工作不改变卡片视觉、拖拽手感和业务操作。

## 暂不冻结的内容

- 是否提供 `v-runtime-object` / `v-runtime-surface` 指令；
- 是否进一步简化 `provide/inject` 的业务封装；
- 列表行组件的最终拆分粒度；
- Group Session、多选拖拽的业务级封装；通用 Group API 本身已经稳定，不再属于 Vue 适配层阻塞项。

这些内容等 Gugu-web 接入侧的视觉和拖拽效果稳定后再定稿。

## 验收基线

- 看板、网格文件卡和列表文件卡均能只通过 composable 接入；
- Surface 改变时 Object 不重复注册；
- Vue 重渲染、跨列移动、landing regrab 不出现旧节点清理新节点；
- Object、Surface、Target 卸载后 Core 注册表无残留；
- Transition 在 Runtime 接管期间关闭，交接后恢复；
- 现有浏览器视觉回归和 Runtime 单测保持通过。

## 正式导入

```ts
import { provideRuntime, useObject, useSurface, useTarget } from 'gugu-interaction-runtime/vue'
```

Core 主入口仍保留低层 `createVueRuntimeAdapter()` 兼容入口，用于布局事务和旧接入迁移；
新 Vue 业务组件优先使用本入口的 composable，不直接依赖 `src/` 路径。

## 实施结果

- [x] 恢复历史 Vue composable 的 API 形状，并保留 generation 安全；
- [x] 为 TargetStore 增加 generation、`update()` 和对应 Core 单测；
- [x] 实现 `useTarget`，覆盖 DOM 绑定、响应式字段更新和卸载保护；
- [x] 将看板、网格文件卡、列表行和面包屑按组件生命周期迁移；
- [x] 完成 Demo 与 Gugu-web 的视觉、拖拽和 regrab 回归，冻结当前 Vue API。

后续新增 Vue 业务只应复用 `gugu-interaction-runtime/vue` 的 composable；
`createVueRuntimeAdapter()` 仅保留给低层布局事务和兼容迁移，不作为新的业务注册协议。
