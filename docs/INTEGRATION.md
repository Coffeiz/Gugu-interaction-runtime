# Interaction Runtime · 接入指南

## 接入状态

本文描述的是 2.0.1 的稳定接入 API。Gugu-web 项目看板、文件库和项目文件面板均已完成
Runtime 回归，联调直接使用 Runtime 源码而非 npm 包；文件业务仍由 Gugu-web 自己管理，
Runtime 不持有文件树、权限或 API。

本文只作为框架无关 Core API 的完整说明书。Vue 的简化接入方案单独记录在
[Vue 接入指南](integration/VUE.md)，该指南已完成并作为 Vue 业务接入的推荐入口，不改变本文的 Core 契约。

本文的唯一业务语义契约是 Runtime Core API。Vue、React 或其他框架都可以直接调用同一套
`runtime.objects`、`runtime.surfaces`、`runtime.targets` 和 `runtime.onAction()`；框架
只负责把自己的 DOM ref 和组件生命周期接到这些 API 上，不产生另一套拖拽语义。Runtime
同时提供可选的 Vue/React DOM 适配器，用来收敛这部分重复的 ref、卸载和布局提交代码。

看板和文件 Demo 也直接使用这些注册表 API。`runtime.registerSurface()`、
`runtime.registerTarget()` 等旧的 Runtime 便捷包装已移除，不再作为接入入口。框架适配器
只同步已注册对象/Surface 的 DOM 元素、维护 Target 的 DOM 生命周期，以及在框架更新后
调用 Core 的布局事务；它不会注册对象类型、对象或 Surface，也不会替业务提交 Action。

### 文件系统接入约束

文件系统不要求 Runtime 提供文件专属 API。Gugu-web 的文件 adapter 已完成迁移，仍只能使用本文公开的
Core API，不能自行
编排 Session、proxy、landing、FLIP 或清理。

文件对象类型可以注册为 `file-item`、`folder-item`，对象 ID 必须包含业务 scope，例如：

```text
files:file:123
project-files:19:file:123
```

文件夹卡既是 Object 又是 Target：通过 `runtime.objects.register({ target })` 一次注册，Runtime
自动同步两个注册表。面包屑没有可拖动身份，使用 `runtime.targets.register()` 单独注册。
Runtime 不需要理解 `fileId`、`folderId` 或文件 API。多选拖拽使用通用 Group Session 和
`move-group` Action，文件业务侧只负责把对象 ID 列表分流到已有的移动、权限和回滚逻辑。

## 五分钟接入（2.0.1）

Runtime 的常用接入只需要三件事：注册对象、注册 Surface、订阅 Action。
默认使用 `detach` 视觉策略和内置 MotionController；业务端只负责对象 DOM、容器
样式和数据保存。

```ts
import { runtime } from 'gugu-interaction-runtime'
// 只注册一次对象类型的视觉/行为策略，不注册某一张具体卡片。
runtime.registerObjectType('project-card', {
  defaultVisualMode: 'detach',
})

runtime.objects.register({
  id: `project:${project.id}`,
  type: 'project-card',
  surfaceId: `column:${project.status}`,
  element: cardElement,
  abilities: ['move', 'sort'],
})

runtime.surfaces.register({
  id: `column:${status}`,
  type: 'project-column',
  element: columnElement,
  accepts: ['project-card'],
})

const stop = runtime.onAction(action => {
  if (action.type === 'move' || action.type === 'transfer') {
    projectStore.applyMove(action)
  }
})
```

### 画布 Node / Connection

需要连接点的 Object 可在注册时提供 `node.ports`。每个端口至少声明 `id`、`side` 和可选的
`position`（0 到 1，表示沿卡片边缘的比例）。Runtime 不缓存端点坐标，而是从对象当前
`getBoundingClientRect()` 计算；连接创建、取消、去重和删除分别通过 `connection-create`、
`connection-cancel`、`connection-delete` Action 通知业务。Runtime 只负责几何和连接生命周期，
关系数据、SVG 绘制和后端持久化仍属于业务层。

Vue、React 和其他框架都使用同一组 Runtime Core API。Vue 项目如果希望减少 ref、generation
和卸载样板，优先从 `gugu-interaction-runtime/vue` 导入 composable；低层 DOM adapter
仍保留给迁移期和布局事务使用。适配器不替代 Core 注册，也不形成第二套拖拽语义。

```ts
import { runtime } from 'gugu-interaction-runtime'
import { createVueRuntimeAdapter } from 'gugu-interaction-runtime'

const dom = createVueRuntimeAdapter(runtime)

// 业务仍直接注册语义对象、Surface 和 Target。
const generation = runtime.objects.register({
  id: `project:${project.id}`,
  type: 'project-card',
  surfaceId: `column:${project.status}`,
  element: null,
  abilities: ['move', 'sort'],
})
runtime.surfaces.register({ id: `column:${project.status}`, type: 'project-column', element: null, accepts: ['project-card'] })

// Vue ref 只负责同步 DOM；null 回调会被适配器安全处理。
const bindCard = (element: HTMLElement | null) => dom.bindObject(`project:${project.id}`, element)
const bindColumn = (element: HTMLElement | null) => dom.bindSurface(`column:${project.status}`, element)
// 组件卸载时：业务按 generation 注销自己的 Object/Surface，适配器清理 Target DOM 绑定。
dom.dispose()
```

