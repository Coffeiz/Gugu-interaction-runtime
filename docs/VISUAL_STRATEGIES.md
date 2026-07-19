# 视觉策略：clone vs detach

拖拽时"跟手的那个东西到底是什么"是可以有不同实现的，Runtime 不绑死一种。
当前 demo 里两套都实现了，可以在页面顶部切换对比。本文档记录两者的能力、
限制，以及接入一个新对象类型时该怎么选、怎么接。

## 一句话对比

| | clone 策略 | detach 策略 |
| --- | --- | --- |
| 跟手的元素 | 克隆出来的 proxy（新节点） | 本体自己（同一个节点） |
| 原位置的本体 | 还在，靠 opacity/visibility 藏起来 | 不存在——`<Teleport>` 整个搬走 |
| 接入成本 | 低：业务组件不用改，Runtime 外部接管 | 中：业务模板要包一层 `<Teleport>` |
| DOM 节点数量峰值 | 2（本体 + proxy） | 1（同列内重排时）或 1（跨列，旧的销毁、新的创建，但同一时刻只有一个） |
| regrab 实现方式 | 需要专门的登记表（`landingRegrabs`），区分"点 proxy"和"点本体"两个入口 | 不需要登记表——随便点这个对象本身就是 regrab |
| 跨容器（跨列）时节点是否真的是"同一个" | 不适用（proxy 本来就是临时的） | **否**——见下面"已知限制" |

代码位置：
- clone：[`kanbanDrag.ts`](../src/demo/kanbanDrag.ts) + [`Visual.ts`](../src/dom/Visual.ts) 的 `createDragProxy`
- detach：[`kanbanDragDetach.ts`](../src/demo/kanbanDragDetach.ts) + `Visual.ts` 的 `applyFloatingStyle`/`clearFloatingStyle`

## clone 策略：能力与接入

**能力**：
- 原节点在拖拽全程保持挂载、保持原始布局位置（只是视觉上淡化），业务侧的
  尺寸测量、hover 状态等都不受影响。
- 接入成本最低：业务组件完全不用感知 Runtime，`startCardDrag` 从外部接管
  `sourceEl`，克隆、定位、销毁全部是 Runtime 自己的事。

**限制**：
- 同一个对象在"本体"和"proxy"两个节点上都可能触发 pointerdown，落地飞行
  期间必须专门维护一张"谁在 landing、regrab 入口在哪"的登记表
  （`landingRegrabs`），否则点本体会绕开 regrab、另起一个不连续的新 Session
  （这正是这次接入过程中先出现、后来专门修的一个问题）。
- 克隆节点默认 `box-sizing` 跟随浏览器默认值（`content-box`），如果业务
  CSS 没显式声明 `border-box`，直接把 `getBoundingClientRect()` 量出的宽高
  写进克隆节点的 `style.width/height` 会被当成内容尺寸、叠加 padding 撑大
  一圈——`Visual.ts` 里已经强制克隆节点自己用 `border-box` 来避免这个坑，
  但如果业务卡片本身的 CSS 用了非默认盒模型的怪异组合，仍然可能有细微
  尺寸差异，需要留意。

**接入方式**：业务组件只需要在 pointerdown 时调用
`startCardDrag(event, objectId, sourceEl)`，不需要改模板结构。适合"暂时
不想动业务模板、先用 Runtime 接管拖拽逻辑"的迁移场景。

## detach 策略：能力与接入

**能力**：
- 真正意义上的"全程只有一个对象"：抓起的时候，原来的位置里这个对象直接
  消失（不是淡化，是真的不在任何列表里），松手飞到目标位置后原样保留。
- regrab 不需要专门代码：不管点的是"正在跟手的它"还是"正在飞回去的它"，
  都只是对同一个节点、同一套逻辑再调用一次 `startCardDragDetach`。旧
  Session 结束时只释放自己持有的 Lease，新 Session 早已用自己的
  `sessionId` 覆盖了 Owner 里的归属记录，两者不会互相干扰（`Owner.ts` 的
  `ownerSessionId` 校验就是为这个设计的）。

**接入方式**：业务模板需要在渲染每个可拖拽对象时包一层：

```html
<Teleport to="body" :disabled="!isDetached(objectId)">
  <div class="my-card" :data-card="objectId" @pointerdown="onPointerDown">
    ...
  </div>
</Teleport>
```

`isDetached(objectId)` 直接读 `runtime.owner.isControlled(objectId)`
（见 `KanbanBoard.vue`），不需要额外包一层 `computed`——Owner 内部是
`reactive(Map)`，模板渲染时读取会被 Vue 的响应式系统正常追踪。

