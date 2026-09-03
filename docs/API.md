# Core API 参考

> 适用版本：3.0.6

本文是 `gugu-interaction-runtime` 的公开接口索引。它按接入顺序组织，适合在已经
理解基本模型后查找字段和方法。完整示例见 [接入指南](./INTEGRATION.md)，Vue
组件优先使用 [Vue 接入指南](./integration/VUE.md)。

## 1. 核心模型

Runtime 只保存交互所需的身份、DOM 和几何描述，不保存项目、文件、权限或连接关系。

```text
Object     可被抓取、排序、移动或连接的对象
Surface    对象所在的列表、画布或其他布局区域
Target     没有 Object 身份、但可以接收落点的语义目标
Session    一次拖拽、连接或其他交互的生命周期
Action     Runtime 完成交互后交给业务 Store 的结果
```

业务通常只需要注册 Object/Surface/Target，绑定 DOM，监听 Action，并在业务 Store
中保存结果。Runtime 负责命中、跟手、代理、landing、reveal、FLIP、滚动和清理。

## 2. 导入入口

### Core

```ts
import { runtime, Runtime } from 'gugu-interaction-runtime'
```

主入口同时导出注册表、Session、Action、VisualAdapter、布局和运动相关类型。
应用级单例使用 `runtime`；需要隔离测试或多实例时使用 `new Runtime()`。

### Vue

```ts
import {
  provideRuntime,
  useObject,
  useSurface,
  useTarget,
  useRuntimeAction,
} from 'gugu-interaction-runtime/vue'
```

Vue composable 负责 ref、响应式字段更新、generation 和卸载保护；业务仍直接声明
Runtime 语义，不通过组件事件拼装另一套拖拽协议。

## 3. 注册对象与区域

### Object

```ts
const generation = runtime.objects.register({
  id: 'project:123',
  type: 'project-card',
  surfaceId: 'column:active',
  element: cardElement,
  abilities: ['move', 'sort'],
  selected: false,
})
```

`ObjectItem` 字段：

| 字段 | 说明 |
| --- | --- |
| `id` | 全局唯一业务标识，建议带业务 scope。 |
| `type` | 对象类型，必须与可接收它的 Surface/Target 约定一致。 |
| `surfaceId` | 当前所在 Surface。对象移动后由业务更新。 |
| `element` | 真实 DOM；没有 DOM 时传 `null`，之后用 `setElement()` 绑定。 |
| `abilities` | 能力名；包含 `move` 才能参与移动，其他能力由业务和 Runtime 约定。 |
| `selected` | 是否参与多选拖拽。 |
| `visual` / `visualMode` | 可选视觉适配器名和策略覆盖。默认策略为 `detach`。 |
| `target` | 对象同时作为落点时的 Target 描述。 |
| `node` | 画布端口声明。 |

对象注册会返回 `generation`。组件卸载时应按 generation 注销，避免旧 DOM 实例误删
同 ID 的新注册：

```ts
runtime.objects.unregister('project:123', generation)
```

常用更新方法：`get()`、`has()`、`setElement()`、`setSurface()`、`update()`、
`snapshot()`、`subscribe()`、`hasAbility()`。

### Surface

```ts
runtime.surfaces.register({
  id: 'column:active',
  type: 'project-column',
  element: columnElement,
  accepts: ['project-card'],
  layout: 'grid',
})
```

`Surface` 字段：

| 字段 | 说明 |
| --- | --- |
| `id` / `type` | 区域身份和语义类型。 |
| `element` | 命中边界节点。 |
| `accepts` | 可接受的 Object 类型；空数组表示不限制。 |
| `layout` | `grid` 表示列表落位，`free` 表示连续坐标画布。 |
| `layoutElement` | 可选，实际参与 FLIP/resize 的节点。 |
| `measureLayout` | 可选，返回固定外壳背后的自然尺寸。 |
| `viewport` | 可选，真实滚动视口，用于目标可见性和自动滚动。 |
| `camera` | 可选的画布缩放和原点描述。 |
| `motion` | 可选的 Surface resize 运动参数。 |

`layoutElement`、`measureLayout` 和 `viewport` 用于浮动 Surface 或复杂 DOM 拓扑；
命中仍使用 `element`。更新方法为 `get()`、`has()`、`setElement()`、`update()`、
`accepts()`、`snapshot()` 和 `subscribe()`。

### Target

Target 适合面包屑、文件夹、垃圾桶等没有独立 Object 身份的落点：

```ts
runtime.targets.register({
  id: 'folder:456',
  surfaceId: 'files:root',
  element: folderElement,
  accepts: ['file-item'],
  priority: 10,
  resolve: () => ({ folderId: 456 }),
})
```

`resolve()` 返回的数据会随 Action 的目标语义提供给业务。常用方法为 `get()`、
`setElement()`、`update()`、`findForSurface()`、`unregister()`、`snapshot()` 和
`subscribe()`。

## 4. 选择视觉与运动策略

### 对象类型

通过 `registerObjectType(type, registration)` 一次声明类型级策略：

```ts
runtime.registerObjectType('project-card', {
  defaultVisualMode: 'detach',
  motion: { enabled: true },
  affordances: { selector: '[data-card-affordances]' },
  releaseMode: 'physical',
  grabAlign: { align: 'pointer' },
})
```

常用配置包括 `visual`、`groupVisual`、`motion`、`releaseMode`、`grabAlign`、
`proxyLayout`、`proxyZIndex`、`landingProxyZIndex`、`pointerInput`、
`resolveMoveHit`、`resolveMoveTarget`、`resolveMoveLandingTarget`、
`resolveFreeLandingRect`、`preserveMoveTarget` 和 `camera`。它们只描述类型能力；
业务数据和 Action 提交仍由业务侧负责。