新 Vue 组件推荐使用独立入口：

```ts
import { provideRuntime, useObject } from 'gugu-interaction-runtime/vue'
```

完整的 Vue 生命周期、列表组件约束和正式 API 见
[Vue 接入指南](./integration/VUE.md)。

React 接入使用同一套 Core 注册和 `createReactRuntimeAdapter(runtime)`，把返回的
`bindObject`/`bindSurface`/`bindTarget` 接到 callback ref。适配器不依赖 Vue 或 React
运行时，因此不会把框架类型带入 Core 包。

对象节点和容器节点只需提供真实 DOM 元素。Runtime 自动处理
抓取、跟手、落点、落地、揭示、取消、中断和资源清理。

这份文档是写给**使用**这套 Runtime 的人看的：接入一个新的可拖拽对象类型
需要做什么。不假设你了解 Runtime 内部怎么实现——原理和设计取舍见
[DESIGN.md](./DESIGN.md)。

> **职责边界**：Runtime 统一管理输入、Session、命中、Action、landing/reveal、
> MotionController 和清理；业务端只负责注册对象/Surface、提供样式和提交 Action。
> 只有需要特殊视觉时才需要实现 `VisualAdapter`。

> **MotionProfile**：`runtime.configureMotion()` 已可用，一次注册控制
> flip/resize/landing/group 四种运动速度。`registerSurfaceLayout()` 不再需要，
> Surface resize 速度由 MotionProfile.resize 统一配置。

## 现在能怎么接

以 [`KanbanBoard.vue`](../src/demo/KanbanBoard.vue) 为例。

**1. 注册这个对象**

在组件挂载时注册对象，在 DOM ref 或数据变化时同步 element/surface，在组件卸载时按 generation
注销对象：

```ts
const generation = runtime.objects.register({
  id: `project:${project.id}`,
  type: 'project-card',
  surfaceId: `column:${project.status}`,
  element: null,
  abilities: ['move', 'sort'],
  visual: 'kanban',
  visualMode: 'detach',
})

runtime.objects.setElement(`project:${project.id}`, element)
runtime.objects.setSurface(`project:${project.id}`, `column:${project.status}`)
// 卸载时仅注销仍属于本次组件实例的注册，避免旧实例清理新实例。
if (runtime.objects.get(`project:${project.id}`)?.generation === generation) {
  runtime.objects.unregister(`project:${project.id}`)
}
```

```html
<div ref="cardElement" class="my-card" :data-card="cardId" @pointerdown="...">
```

**2. 注册它所在的容器（Surface）**

```ts
runtime.surfaces.register({
  id: `column:${status}`,
  type: 'list',
  element: null,
  accepts: ['project-card'],  // 空数组表示不限制类型
})
runtime.surfaces.setElement(`column:${status}`, columnElement)
```

```html
<div ref="columnElement" class="my-column">
```

Surface 的裁剪由业务样式声明；布局组根不能作为裁剪容器。Runtime 只会临时接管
Surface 的尺寸动画：

```css
[data-layout-surface] { overflow: hidden; }
[data-layout-group] { overflow: visible; }
.group-content.is-collapsing { overflow: hidden; }
```

clone / landing proxy 会由 Runtime 自动挂到 `document.documentElement` 下，不受这些
容器或应用壳裁剪——逃出裁切靠的是重新挂载到 `<html>` 这个动作本身，不需要额外的
固定 overlay 容器；代理自己带 `z-index: 2147483647` 顶到最高层。

## 核心 API 参数