拖拽逻辑（`kanbanDragDetach.ts`）负责：
1. `takeObject` 拿到一个独立的 Lease（不放进 `session` 统一的 lease 数组，
   因为它要比 Surface 的 Lease 更早释放）。
2. 用 `applyFloatingStyle`/`moveFloating` 给本体自己钉 `position:fixed`
   跟手。
3. 松手时：记下当前浮动位置（`beforeRect`），清掉浮动样式，**单独**释放
   对象的 Lease（这一步会让 `isDetached()` 变 false，Vue 下一帧就会把
   它摆回真实列表位置）；Surface 的 Lease（列的 `TransitionGroup` 总闸）
   继续留着，直到落地动画播完才和 Session 一起释放。
4. 下一帧，Vue 已经把节点放回真实位置，重新查询当前渲染出来的节点（**不能
   用旧的 `sourceEl` 引用**，原因见下面"已知限制"），用 `playFlip` 从
   `beforeRect` 补一段 FLIP 过渡，视觉上就是"飞过去"。

## 已知限制：跨列表移动时不是真的"同一个 DOM 节点"

这是这次实现过程中发现、并已经修复了视觉表现（但没有、也不可能完全消除
根因）的一个问题，值得写清楚：

**现象**：同一列内重排（比如列表内部换个顺序）时，Vue 确实复用同一个 DOM
节点——`<Teleport>` 把它搬到 body、再搬回来，前后是同一个元素引用。但**跨
列**移动（比如从"待开始"拖到"进行中"）时，Vue 会在源列销毁这个节点、在
目标列创建一个全新的节点——`落地` 阶段如果继续用拖拽开始时拿到的
`sourceEl` 引用去做 FLIP，会作用在一个已经从文档里断开、肉眼看不见的孤儿
节点上，用户看到的是目标列瞬间蹦出一个新卡片，没有飞行过程。

**根因**：这不是 Teleport 的 bug，是 Vue 列表 diff 的正常边界——`v-for`
的 key 匹配只在**同一个** `v-for`/`TransitionGroup` 实例内部生效；一个
对象从数组 A 移到数组 B（哪怕两个数组渲染出来看着像"同一个看板的两栏"），
对 Vue 来说是"A 里的一项被删了，B 里多了一项完全陌生的新数据"，天然对应
到销毁一个 vnode、创建另一个 vnode，`<Teleport>` 只能搬运"还活着"的
vnode，搬不动"从一个数组消失、在另一个数组出现"这件事本身。

**当前的应对**：landing 阶段不再信任闭包里的 `sourceEl` 引用，而是重新
`querySelector` 拿"此刻真正渲染出来的那个节点"——同列场景查到的还是原节点，
跨列场景查到的是目标列刚创建的新节点，两种情况都能正确对它做 FLIP，视觉上
看不出差别。**但节点的 JS 引用/组件实例本身确实不是同一个**——如果未来
业务对象上挂了什么"节点级"的状态（比如一个视频卡片正在播放、一个可展开
面板记着展开状态），这些状态挂在旧节点上会随着跨列移动丢失，需要额外把
这类状态从"DOM 节点的隐式状态"提升成"业务数据的显式状态"，不能依赖节点
本身活下来。

**如果需要真正跨容器保持同一个节点**：只有一个更彻底的做法——把"这个对象
当前被 Runtime 接管、要渲染在哪"整体拿出 `v-for`，改成在应用根部只挂一个
全局的 `<Teleport>`，专门渲染"Runtime 当前正抓着的那一个对象"，业务列表
本身的 `v-for` 在这段时间里根本不渲染这一项（而不是渲染出来再被
`:disabled` 蒙住）。这样"抓起来的东西"和"落回列表的东西"从一开始就是
两个不同阶段的不同 UI 表现，不强求它们是同一个 DOM 节点，只要求"看起来
是同一个对象"——这其实和 clone 策略的思路殊途同归了，只是"克隆体"换成了
"全局唯一的接管态渲染"。这次没有做这一步，因为当前 demo 的验收标准是
"视觉连续、数据正确、无残留"，都已经满足；如果后续业务真的需要节点级
状态跨列存活，再回来做这一步。

## 该选哪个？

- 业务对象没有节点级状态（只是展示数据 + 位置），两种都能用；detach 的
  regrab 心智模型更简单，优先选 detach。
- 业务对象有节点级状态、或者暂时不想改造业务模板结构，选 clone，接受
  "需要专门处理 regrab 入口"这个复杂度。
- 两种策略共享同一个 Owner/Session/Cleanup 核心，可以按对象类型甚至按
  单次交互混用，不是全局二选一。
