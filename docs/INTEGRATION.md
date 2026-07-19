# Interaction Runtime · 接入指南

这份文档是写给**使用**这套 Runtime 的人看的：接入一个新的可拖拽对象类型
需要做什么。不假设你了解 Runtime 内部怎么实现——原理和设计取舍见
[DESIGN.md](./DESIGN.md)。

> **现状提示**：`ObjectStore`/`SurfaceStore`/`useObject`/`useSurface` 已经
> 实现了，`abilities` 门禁也是真的在生效（不是摆设）。但 `runtime.start()`/
> `runtime.onAction()` 这套"按类型统一分发交互、统一收 Action"的入口还
> **没有**实现——现在还是直接调用 demo 里的拖拽编排函数
> （`startCardDrag`/`startCardDragDetach`），业务数据变化也是直接写在这
> 两个文件里调 `moveCard()`，没有抽成独立的 `Action` 层。本文档分两部分：
> 先讲现在真的能怎么接，再讲 `runtime.start`/`onAction` 这部分还差什么。

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

这几步做完，这个对象就能参与"拖拽 + 跨容器移动 + 落地 + regrab + 能力
门禁 + 清理"这一整套流程，不需要再写一遍 proxy/FLIP/清理逻辑——但目前
"业务数据怎么变"是直接写在 `kanbanDrag.ts`/`kanbanDragDetach.ts` 里的
`moveCard()` 调用，没有独立成 `Action` 层，接入一个新对象类型目前还是
要照着这两个文件抄一份拖拽编排逻辑，只是不用重新发明 Owner/Session/
Cleanup/ObjectStore 这些底层机制。

## 已知的接入限制

- **detach 策略下，对象跨容器（跨 `v-for` 列表）移动时不是同一个 DOM
  节点**——落地逻辑必须重新查询"此刻真正渲染出来的节点"，不能用抓起时
  拿到的引用。如果你的对象上挂了节点级状态（比如正在播放的视频、一个
  展开状态），这类状态会在跨容器移动时丢失，需要提到业务数据层面显式
  管理。详见 [VISUAL_STRATEGIES.md](./VISUAL_STRATEGIES.md#已知限制跨列表移动时不是真的同一个-dom-节点)。
- **取消（松手时没有命中任何有效目标）和保存失败回滚**目前都还没有实现
  代码，见 [PLAN.md](./PLAN.md) 的执行计划。接入时如果业务场景必须要有
  这两种分支，需要先补上再接。
- **`hitTest`（判断命中哪个容器、第几个位置）目前在两份拖拽编排文件里
  各写了一份**，还没有抽成公共的 `Hit` 模块，接入新对象类型时这段逻辑
  大概率要照抄。
- **`useObject` 假定"一个组件实例对应一个对象"**，如果你的场景跟 demo
  一样是"一份模板渲染一整个列表"，需要照 demo 里的方式退化成
  `runtime.objects` 原始 API + `watchEffect`。

## `runtime.start`/`onAction` 还差什么（未来目标 API）

```ts
runtime.start({ type: 'move', objectId: card.id, input: event })
```

```ts
runtime.onAction(async action => {
  await projectStore.applyAction(action)
})
```

目标是组件里完全不需要自己调 `startCardDrag`/`startCardDragDetach`，
Runtime 根据 `runtime.objects.get(objectId).abilities` 和 `type` 自己决定
要不要接、接了走哪套流程；业务层只订阅 `onAction`，不直接调
`moveCard()`。

现在没做的原因：这需要先把"一次 Session 该收编哪些参与者、对象与视觉
策略怎么绑定"这套分发逻辑想清楚——`kanbanDrag.ts`/`kanbanDragDetach.ts`
现在是业务代码直接选一个函数调用，`runtime.start()` 要把这个选择逻辑
挪进 Runtime 内部，还需要 `Action` 是什么形状（`MoveAction`？还是更通用
的 `{ type, objectId, patch }`？）没有定论。等阶段 1（迁移 Gugu-web
抽屉链路）把 `Session` 的多参与者模型和完整生命周期状态机（见
[DESIGN.md](./DESIGN.md) 原则 3/4）在真实场景里跑实，这套分发逻辑会更
容易想清楚——过早抽象大概率会抽错。