| API | 参数 | 用途 |
| --- | --- | --- |
| `registerObjectType(type, options)` | `defaultVisualMode` | 默认视觉策略，通常为 `detach` |
|  | `visual` | 可选的对象级 `VisualAdapter` |
|  | `motion.enabled` | 是否使用内置 MotionController，默认 `true` |
|  | `motion.profile` | 该对象类型的运动参数覆盖 |
|  | `releaseMode` | 释放后的降落策略：`physical` 继承释放速度（默认），`normal` 使用普通过渡 |
|  | `landingMode` | `default` 普通回位、`target` 语义目标吸入、`free` 自由矩形落点 |
|  | `motion.profile.freeLanding.release` | 仅 `landingMode: 'free'` 使用的释放速度整形，可配置 `velocityScale` 与 `maxVelocity`；列表/网格对象忽略该字段 |
|  | `resolveFreeLandingRect` | `free` 模式解析视口坐标 `LandingRect`，不要求目标 DOM |
| `runtime.configureMotion(config)` | `freeLanding.duration` | 画布 free landing 的非回弹飞行时长，默认 550ms |
|  | `freeLanding.easing` | 画布 landing 缓动曲线，默认 `cubic-bezier(.22,1,.36,1)` |
|  | `grabAlign.align` | 抓取基准对齐方式：`'center'`（默认，卡片中心对指针）或 `'pointer'`（点哪抓哪） |
|  | `grabAlign.offsetX` / `offsetY` | 在基准对齐结果上叠加的固定像素偏移，正值往右/往下 |
| `runtime.objects.register(options)` | `id` | 对象唯一标识 |
|  | `type` | 对象类型，必须匹配 Surface 的 `accepts` |
|  | `surfaceId` | 当前 Surface ID |
|  | `element` | 对象真实 DOM 元素 |
|  | `abilities` | 能力列表，包含 `move` 才允许拖动 |
|  | `selected` | 当前是否参与多选；抓取已选对象时 Runtime 自动创建 Group Session |
|  | `contentScale` | 对象脱离画布缩放祖先后代理需要复现的视觉比例；可传数字或返回当前比例的函数 |
| `runtime.getObjectsInRect(surfaceId, rect)` | `rect` | 查询与矩形相交的已注册对象 ID，用于框选 |
| `runtime.surfaces.register(options)` | `id` | Surface 唯一标识 |
|  | `type` | Surface 类型 |
|  | `element` | Surface 真实 DOM 元素 |
|  | `accepts` | 接受的对象类型，空数组表示不限 |
| `runtime.onAction(handler)` | `action` | 业务保存移动结果的语义化事件 |
| `runtime.targets.register(target)` | `id` / `surfaceId` / `element` | 注册没有 Object 身份的面包屑等语义落点 |

Action 的常用字段为 `type`、`objectId`、`fromSurfaceId`、`toSurfaceId`、`toIndex`
和 `timestamp`。Runtime 不直接修改业务 Store。

**抓取对齐（`grabAlign`）**

默认 `align:'center'`：不管指针点在卡片哪个位置，抓起后卡片几何中心都会对齐
指针。想要"点哪抓哪"（保留实际点击位置在卡片里的相对偏移）时传 `align:'pointer'`；
`offsetX`/`offsetY` 是在基准对齐结果上再叠加的固定像素偏移，可以跟任意 `align`
组合，比如居中之外再往下偏几 px，做出"被拎着"的悬垂感：

```ts
runtime.registerObjectType('project-card', {
  defaultVisualMode: 'detach',
  grabAlign: { offsetY: 8 },
})
```

没有注册 `grabAlign` 的类型等价于 `{ align: 'center' }`（纯几何中心对齐）。

**3. 配置运动参数**

所有运动速度通过一次全局配置控制：

```ts
runtime.configureMotion({
  flip:    { duration: 220, easing: 'cubic-bezier(.22,1,.36,1)' },
  resize:  { duration: 220, easing: 'cubic-bezier(.22,1,.36,1)' },
  landing: { duration: 220, easing: 'cubic-bezier(.22,1,.36,1)' },
  group:   { duration: 220, easing: 'cubic-bezier(.22,1,.36,1)' },
})
```

如果只有某一种 free 对象需要限制抛出速度，优先写在该对象类型上，不要修改全局释放档案：

```ts
runtime.registerObjectType('canvas-card', {
  defaultVisualMode: 'detach',
  landingMode: 'free',
  motion: {
    profile: {
      freeLanding: {
        duration: 550,
        easing: 'cubic-bezier(.22,1,.36,1)',
        coastSeconds: 0.12,
        maxCoast: 260,
        minVelocity: 30,
        release: { velocityScale: 1, maxVelocity: 2500 },
      },
    },
  },
})
```

`freeLanding.release` 只在该对象最终走 free landing 时参与释放速度裁剪；`target`、`default`
以及列表/网格对象仍使用全局 `DEFAULT_RELEASE_PROFILE`，因此不会被画布参数联动修改。

跟手和释放物理参数通过同一个入口配置：`follow.stiffness/damping` 控制跟手弹簧，
`rotation.tilt/sway/smoothing` 控制抓取姿态，`release.velocityScale` 控制释放速度，
`minVelocity/maxVelocity` 控制抛出阈值和速度上限，`dampingRatio` 控制落地阻尼。

```ts
runtime.configureMotion({
  controller: {
    follow: { stiffness: 360, damping: 32 },
    rotation: { tilt: 5, sway: 0.25, smoothing: 0.2 },
    release: {
      velocityScale: 1,
      minVelocity: 30,
      maxVelocity: 5000,
      dampingRatio: 0.78,
    },
  },
})
```

