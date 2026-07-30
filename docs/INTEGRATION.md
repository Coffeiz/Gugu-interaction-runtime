# Interaction Runtime · 接入指南

这份文档是写给**使用**这套 Runtime 的人看的：接入一个新的可拖拽对象类型
需要做什么。不假设你了解 Runtime 内部怎么实现——原理和设计取舍见
[DESIGN.md](./DESIGN.md)。

> **现状提示**：`ObjectStore`/`SurfaceStore`/`useObject`/`useSurface`、
> `runtime.start()` 和 `runtime.onAction()` 都已经可用。Runtime 统一管理
> Session、landing/reveal 时机和清理；业务端仍需要提供对象的命中、Action
> 提交及 clone/detach 这类具体视觉策略。

> **MotionProfile**：`runtime.registerMotionProfile()` 已可用，一次注册控制
> flip/resize/landing/group 四种运动速度。`registerSurfaceLayout()` 不再需要，
> Surface resize 速度由 MotionProfile.resize 统一配置。

## 现在能怎么接

以 [`KanbanBoard.vue`](../src/demo/KanbanBoard.vue) 为例。

**1. 注册这个对象**

如果这个对象有自己独立的 Vue 组件（每个对象一个组件实例），在该组件的
`setup` 里调用 `useObject`：

```ts
import { useObject } from '{path-to}/vue/useObject'

const { elementRef } = useObject({
  id: `project:${project.id}`,
  type: 'project-card',
  surface: () => `column:${project.status}`,  // getter，随业务数据变化
  abilities: ['move', 'sort'],
  visual: 'kanban',
  visualMode: 'detach',
})
```

```html
<div ref="elementRef" class="my-card" :data-card="cardId" @pointerdown="...">
```

如果像 demo 里那样，所有同类对象共用一份模板渲染（没有各自独立的组件
实例），`useObject` 不适用（它假定"一个组件实例对应一个对象"）——退而
求其次，直接用 `runtime.objects` 的原始 API 做一次性注册 + 一个
`watchEffect` 同步 `surfaceId`（见 `KanbanBoard.vue` 里的写法）。这是
目前 demo 采用的方式，不是推荐的最终形态；真正接入业务时，如果对象有
自己的组件，应该用 `useObject`。

**2. 注册它所在的容器（Surface）**

```ts
import { useSurface } from '{path-to}/vue/useSurface'

const { elementRef } = useSurface({
  id: `column:${status}`,
  type: 'list',
  accepts: ['project-card'],  // 空数组表示不限制类型
})
```

```html
<div :ref="el => elementRef = el" class="my-column">
```

Surface 的裁剪由业务样式声明；布局组根不能作为裁剪容器。Runtime 只会临时接管
Surface 的尺寸动画：

```css
[data-layout-surface] { overflow: hidden; }
[data-layout-group] { overflow: visible; }
.group-content.is-collapsing { overflow: hidden; }
```

clone / landing proxy 会由 Runtime 自动挂到 `document.documentElement` 下的固定
overlay，不受这些容器或应用壳裁剪。若需要提前挂载该层（通常不需要），可在
浏览器入口调用：

```ts
import { mountVisualOverlay } from '{path-to}/index'

mountVisualOverlay()
```

**3. 注册运动参数**

所有运动速度通过一次全局配置控制：

```ts
runtime.registerMotionProfile({
  flip:    { duration: 220, easing: 'cubic-bezier(.22,1,.36,1)' },
  resize:  { duration: 220, easing: 'cubic-bezier(.22,1,.36,1)' },
  landing: { duration: 220, easing: 'cubic-bezier(.22,1,.36,1)' },
  group:   { duration: 220, easing: 'cubic-bezier(.22,1,.36,1)' },
})
```

所有字段可选，未设置的字段回退到 `DEFAULT_MOTION_PROFILE`。推荐在应用
初始化时调用一次。

**3. 给对象打上可识别的标记**（供 hit test 用，见"已知限制"）

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

**4.1（可选）提供视觉适配器**

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

**4.2（可选覆盖）视觉适配器**

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

**4.3 视觉 driver 的落地交接**

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

**5.（仅 detach 策略需要）模板里包一层 `<Teleport>`**

```html
<Teleport to="body" :disabled="!isDetached(cardId)">
  <div class="my-card" :data-card="cardId" @pointerdown="onPointerDown(cardId, $event)">
    ...
  </div>
</Teleport>
```

```ts
import { runtime } from '{path-to}/Runtime'
function isDetached(cardId: string) {
  return runtime.owner.isControlled(cardId)
}
```

**6. 让容器的 `TransitionGroup` 在被接管期间关闭**

```html
<TransitionGroup :css="!controlled">
```

```ts
import { useRuntimeTransition } from '{path-to}/vue/useRuntimeTransition'
const { controlled } = useRuntimeTransition(`column:${columnId}`)
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

在业务提交前捕获、提交后播放即可：

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
- **`useObject` 假定"一个组件实例对应一个对象"**，如果你的场景跟 demo
  一样是"一份模板渲染一整个列表"，需要照 demo 里的方式退化成
  `runtime.objects` 原始 API + `watchEffect`。

## Runtime 入口

```ts
runtime.registerMotionProfile({ flip, resize, landing, group })
runtime.start({ type: 'move', objectId: card.id, input: event })
runtime.onAction(async action => {
  await projectStore.applyAction(action)
})
```

`registerMotionProfile` 是全局的一次性配置，推荐在应用初始化时调用。
`runtime.start()` 创建统一 Session，`runtime.onAction()` 输出明确的行为联合类型。
