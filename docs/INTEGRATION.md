# Interaction Runtime · 接入指南

这份文档是写给**使用**这套 Runtime 的人看的：接入一个新的可拖拽对象类型
需要做什么。不假设你了解 Runtime 内部怎么实现——原理和设计取舍见
[DESIGN.md](./DESIGN.md)。

> **现状提示**：`ObjectStore`/`SurfaceStore`/`useObject`/`useSurface`、
> `runtime.start()` 和 `runtime.onAction()` 都已经可用。Runtime 统一管理
> Session、landing/reveal 时机和清理；业务端仍需要提供对象的命中、Action
> 提交及 clone/detach 这类具体视觉策略。

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

**3. 给对象打上可识别的标记**（供 hit test 用，见"已知限制"）

```html
<div class="my-card" :data-card="cardId" @pointerdown="onPointerDown(cardId, $event)">
```

**4. 选一种视觉策略，调用对应的拖拽函数**

```ts
import { startCardDrag } from '{path-to}/kanbanDrag'          // clone 策略
import { startCardDragDetach } from '{path-to}/kanbanDragDetach' // detach 策略

function onPointerDown(cardId: string, event: PointerEvent) {
  const el = event.currentTarget as HTMLElement
  startCardDrag(event, cardId, el)       // 或 startCardDragDetach(event, cardId, el)
}
```

这两个函数入口处都会先查 `runtime.objects.hasAbility(cardId, 'move')`，
没有这个能力直接拒绝——对象只要注册时不声明 `'move'`，就自动拖不动，不
需要在业务组件里另外判断"这个能不能拖"。两种策略的选择依据见
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

**4.1（可选）提供视觉适配器**

业务端可以自定义卡片在普通、hover、抓取、落地和揭示阶段的 class 或样式，
但不应自行编排 proxy 与本体的交接：

```ts
const visual: VisualAdapter = {
  getSourceElement: () => cardEl,
  createProxy: snapshot => createProjectProxy(snapshot),
  applyState: (element, state) => {
    element.classList.toggle('is-hovered', state.hovered)
    element.classList.toggle('is-dragging', state.grabbed)
    element.dataset.phase = state.phase
  },
}
```

适配器负责具体的阴影、圆角、背景和 class；Runtime 负责统一 hover 状态、运动
时序、代理到本体的渐变交接，以及取消/清理。这样不同卡片类型可以拥有不同
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

默认情况下 Runtime 会自动解析 source/target、读取目标计算样式、同步 hover
状态并完成 proxy → 本体交接。业务端不需要手动调用落地动画。

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

适配器只覆盖提供的字段，source/target 解析、hover 接管、landing、reveal 和
清理仍由 Runtime 负责。

**4.3 Runtime 内部的落地交接**

以下代码展示 Runtime 内部如何执行交接，业务端不应直接调用。目标只读取一次
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
runtime.registerSurfaceLayout('kanban-column', {
  resize: {
    enabled: true,
    properties: ['height'],
    duration: 220,
    easing: 'cubic-bezier(.22,1,.36,1)',
  },
})
```

```html
<section data-layout-surface data-surface-type="kanban-column">
  ...
</section>
```

`registerSurfaceLayout()` 是已确定、待第二类 Surface 接入时实现的扩展接口；
在当前默认策略下不必注册。业务不要在同一 Surface 上自行写 `height`、
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
runtime.start({ type: 'move', objectId: card.id, input: event })
```

```ts
runtime.onAction(async action => {
  await projectStore.applyAction(action)
})
```

`runtime.start()` 创建统一 Session，`runtime.onAction()` 输出明确的行为
联合类型。当前 clone/detach demo 仍由业务入口选择视觉 driver；当有第三种
以上稳定视觉策略时，再评估是否需要进一步抽取策略注册，而不提前扩大核心。