`flip` 控制兄弟节点位移，`resize` 控制 Surface 高度，`landing` 控制落地，
`group` 控制分组展开/收起。所有字段可选，未设置时回退到 Runtime 默认值。
推荐在应用初始化时调用一次。

### 多选拖拽叠牌

业务只需要把选中状态写入 `useObject`，Runtime 会在抓取已选主卡时自动收集同一
Surface 的其他已选对象并创建 `GroupDragSession`，不需要业务侧调用
`startGroupObjectPointer()`：

```ts
useObject({
  id: props.id,
  type: 'file-item',
  surface: browserSurfaceId,
  abilities: ['move'],
  selected: computed(() => selection.has(props.id)),
})
```

框选命中也可以直接复用 Runtime 的对象查询：

```ts
const ids = runtime.getObjectsInRect(surfaceId, {
  left, top, right, bottom,
})
```

选择集合、框选框和工具栏仍属于业务 UI；Runtime 只负责对象命中、多卡会话、代理
视觉和最终的 `move-group` Action。

多选拖拽默认使用 Runtime 内置的 `GroupVisualAdapter`，负责主卡、修饰卡叠放、
源卡幽灵、landing 淡出和回位恢复。它只影响抓取时的叠牌视觉，不影响
`move-group` action 携带的对象数量，也不负责业务侧的选择状态。

默认情况下不需要额外配置：

```ts
runtime.registerObjectType('file-item', {
  defaultVisualMode: 'detach',
  // 未配置 groupVisual 也等价于 'default'
  groupVisual: 'default',
})
```

如果对象需要自己的叠卡外观，可以传入自定义 `GroupVisualAdapter`。它会在
`context.group` 存在时接管代理的 `createProxy`、`land`、`reveal` 和 `dispose`，
普通单卡仍使用 `visual`：

```ts
runtime.registerObjectType('custom-card', {
  defaultVisualMode: 'detach',
  visual: cardVisual,
  groupVisual: customGroupVisual,
})
```

不需要多选叠卡的对象可以显式关闭：

```ts
groupVisual: 'none'
```

配置优先级为：`'none'` 关闭，自定义适配器优先，`'default'` 或未配置时使用
Runtime 默认实现。

`GroupVisualAdapter` 与 `VisualAdapter` 使用相同的生命周期接口；Runtime 只在
多对象会话中调用它，不要求业务侧自行判断单卡/多卡。

```ts
runtime.registerObjectType('file-item', {
  defaultVisualMode: 'detach',
  groupDrag: {
    maxModifiers: 2,
    foldDuration: 300,
    modifierFadeDuration: 180,
    spread: [
      { x: 50, y: -20, rotate: 20, scale: 1 },
      { x: 90, y: -38, rotate: 34, scale: 1 },
    ],
    tight: [
      { x: 7, y: 6, rotate: 4, scale: 0.97 },
      { x: 13, y: 12, rotate: 8, scale: 0.94 },
    ],
  },
})
```

- `maxModifiers`：最多显示的修饰卡数量；业务移动仍作用于全部选中对象。
- `foldDuration`：修饰卡从扇开位置收拢到叠牌位置的时长，单位为毫秒。
- `modifierFadeDuration`：进入 landing 后修饰卡淡出并移除的时长，单位为毫秒。
- `spread`：每张修饰卡抓起时的初始位置、旋转和缩放。
- `tight`：每张修饰卡最终叠在主卡后的目标位置、旋转和缩放。

`spread[i]` 与 `tight[i]` 对应第 `i` 张修饰卡。未提供配置时使用 Runtime
默认的两张叠牌参数。Core 只传递 group 元数据和配置，具体 DOM 克隆与绘制由
Visual Adapter 负责。

如果分组展开/收起时还需要卡片淡入淡出，可开启布局 presence：

```ts
runtime.configureVisual({ layoutPresence: true })
```

该选项不新增 enter/leave 参数，淡入淡出直接复用 `group` 的时长和缓动；
兄弟卡片位移继续使用 `flip` 配置。默认关闭，不会改变未启用该选项的列表。

### Collection Presence（卡片进入/离场）

开启 `layoutPresence` 后，Runtime 会在布局 FLIP 快照中自动记录卡片所属的
collection。卡片从一个 collection 移到另一个 collection 时按“新节点进入”处理；
卡片从所有 collection 消失时按“旧节点离场”处理。该逻辑使用 Web Animations API，
时长和缓动复用 `flip` 配置，不需要业务端手动调用 enter/leave。

业务端需要为每个卡片列表提供 collection 标记，并为卡片提供稳定 key：

```html
<div data-layout-collection="recent">
  <div data-layout-role="card" data-layout-key="project-224">
    ...
  </div>
</div>
```

注意事项：

- `data-layout-key` 必须在不同 collection 之间保持全局唯一；
- 折叠的年月组不会被当作可见 collection 参与入场动画；
- 正在被 Runtime 拖拽控制的卡片不会额外生成离场副本；
- 组展开/收起使用组自身的 Presence，不会和 Collection Presence 叠加；
- Runtime 会过滤脱离 collection 或尺寸异常的 Vue 过渡节点。

