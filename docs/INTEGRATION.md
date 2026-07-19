# Interaction Runtime · 接入指南

这份文档是写给**使用**这套 Runtime 的人看的：接入一个新的可拖拽对象类型
需要做什么。不假设你了解 Runtime 内部怎么实现——原理和设计取舍见
[DESIGN.md](./DESIGN.md)。

> **现状提示**：`useObject`/`useSurface`/`Action` 这套统一入口目前**还没有
> 实现**，是接下来要做的目标 API。现在能实际接入的方式是直接调用
> demo 里的拖拽编排函数（`startCardDrag`/`startCardDragDetach`）。本文档
> 分两部分：先讲现在真的能怎么接，再讲将来的目标是什么样子，两部分不要
> 混着读。

## 现在能怎么接（demo 阶段的真实用法）

以 [`KanbanBoard.vue`](../src/demo/KanbanBoard.vue) 为例，接入一个可拖拽
对象要做四件事：

**1. 给对象打上可识别的标记**

```html
<div class="my-card" :data-card="cardId" @pointerdown="onPointerDown(cardId, $event)">
```

`data-card` 是拖拽逻辑用来做 hit test（`document.querySelectorAll('[data-card]')`）
的约定，不是 Runtime 强制的协议，目前是 demo 自己定的约定。

**2. 选一种视觉策略，调用对应的拖拽函数**

```ts
// 路径按实际项目结构调整，这两个函数目前都在 src/demo/ 下
import { startCardDrag } from '{path-to}/kanbanDrag'          // clone 策略
import { startCardDragDetach } from '{path-to}/kanbanDragDetach' // detach 策略

function onPointerDown(cardId: string, event: PointerEvent) {
  const el = event.currentTarget as HTMLElement
  startCardDrag(event, cardId, el)       // 或 startCardDragDetach(event, cardId, el)
}
```

两种策略的选择依据见 [VISUAL_STRATEGIES.md](./VISUAL_STRATEGIES.md)。

**3.（仅 detach 策略需要）模板里包一层 `<Teleport>`**

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

**4. 让容器的 `TransitionGroup` 在被接管期间关闭**

```html
<TransitionGroup :css="!controlled">
```

```ts
import { useRuntimeTransition } from '{path-to}/vue/useRuntimeTransition'
const { controlled } = useRuntimeTransition(`column:${columnId}`)
```

这四步做完，这个对象就能参与"拖拽 + 跨容器移动 + 落地 + regrab + 清理"
这一整套流程，不需要再写一遍 proxy/FLIP/清理逻辑——但目前"业务数据怎么
变"（对应下面目标 API 里的 `Action`）是直接写在 `kanbanDrag.ts`/
`kanbanDragDetach.ts` 里的 `moveCard()` 调用，没有独立成一层，接入一个
新对象类型目前还是要照着这两个文件抄一份拖拽编排逻辑，只是不用重新
发明 Owner/Session/Cleanup 这些底层机制。

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

## 未来目标 API（还没有实现）

下面这套是接下来要做的目标形态，写在这里是为了让现在的接入方式和将来
的方向不互相矛盾——今天照"现在能怎么接"那节做的接入，将来迁移到这套
API 时改动应该是收敛（删掉手写的 Owner/Session 调用，换成注册），而不是
推倒重来。

**注册一个对象**：

```ts
const card = useObject({
  id: `project:${project.id}`,
  type: 'project-card',
  surface: `column:${project.status}`,
  abilities: ['move', 'sort'],
})
```

**注册一个容器**：

```ts
const column = useSurface({
  id: `column:${status}`,
  type: 'list',
  accepts: ['project-card'],
})
```

**开始一次交互**（不用自己调 `startCardDrag`，Runtime 按对象的 `abilities`
和这里的 `type` 决定要不要接、怎么接）：

```ts
runtime.start({ type: 'move', objectId: card.id, input: event })
```

**接收业务结果**（Runtime 只输出 `Action`，不直接碰 Store/API）：

```ts
runtime.onAction(async action => {
  await projectStore.applyAction(action)
})
```

组件里不需要再自己写：

```
createProxy / removePlaceholder / requestAnimationFrame / springTo
runFlip / pointerCapture / style.transform / hitTest
```

这些全部收在 Runtime 内部，一个对象注册一次，就具备参与"移动/排序/缩放/
连线"等各种 Session 类型的资格，不需要为每种交互类型各写一遍完整流程。

这套 API 现在没做的原因：`ObjectStore`/`SurfaceStore`/`Hit`/`Action` 这几个
模块都还是空的（见 [PLAN.md](./PLAN.md) 目录结构一节），需要先在真实场景
（阶段 1：迁移 Gugu-web 抽屉链路）里把 `Session` 的多参与者模型和完整
生命周期状态机（见 [DESIGN.md](./DESIGN.md) 原则 3/4）跑实，再抽象成这套
统一入口——过早把这套 API 做出来，大概率会做错，等真实接入场景多了之后
再抽会更准。
