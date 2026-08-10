# Vue 接入指南（设计基线）

> 状态：设计草案，暂不作为 2.0.0 的正式导出 API。
>
> 本文记录下一版 Vue 适配层的目标形状。Core API 的完整契约仍以
> [../INTEGRATION.md](../INTEGRATION.md) 为准。

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
- `useRuntimeTransition(surfaceId)`：把 Runtime ownership 状态提供给 Vue Transition。

新实现应尽量保留这三个 API 的认知形状。旧版 `useObject` 已经包含 generation
和旧节点解绑保护，新实现必须保留并继续扩展这套保护，而不是重新发明一套更弱的
注销逻辑。

其中 `useObject`、`useSurface` 和 `useRuntimeTransition` 可以直接以历史实现作为
兼容基线；`useTarget` 需要等待 Core 的 TargetStore 先补齐生命周期能力后再实现。

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

`useTarget` 的实现前置条件：

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

旧版没有 `useTarget`，Target 仍需作为独立资源处理，不能隐式塞入 Object 配置。
实现顺序固定为：先恢复历史 `useObject/useSurface/useRuntimeTransition` 的可用形状，
再补 TargetStore 的 generation/update，最后实现 `useTarget`。

## 列表组件约束

列表视图不能在父组件的裸 `v-for` 中为每一项调用 composable。迁移时应先提取：

- `FileListRow.vue`
- `FolderListRow.vue`
- `BreadcrumbItem.vue`（如果面包屑需要独立 Target 生命周期）

这些组件只负责保留现有模板、样式和 DOM 结构，并把 Runtime 资源声明放到自己的
`setup()` 中。本次适配层工作不改变卡片视觉、拖拽手感和业务操作。

## 暂不冻结的内容

- 是否提供 `v-runtime-object` / `v-runtime-surface` 指令；
- 是否通过 `provide/inject` 注入 Runtime；
- 列表行组件的最终拆分粒度；
- Group Session、多选拖拽和业务级布局 mutation 的 Vue 封装。

这些内容等 Gugu-web 接入侧的视觉和拖拽效果稳定后再定稿。

## 验收基线

- 看板、网格文件卡和列表文件卡均能只通过 composable 接入；
- Surface 改变时 Object 不重复注册；
- Vue 重渲染、跨列移动、landing regrab 不出现旧节点清理新节点；
- Object、Surface、Target 卸载后 Core 注册表无残留；
- Transition 在 Runtime 接管期间关闭，交接后恢复；
- 现有浏览器视觉回归和 Runtime 单测保持通过。

## 实施顺序

1. 恢复历史 Vue composable 的 API 形状，但接收 Runtime 实例并保留 generation 安全；
2. 为 TargetStore 增加 generation、`update()` 和对应 Core 单测；
3. 实现 `useTarget`，覆盖 DOM 绑定、响应式字段更新和卸载保护；
4. 将看板、网格文件卡、列表行和面包屑按组件生命周期逐步迁移；
5. 等 Gugu-web 的视觉、拖拽和 regrab 效果稳定后，再冻结 Vue 指南和正式导出路径。