Runtime 也导出了底层 API，只有需要自定义布局事务时才直接使用：

```ts
const snapshot = captureCollectionPresence(root, '[data-layout-role="card"]')
// 业务完成数据更新和 DOM patch 后调用
playCollectionPresence(snapshot, {
  duration: 250,
  easing: 'cubic-bezier(.22,1,.36,1)',
})
```

**4. 给对象打上可识别的标记**（供 hit test 用，见“已知限制”）

```html
<div class="my-card" :data-card="cardId">
```

Runtime 会根据对象注册里的 `visual` 找到适配器，自动创建 Session、绑定
driver/lifecycle、接管输入并推进完整事务。未填写 `visual` 时按对象类型默认配置，
未填写 `visualMode` 时默认使用 `detach`。

视觉适配器只在 Runtime 集成层创建一次。`createProxy`、`updateProxy`、
`landProxy`、`revealTarget` 和 `disposeProxy` 都封装在这个类型级适配器内部；每张
卡片的注册只需要提供 `id`、`type`、`element` 和 `surfaceId`，不需要重复声明这些
视觉能力。

对象注册时如果已经有 DOM element，Runtime 会自动绑定 `pointerdown`；如果 element
稍后才挂载，后续 `runtime.objects.setElement(id, element)` 也会自动完成绑定。业务端
不需要再单独调用 `runtime.bindObjectPointer()`，也不需要为每张卡片维护 disposer。

推荐在渲染框架的 ref/挂载回调里只同步 element：

```ts
function setCardElement(id: string, element: HTMLElement | null): void {
  runtime.objects.setElement(id, element)
}
```

Runtime 会根据对象注册的 `visual` 找到对应适配器，并负责监听器的替换、卸载和
重新绑定。对象 DOM 被 Vue/React 重建时，只要再次同步新的 element，
输入入口仍然保持不变。

`startObjectPointer()` 是 Runtime 内部入口，业务端不需要直接调用，也不需要在模板里
手动转发 `pointerdown` 或判断 clone/detach。

Runtime 会先检查 `runtime.objects.hasAbility(cardId, 'move')`，没有这个能力直接
拒绝——对象只要注册时不声明 `'move'`，就自动拖不动，不需要在业务组件里另外判断。
clone/detach 两种策略的选择依据见
[VISUAL_STRATEGIES.md](./VISUAL_STRATEGIES.md)。

业务层可以订阅 Runtime 输出的语义化 Action，并在自己的 Store/API 边界提交：

```ts
const stop = runtime.onAction(action => {
  if (action.type === 'move' || action.type === 'transfer') {
    projectStore.applyMove(action)
  }
})
```

Runtime 不直接写业务 Store；订阅者负责保存、失败处理和必要的回滚。

代理由 Runtime 按 session 登记。适配器不需要维护代理注册表；Runtime 创建新代理时会替换旧代理，并在取消、打断或完成时统一清理。

落地和揭示阶段由 Runtime 分别调用 `landVisualProxy(sessionId, target)` 与
`revealVisualProxy(sessionId, target)`；适配器只返回落地结果或执行视觉过渡，不直接修改
Session 状态，也不自行决定何时清理代理。

跟手或重定位阶段使用 `updateVisualProxy(sessionId, context)`，由 Runtime 转发给适配器。

最终目标使用 `resolveVisualTarget(sessionId, destination)` 解析；适配器只返回目标节点，
Runtime 会统一检查节点仍连接在文档中。

普通、抓取、落地和揭示状态使用 `applyVisualState(objectId, element, state)` 写入，
业务适配器只负责把状态映射为 class 或样式。

需要保存抓取前或落地目标样式时使用 `captureVisualState(objectId, element)`，由 Runtime
统一获取适配器快照或默认 DOM 快照。

释放时 Runtime 会先通知适配器执行 `dispose(proxy, context)`，随后调用代理对象自身的
`dispose()`；两者都由 Runtime 保证最多执行一次。

**5.（可选）提供视觉适配器**

业务端可以自定义卡片在普通、hover、抓取、落地和揭示阶段的 class 或样式，
但不应自行编排 proxy 与本体的交接。如果不提供，Runtime 使用内置的
`DefaultVisualAdapter` 自动处理 detach 的 `createProxy`、`land`、`reveal`、`dispose`
和 `createMove`，从 Runtime 注册表自动获取 surface 信息：

```ts
// DefaultVisualAdapter 已内置，用户不需要自己创建
runtime.registerObjectType('kanban', {
  defaultVisualMode: 'detach',
})
```

### 抓取代理的紧凑布局