### VisualAdapter

只有需要特殊代理或状态样式时才注册 `VisualAdapter`。默认适配器会读取 source/target
的计算样式并处理普通 DOM 交接。适配器可以实现：

```ts
interface VisualAdapter {
  resolveSource?(objectId: string): HTMLElement | null
  resolveTarget?(objectId: string, destination: unknown): HTMLElement | null
  captureVisualState?(element: HTMLElement, rect?: DOMRect): VisualSnapshot
  applyState?(element: HTMLElement, state: VisualState): void
  createProxy?(context: VisualLifecycleContext): VisualProxy
  updateProxy?(proxy: VisualProxy, context: VisualLifecycleContext): void
  land?(proxy: VisualProxy, target: HTMLElement | LandingRect, context: VisualLifecycleContext): void | Promise<unknown>
  reveal?(proxy: VisualProxy, target: HTMLElement, context: VisualLifecycleContext): void | Promise<void>
  dispose?(proxy: VisualProxy, context: VisualLifecycleContext): void
}
```

业务拥有颜色、阴影、圆角和内容结构；Runtime 拥有状态交接和生命周期。代理直接挂到
`document.documentElement`，不应由业务插入列表或应用壳。

全局运动通过 `configureMotion()` 设置，支持 `flip`、`resize`、`landing`、`group`、
`controller` 和 `freeLanding`；对象类型的 `motion.profile` 可以覆盖局部策略。

## 5. 启动交互与监听结果

大多数业务通过 `orchestrateMoveSession()` 或 `bindPointerSessionInput()` 启动输入，
不需要手动编排 proxy 和 landing。底层场景也可使用：

```ts
const handle = runtime.start({
  type: 'move',
  objectId: 'project:123',
  input: { kind: 'pointerdown', x: 0, y: 0 },
})

runtime.update(handle.id, input)
runtime.cancel(handle.id, 'cancelled')
handle.dispose()
```

生产接入一般只监听 Action：

```ts
const stop = runtime.onAction(action => {
  switch (action.type) {
    case 'move':
    case 'move-group':
    case 'transfer':
    case 'sort':
      store.applyInteraction(action)
      break
  }
})
```

Runtime 不直接写业务 Store。应用销毁时调用监听返回的 `stop()`；需要观察注册表和
视觉状态时使用 `runtime.subscribe()`。

## 6. Action 类型

公开 Action 包括：

| 类型 | 用途 |
| --- | --- |
| `move` | 单个对象在 Surface 间移动，可带 `toIndex`、`point` 和释放速度。 |
| `move-group` | 多选对象移动，包含 `primaryObjectId` 和 `objectIds`。 |
| `transfer` | 不携带排序位置的 Surface 转移。 |
| `sort` | 同一 Surface 内调整顺序。 |
| `resize` | 对象或布局区域尺寸变化。 |
| `link` | 旧式对象链接语义，兼容保留。 |
| `connection-create` | 创建两个 Node 端口之间的连接。 |
| `connection-delete` | 删除已登记连接。 |
| `connection-cancel` | 取消正在创建的连接。 |

所有 Action 都带 `objectId` 和 `timestamp`；连接 Action 使用 source/target object 和
port 字段。Action 只表达交互事实，不替代后端保存、权限检查或失败回滚。

## 7. 布局与浮动 Surface

布局变更使用 `runtime.layout` 事务，或使用 `captureLayout()`、`scheduleLayout()`、
`runGroupToggle()` 等高层入口。一个布局根节点的一轮变更应合并为一个事务，避免
ResizeObserver、组开合和移动 FLIP 互相覆盖。

业务模板使用 `data-layout-surface`、`data-layout-group`、`data-layout-collection`
等稳定语义标记。浮动 Surface 使用 `useSurface({ floating: true })`，由 Vue 适配层
发现 `layoutElement`、真实 `viewport` 并提交自然尺寸；Core 不读取 `floating`，也不
猜测业务类名。详见 [浮动 Surface 归档](./archive/plans/FLOATING_SURFACE.md) 和
[布局事务归档](./archive/plans/LAYOUT_TRANSACTION.md)。

## 8. Vue 与 React 适配器

Vue 新组件优先使用 `useObject`、`useSurface`、`useTarget` 和 `useRuntimeAction`。
这些 composable 会在组件卸载时执行 generation 保护。React 或非框架接入可使用：

```ts
const dom = createReactRuntimeAdapter(runtime)
dom.bindObject('project:123', element)
dom.bindSurface('column:active', columnElement)
```

底层 `createVueRuntimeAdapter()` 和 `createReactRuntimeAdapter()` 只负责 DOM ref、
Target 绑定和布局 mutation，不注册业务语义，也不提交 Action。`runLayoutMutation()`
用于在业务更新前捕获布局、等待框架 patch 后安排 FLIP。

## 9. 不应依赖的内容

- 不要从 `src/` 深层路径导入；使用包根入口或 `/vue` 子入口。
- 不要调用已经移除的 `runtime.registerSurface()`、`runtime.registerTarget()` 便捷包装。
- 不要让 Vue Transition、业务 FLIP 或自定义高度动画与 Runtime 同时写同一节点的几何属性。
- 不要把业务 Store、文件树、权限和后端 API 放入 Runtime。
- 不要让代理 DOM 进入业务列表或被业务重复监听 pointer 事件。

## 10. 版本与验证

当前版本为 `3.0.6`。发布前执行：

```bash
npm run typecheck
npm test
npm run build:lib
```

E2E 场景使用 `npm run test:e2e`。设计边界见 [DESIGN.md](./DESIGN.md)，历史排查记录
见 `docs/devlog/`，计划文档中的“进行中/未来”内容不代表已冻结 API。