列表卡片等场景可以在抓起时收缩到更适合跟手的尺寸。业务只声明紧凑态的目标
布局，Runtime 负责本体尺寸首帧、下一帧切换、尺寸过渡，以及 landing 时恢复本体
尺寸；业务 CSS 仍只负责卡片内部的 Grid/Flex 排布。

```ts
runtime.registerObjectType('file-item', {
  defaultVisualMode: 'detach',
  proxyLayout: {
    compact: {
      // 只对列表形态启用；网格卡片仍保持原尺寸
      selector: '[data-view="list"]',
      width: 'min(320px, calc(100vw - 48px))',
      left: '50%',
      transform: 'translateX(-50%)',
      duration: 200,
      easing: 'cubic-bezier(.22,1,.36,1)',
    },
  },
})
```

`proxyLayout.compact` 的 `width`、`left` 和 `transform` 是代理的抓取目标值；不传
`left`/`transform` 时默认分别使用 `50%` 和 `translateX(-50%)`。`selector` 可选，
用于让同一对象类型只在特定 DOM 形态下启用。不要在这里声明文件名、图标等子元素
的列位置，那些属于业务组件自身的布局。

如果没有配置 `proxyLayout`，代理行为保持原有的本体尺寸抓取方式。

### 画布缩放下的代理内容

画布卡片通常位于带 `transform: scale(...)` 的世界层中。Runtime 创建抓取/landing
代理后，代理已经脱离这个祖先，业务应在对象注册时传入当前画布比例：

```ts
runtime.objects.register({
  id: 'mind:note-1',
  type: 'mind-canvas-object',
  surfaceId: 'mind:canvas',
  element,
  abilities: ['move'],
  contentScale: () => camera.scale,
})
```

Runtime 会保留未缩放的布局尺寸，并在内部缩放代理内容层，因此文字、内边距、图标
和卡片外框保持同一比例。传函数时，拖拽期间继续缩放画布也会同步到代理；业务不需要
自行创建 proxy、复制 `scaleShell` 或在每帧重写内容尺寸。

对象类型也可以选择是否使用 Runtime 内置的 MotionController，并覆盖该对象的运动参数。
未填写 `enabled` 时默认启用；未填写的参数继续回退到全局配置和 Runtime 默认值：

```ts
runtime.registerObjectType('kanban', {
  defaultVisualMode: 'detach',
  motion: {
    enabled: true,
    profile: {
      landing: { duration: 320, easing: 'cubic-bezier(.22,1,.36,1)' },
      flip: { duration: 250, easing: 'cubic-bezier(.22,1,.36,1)' },
    },
  },
})
```

landing 的终态表现通过 `landingMode` 区分，默认值为 `default`。看板和普通卡片
继续使用 `default`；文件夹卡、面包屑这类语义目标可以使用 `target`：代理从松手
后的第一帧就开始缩小淡出，同时继承原有 landing 的释放速度、旋转和位置运动。
`target` 不改变位置运动，也不会影响看板的 landing。

自由画布可以使用 `landingMode: 'free'`。此模式的解析器返回与
`getBoundingClientRect()` 相同视口坐标系的矩形，不需要真实目标元素；Runtime 会跳过
目标 DOM 等待和目标隐藏，但仍复用同一套代理、释放、retarget、淡出和清理流程。默认
`releaseMode: 'physical'` 会继承释放时的速度、旋转和缩放状态；需要无惯性普通落地时
设置 `releaseMode: 'normal'`。Stage 1 的画布接入由业务负责把世界坐标转换为当前视口
矩形，Camera API 留到后续阶段。

```ts
runtime.registerObjectType('canvas-card', {
  defaultVisualMode: 'detach',
  landingMode: 'free',
  releaseMode: 'physical',
  resolveFreeLandingRect: ({ destination }) => destination as {
    left: number; top: number; width: number; height: number
  },
})
```

`target` 的飞入和缩小淡出可以分别调参。`target.motion` 控制飞入弹簧速度，
`target.landing` 控制飞入段的时长与视觉缓动，`target.dismiss` 控制同步开始的缩小淡出；
`easing` 接受 CSS easing 字符串，例如
`ease-in`、`ease-out`、`ease-in-out` 或自定义 `cubic-bezier(...)`。

```ts
runtime.registerObjectType('file-item', {
  defaultVisualMode: 'detach',
  landingMode: 'target',
  motion: {
    profile: {
      target: {
        motion: {
          position: { stiffness: 90, damping: 19 },
          scale: { stiffness: 90, damping: 19 },
        },
        landing: { duration: 300, easing: 'ease-out' },
        dismiss: { duration: 300, easing: 'ease-in', scale: 0.72 },
      },
    },
  },
})
```

如果业务需要自行提供落地运动实现，可将 `enabled` 设为 `false`；Runtime 仍负责
Session、目标解析、landing/reveal 顺序和清理，只把落地运动交给适配器的 `land()`。
这不会关闭跟手阶段的输入或生命周期编排。

如果需要自定义视觉，可以注册 `VisualAdapter`：

```ts
const visual: VisualAdapter = {
  resolveSource: () => cardEl,
  createProxy: context => createProjectProxy(context),
  updateProxy: (proxy, context) => updateProjectProxy(proxy, context),
  land: (proxy, target, context) => landProjectProxy(proxy, target, context),
  reveal: (proxy, target, context) => revealProjectTarget(proxy, target, context),
  dispose: proxy => disposeProjectProxy(proxy),
  applyState: (element, state) => {
    element.classList.toggle('is-hovered', state.hovered)
    element.classList.toggle('is-dragging', state.grabbed)
    element.dataset.phase = state.phase
  },
}
```

适配器负责具体的阴影、圆角、背景、proxy 运动和样式；Runtime 负责统一 hover 状态、
生命周期时序、代理到本体的渐变交接，以及取消/清理。这样不同卡片类型可以拥有不同
视觉风格，同时不会因各自实现 hover 或 reveal 而产生交接闪烁。

业务端样式可以直接按 Runtime 写入的状态 class 定义。例如项目卡：

```css
.project-card {
  border-radius: 12px;
  background: var(--project-card-bg, #fff);
  box-shadow: 0 2px 8px rgb(80 90 110 / 7%);
  transition: box-shadow 180ms ease, background-color 180ms ease;
}

.project-card.is-hovered {
  background: var(--project-card-hover-bg, #fff);
  box-shadow: 0 8px 20px rgb(80 90 110 / 18%);
}

.project-card.is-grabbed,
.project-card[data-phase='dragging'] {
  box-shadow: 0 14px 30px rgb(40 50 70 / 24%);
}

.project-card[data-phase='landing'] {
  transition: box-shadow 180ms ease;
}

.project-card[data-phase='revealing'] {
  box-shadow: 0 2px 8px rgb(80 90 110 / 7%);
}

.project-card-proxy {
  pointer-events: none;
}
```

如果多个卡片类型只需要替换视觉值，也可以使用 CSS 变量，而无需修改
Runtime 或适配器：

```css
.file-card {
  --project-card-bg: #f8fbff;
  --project-card-hover-bg: #fff;
}

.canvas-card {
  --project-card-bg: #fffdf5;
  --project-card-hover-bg: #fffaf0;
}
```

**5.1（可选覆盖）视觉适配器**

Runtime 会统一编排 source/target 解析所需的生命周期顺序、landing、handoff、reveal
和清理；具体 proxy、样式交接、目标等待和落地动画仍由当前 clone/detach 视觉 driver
实现。detach 使用同步 target 解析；clone 如需等待目标 mount，必须先创建 proxy，
再在策略内部等待，Runtime 不强制阻塞所有策略。

只有需要特殊视觉时才注册适配器：

```ts
runtime.registerVisualAdapter('project-card', {
  captureVisualState(element) {
    return {
      ...runtime.captureDefaultVisualState(element),
      boxShadow: '0 10px 24px rgb(80 90 110 / 20%)',
    }
  },
})
```

适配器只覆盖提供的字段；Runtime 负责 Session、landing/reveal 顺序、幂等和
清理，source/target 的具体 DOM 操作仍由视觉 driver 负责。

**5.2 视觉 driver 的落地交接**

以下代码展示视觉 driver 如何执行交接；Runtime 负责在 landing 完成后调用
reveal，业务端不应自行编排 Session。目标只读取一次
几何和视觉快照，动画过程中不再反复读取目标 DOM：

```ts
import { landDragProxy } from '{path-to}/visual/Visual'

const targetRect = targetEl.getBoundingClientRect()
const targetStyle = getComputedStyle(targetEl)

// 目标本体在交接期间可以暂时隐藏，但快照必须保持不变。
targetEl.style.visibility = 'hidden'

await landDragProxy(proxyEl, targetRect, {
  duration: 220,
  easing: 'cubic-bezier(.22,1,.36,1)',
  targetShadow: targetStyle.boxShadow,
  targetRadius: targetStyle.borderRadius,
  targetBackground: targetStyle.backgroundColor,
  targetOpacity: targetStyle.opacity,
})

// 交接完成后再恢复本体，并销毁 proxy。
targetEl.style.visibility = ''
destroyDragProxy(proxyEl)
```

如果目标正处于 hover，Runtime 的 `getComputedStyle()` 会捕获 hover 后的阴影、
背景和圆角，代理会沿同一组视觉值完成过渡。业务端不应在 `await` 期间再次
修改 proxy 的 `left`、`top`、`box-shadow` 或 `transform`，这些属性由 Runtime
独占，避免两个动画源互相覆盖。

**6.（仅 detach 策略需要）模板里包一层 `<Teleport>`**

```html
<Teleport to="body" :disabled="!isDetached(cardId)">
  <div class="my-card" :data-card="cardId" @pointerdown="onPointerDown(cardId, $event)">
    ...
  </div>
</Teleport>
```

```ts
function isDetached(cardId: string) {
  return runtime.isControlled(cardId)
}

const stopOwnership = runtime.onOwnershipChange(cardId => {
  // 触发框架层刷新 isDetached(cardId) 对应的渲染状态。
})
```

**7. 让容器的 `TransitionGroup` 在被接管期间关闭**

```html
<TransitionGroup :css="!controlled">
```

```ts
const controlled = runtime.isControlled(`column:${columnId}`)
const stopOwnership = runtime.onOwnershipChange(() => {
  // 更新 controlled 计算值。
})
```

## 组布局的 Relative FLIP

有年/月、文件夹/子文件夹等嵌套布局时，为每个**布局组根节点**标记
`data-layout-group`；不要给内部卡片标记：

```html
<section data-layout-group>
  <h3>2026</h3>
  <section data-layout-group>
    <h4>7 月</h4>
    <div :data-card="cardId">...</div>
  </section>
</section>
```

会随对象进出改变高度的容器另加 `data-layout-surface`：

```html
<section data-layout-surface>
  <section data-layout-group>...</section>
</section>
```

Surface 的运动由 Runtime 执行；业务只声明 Surface 类型和期望策略。当前默认
策略会补间 `height`，未来可以按类型注册更具体的策略：

```ts
Surface 的 resize 速度由 `MotionProfile.resize` 控制，组展开/收起速度由
`MotionProfile.group` 控制。业务不要在同一 Surface 上自行写 `height`、
`transform` 或 `transition`，以免和 Runtime 的布局事务竞争。

如果业务只需要切换一个布局组，推荐直接使用 Runtime 的组切换编排：

```ts
await runGroupToggle({
  root,
  content: monthContent,
  opening,
  mutate: () => toggleGroup(monthKey),
  waitForLayout: nextTick,
  isCurrent: () => token === currentToken,
})
```

Runtime 会统一完成捕获、等待布局、组高度动画、兄弟 FLIP 和可选的 presence。
业务不需要重复实现以下低层调用。只有需要拆分事务时，才直接使用捕获/播放 API：

```ts
import { captureLayoutFlip, playLayoutFlip } from '{path-to}/dom/GroupLayout'

const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-card]'))
const before = captureLayoutFlip(sourceElement, cards)

projectStore.applyMove(action)

requestAnimationFrame(() => {
  playLayoutFlip(before)
})
```

若 `sourceElement` 位于 `data-layout-group` 内，Runtime 会捕获全部组节点及
组内卡片叶节点，将每个节点的屏幕位移减去直接父组位移，只播放剩余局部位移。
父组整体移动时，内部卡片和子组自然跟随，不会叠加 transform；同一父组内部
真正被挤动的兄弟子组和卡片仍会独立 FLIP。普通无组列表继续以卡片为参与者。

`data-layout-surface` 的前后高度会在同一事务中做 height resize，因此卡片移入/
移出时容器不会瞬间伸缩；这不是 FLIP 位移的一部分，业务不应自行再写同一
Surface 的 `height` 或 `transition`。

这几步做完，对象就能参与"拖拽 + 跨容器移动 + 落地 + regrab + 能力门禁 +
清理"。业务数据变化通过 `runtime.onAction()` 在 Store/API 边界提交；新对象
仍需要提供自己的命中和视觉 driver，但无需重新实现 Session、Owner、Cleanup
或布局 FLIP。

## 已知的接入限制

- **detach 策略下，对象跨容器（跨 `v-for` 列表）移动时不是同一个 DOM
  节点**——落地逻辑必须重新查询"此刻真正渲染出来的节点"，不能用抓起时
  拿到的引用。如果你的对象上挂了节点级状态（比如正在播放的视频、一个
  展开状态），这类状态会在跨容器移动时丢失，需要提到业务数据层面显式
  管理。详见 [VISUAL_STRATEGIES.md](./VISUAL_STRATEGIES.md#已知限制跨列表移动时不是真的同一个-dom-节点)。
- **保存失败回滚**仍由业务 Store/API 边界负责；Runtime 只负责取消当前视觉
  事务，不会擅自回写业务数据。
- **Hit** 已有公共接口；业务通过 `runtime.setHitResolver()` 注入自己的
  Surface/目标/索引命中规则。
- **对象注册必须绑定稳定 ID 和 generation**：跨列表重渲染时按对象 ID 更新 element，
  卸载时校验 generation 后再注销，避免旧 DOM 清理新对象注册。

## Runtime 入口

```ts
runtime.configureMotion({ flip, resize, landing, group })
runtime.start({ type: 'move', objectId: card.id, input: event })
runtime.onAction(async action => {
  await projectStore.applyAction(action)
})
```

`configureMotion` 是全局的一次性配置，推荐在应用初始化时调用。
`runtime.start()` 创建统一 Session，`runtime.onAction()` 输出明确的行为联合类型。
