# Interaction Runtime · 设计目标

> 当前实现版本：0.9.6。接入步骤和公开参数请先阅读
> [INTEGRATION.md](./INTEGRATION.md)。

## 先看结论

Interaction Runtime 是一层交互执行器：它接收对象和容器的注册信息，创建并管理
一次交互的 Session，处理命中、跟手、落点、运动、落地、揭示、取消和清理，最后
通过语义化 Action 通知业务保存结果。

业务端不需要知道 proxy、placeholder、FLIP 或 regrab 的时序。通常只需要：

1. 注册对象（身份、DOM、所在 Surface、能力）；
2. 注册 Surface（边界、类型、接受的对象）；
3. 订阅 Action 并更新自己的 Store；
4. 按需提供样式或 `VisualAdapter`。

```text
Vue / React
  ├─ Object 注册 ─┐
  ├─ Surface 注册 ├─> Runtime ─> Session / Hit / Move / Motion / Layout
  └─ Action 订阅 ┘                         │
                                           └─> 业务 Store/API
```

### 阅读顺序

- 只想接入：阅读 [INTEGRATION.md](./INTEGRATION.md)；
- 想理解模块职责：阅读本文的“核心原则”和“分层边界”；
- 想继续开发：再阅读 [PLAN.md](./PLAN.md)；
- 想排查具体历史问题：阅读 `docs/devlog/`，不要把排查过程当作设计契约。

### 当前实现与规划的区别

本文同时保留了一些用于解释演进方向的设计约束。凡是标注“未来/规划”的内容，
不代表当前 API 已经提供；当前可用入口以 `src/index.ts` 和
[INTEGRATION.md](./INTEGRATION.md) 为准。

## 背景

咕咕（Gugu-web）里项目卡拖拽、状态组折叠、抽屉高度联动这类交互，本质上都是
"一段有时序、有中间态、需要临时视觉对象"的过程。这类过程如果完全用 Vue 的
`Transition`/`TransitionGroup`/响应式更新去表达，会出现三类反复出现的问题：

1. **重叠控制**：同一个 DOM 属性（`height`/`transform`/`opacity`）同时被 Vue
   的生命周期钩子和自定义动画代码写入，谁的写入生效取决于时序，容易产生
   "动画播完又跳一下""二次 FLIP"这类 bug。
2. **所有权真空**：自定义动画代码之间用 WeakMap/token 互相判断所有权，但这套
   判断挡不住 Vue Transition 在旁边继续操作同一个元素——所有权模型不完整。
3. **交接时机不明确**：一段交互结束、把 DOM 交还给 Vue 的那一刻最容易出错
   （例如折叠动画结束后何时能安全恢复 `height:auto`，恢复早了会闪一下自然
   高度，恢复晚了 v-if 卸载时机会对不上）。

Gugu-web 的 `interaction/drag/` 目录已经长出了这套机制的雏形（`layoutOwners`、
`FlipTransaction`、`createGroupLayoutTransaction`、`morphLifecycle`），但都是
针对具体 bug 各自实现的局部方案，没有统一的所有权模型。

## 设计目标

做一个独立于具体业务的 **Interaction Runtime**：负责交互过程中的临时视觉对象
和动画时序，将其从 Vue 的响应式更新循环中完全分离出来。

```
业务层（Project / File / Calendar / Mind）
  决定发生什么，保存什么
        ↓
Vue（Components / Store / Interaction Hooks）
  创建真实 DOM，展示业务状态
        ↓
Interaction Runtime
  负责交互过程、临时视觉对象和动画
```

一句话：**Core 管事务，DOM 层管视觉，框架适配层管界面，Store/API 管事实。**

Core 不依赖 Vue，也不使用 `reactive`。Vue 和 React 通过订阅/快照适配同一个
Runtime；DOM 层依赖浏览器，但不依赖具体 UI 框架。

浏览器相关实现通过 `src/dom/index.ts` 统一导出；Core 只依赖 Hit/Visual 等
接口，迁移期间旧模块路径保留兼容，避免一次性移动文件造成业务侧大面积改动。

Hit 通过 `runtime.setHitResolver()` 注入。Runtime/Behavior 只消费统一的
`findSurface`、`findTarget`、`findIndex` 结果，不依赖项目卡或某一种 DOM 结构。

多组展开/收起属于独立的 `GroupLayout` 能力，不并入 `MoveBehavior`：它负责组
高度测量、组级 FLIP、Surface resize 和滚动锚点；框架适配层只保存展开状态并
触发事务请求。

组级 FLIP 使用 Relative FLIP：Runtime 捕获所有 `data-layout-group` 节点的
前后屏幕位移，并从每个节点（组或卡片叶）的位移中减去直接父组位移。只有
剩余局部位移才写入 transform；因此父组整体移动时，内部月组/卡片会自然随
父级移动而不重复动画，同一月内真正重排的兄弟卡片仍会播放 FLIP。业务只标注
布局组节点，不把“年组”“月组”等领域名称传入 Runtime。

卡片进出导致容器高度变化时，`GroupLayout` 以 `data-layout-surface` 标记的
Surface 捕获前后边框盒高度，播放 height resize；不尝试用 transform 伪造尺寸
变化。一次布局事务可以同时包含组的 Relative FLIP 与 Surface resize。

Surface 的运动所有权属于 Runtime：它负责 before/after 测量、位置/尺寸补间、
中断重定向和 transition 清理。业务只声明节点所属的 Surface 类型与策略，不能
在同一节点上自行写竞争性的 `height`、`width`、`transform` 或 `transition`。
当前 Surface resize 参数统一通过 `runtime.configureMotion({ resize })` 配置，
不再使用单独的 `registerSurfaceLayout()` 入口。

业务模板只需标注：

```html
<div data-layout-surface data-surface-type="kanban-column">...</div>
```

### 裁剪边界与临时视觉层

裁剪不是由某个动画临时猜测，而是固定的层级契约：Surface 是真实内容的裁剪
边界；Group 根与正常展开的内容层必须 `overflow: visible`，因此内部 Relative
FLIP 不会被年/月容器截断。只有折叠中的内容包装层可以临时写
`overflow: hidden`。

proxy 和 landing visual 不属于真实内容树。包括 detach 策略在松手后的短暂
交接 visual，Runtime DOM 层都直接把它们挂到 `document.documentElement`（`<html>`）
下，永远绕过 Surface、应用壳和 Group 裁剪；业务不需要也不应把临时 proxy 插入自己
的列表容器。

早期版本经过一个中间 `data-runtime-overlay` 固定容器统一管理这些代理，实际逃出
裁切靠的是"挂到 `<html>`"这个动作本身，不是这层容器——容器只是把 z-index/
pointer-events 集中管理，代价是多一层间接引用，曾导致代理销毁时机被拖到比
本体揭示晚好几步（`session.handoff()` → `finishReveal()` → `port.end()` 这条链
路），本体和代理短暂同时可见。现在代理直接挂到 `<html>`、自带最高 z-index，
销毁时机改为紧跟在本体揭示的同一个微任务里执行。

### 视觉适配器与状态交接

Runtime 不固化具体卡片的颜色、圆角或阴影，而是由业务适配器提供视觉实现，
Runtime 统一保存状态并编排本体与 proxy 的交接：

```ts
type VisualPhase =
  | 'idle'
  | 'pressed'
  | 'dragging'
  | 'landing'
  | 'revealing'

interface VisualState {
  phase: VisualPhase
  hovered: boolean
  selected: boolean
  grabbed: boolean
}

interface VisualAdapter {
  getSourceElement?(): HTMLElement | null
  createProxy?(snapshot: VisualSnapshot): HTMLElement
  applyState?(element: HTMLElement, state: VisualState): void
  captureStyle?(element: HTMLElement): VisualSnapshot
}

interface VisualSnapshot {
  rect: DOMRect
  borderRadius: string
  boxShadow: string
  background: string
  opacity: string
  transform: string
}
```

适配器是可选覆盖，不是每种对象都必须实现的完整生命周期接口。没有注册适配器
时，Runtime 使用默认的 source/target DOM 解析、计算样式快照和状态 class；注册后只覆盖业务
明确提供的字段，其余行为仍回退到默认实现。

落地时由 Runtime 从目标节点当前计算样式生成一次快照；因此目标处于 hover 时，代理会
继续使用 hover 阴影、背景和圆角，直到本体接管。Runtime 不重新监听代理上的
 pointer 事件，也不在交接中重新推断 hover。

业务层负责 `VisualAdapter` 和各状态的具体 CSS；Runtime 负责：

- 保存唯一的 `VisualState`，让本体与 proxy 消费同一份 hover/抓取状态；
- 在 landing/reveal 阶段同步阴影、缩放、圆角和 hover 状态；
- 编排 proxy → 本体的渐变交接、清理和取消；
- 确保同一时刻只有一个视觉主体拥有控制权。

因此 hover 判定可以由业务层提交，但代理和本体不能各自监听 pointer 或独立
计算 hover。运动参数（速度、阻尼、弹簧强度）属于 Runtime 的 motion profile；
颜色、阴影、圆角、背景等纯视觉样式属于业务适配器。接入方可以自由替换这些
样式，而不需要重新实现生命周期。

## 核心原则

### 1. 对象级控制权是总闸，不能只做 channel 锁

`channel`（`position`/`transform`/`opacity`/`height`...）级别的所有权只能解决
Runtime **内部**模块之间（Motion vs Layout）的冲突，解决不了 Runtime 与 Vue
之间的冲突——因为 Vue 的 Transition/TransitionGroup 不会向 Runtime 申请
channel，它会在生命周期钩子里直接读写样式。

所以必须有一层对象级总闸：

```ts
type ControlMode = 'vue' | 'runtime'
```

- `mode = 'vue'`：Vue 正常执行 Transition、TransitionGroup、声明式样式。
- `mode = 'runtime'`：Vue 只允许更新内容和业务结构，禁止控制该对象的过渡
  动画和视觉几何。

`channel` 所有权仍然有用，但只用于 Runtime 内部模块协调，是第二层。

### 2. 接管单位是"布局影响范围"，不是单个对象

拖动一张卡片，影响的不只是这张卡片本身，还有它所在的组、组所在的容器、
可能因此改变高度的祖先。接管范围必须包含这条链上所有会被联动布局的对象和
区域（Surface），否则会出现"新模型接管了卡片，旧模型还在控制它所在的组"
的混合态——这比完全不接管更难排查。

```ts
interface Session {
  objects: Set<ObjectId>
  surfaces: Set<SurfaceId>
  takeObject(id: ObjectId): void
  takeSurface(id: SurfaceId): void
}
```

### 3. 交还 Vue 是显式阶段，不是 release 之后自动生效

`release()` 不等于"Vue 立刻恢复控制且不会误播动画"。需要显式的 `handoff`
阶段：业务状态先稳定、Vue DOM 先更新完、Runtime 把本体和临时视觉对象对齐、
清除 Vue 可能误判的 move/enter 状态，下一帧才移除临时样式、恢复 Vue
Transition。

完整的生命周期比"active → landing → handoff → done"这四段更细——写代码时
按这四段实现是够用的最小集，但设计上要留出以下这些位置，否则"取消""保存
失败回滚""按下但还没真正开始动"这几类场景会无处安放：

```
idle
  ↓ pointerdown
prepare        # 注册参与者、申请 Owner、读取初始几何——还没决定要不要真的动
  ↓ 判定为一次真实拖动（而不是误触/单击）
active         # proxy/本体跟手、hit test、兄弟对象让位
  ↓ pointerup
release        # 确定空间结果，生成业务 Action（还没提交）
  ↓
landing        # 飞向目标位置
  ↓
saving         # 提交 Action 到 Store/API——可能异步、可能失败
  ↓
handoff        # 等 Vue 生成最终 DOM，完成视觉交接
  ↓
done → disposed
```

任何阶段都可能转向"非正常结束"分支，这些分支不是事后补丁，是设计一开始
就该留的出口。`interrupt` 是已经完成取消语义的终止态，清理时必须直接进入
`disposed`，不能再经过 `done`；`done` 只表示正常完成的事务，避免 regrab
触发非法的 `interrupt → done` 状态转换：

- `active → cancel`：松手时没有命中任何有效 Surface，回到抓起前的位置，
  不生成 Action。
- `landing → interrupt`：飞行途中被重新抓起（regrab），旧 Session 结束
  自己、新 Session 从当前视觉位置接着走——见 `Owner` 一节的 Lease 抢占。
- `saving → rollback`：业务提交失败，视觉上要能退回去，而不是留在一个
  "看起来已经落地、实际没保存成功"的悬空状态。
- 任意阶段 `→ dispose`：只清理自己名下的资源，不影响其他 Session（规则 5）。

```ts
type SessionState =
  | 'idle' | 'prepare' | 'active' | 'release'
  | 'landing' | 'saving' | 'handoff'
  | 'done' | 'cancelled' | 'disposed'
```

（当前 demo 的 `Session.ts` 只实现了 `active/landing/handoff/done/cancelled`
这个精简子集——`prepare`/`release`/`saving`/`interrupt`/`rollback` 还没有
对应代码，见 [PLAN.md](./PLAN.md) 的执行计划。这里先把完整状态机的"坑位"
定下来，避免以后补这些分支时要推翻现在的结构。）

### 4. 对象只声明身份、DOM 和能力，不自己管生命周期

一个业务对象（项目卡、文件、便签、日历事件）注册进 Runtime 时，只需要回答
三个问题：**我是谁、DOM 在哪、能参与哪些类型的 Session**——不需要自己实现
拖拽、落地、打断、清理这套流程。这套流程由 Runtime 在对象声明的能力基础上
统一执行：

```ts
interface ObjectItem {
  id: string
  type: string          // 'project-card' / 'file-item' / 'mind-note' ...
  surfaceId: string      // 当前所在的 Surface
  element: HTMLElement | null
  abilities: string[]    // 'move' / 'sort' / 'resize' / 'link' ...
}
```

一个对象可以拥有多种 abilities，也就可以参与多种 Session 类型——同一张
便签既可以参与 `MoveSession`，也可以参与 `ResizeSession`/`LinkSession`，
Runtime 按 `runtime.start({ type, objectId })` 里的 `type` 和这个对象声明
的 `abilities` 决定要不要接、接了之后走哪套流程。对象自己不需要为每种
Session 类型各写一遍启动/跟随/落地/清理逻辑。

**一次 Session 的参与者通常不止一个对象**。表面上"拖一张项目卡"，实际
参与者可能包括：被拖的卡片本身、proxy/placeholder 这类临时视觉对象、源
Surface 和目标 Surface、因为让位而被牵动的相邻卡片、卡片所在的分组、
分组所在的抽屉容器。所以 `Session` 的接管范围不是单个 `objectId`，而是
一个以主对象为核心、按需动态收编的集合：

```ts
interface Session {
  mainObject: ObjectId
  objects: Set<ObjectId>
  surfaces: Set<SurfaceId>
}
```

准确的说法不是"一个对象自己完成全部生命周期"，而是：**对象提供身份、DOM
和能力；Runtime 为它创建 Session，协调这次交互里所有参与者的完整生命周期**。
这也是为什么"新增一种可交互对象类型，不需要重写一遍拖拽/落地/打断/清理"
能够成立——这些流程属于 Runtime，不属于对象。具体怎么注册一个对象、怎么
接入现有业务组件，见面向使用者的 [INTEGRATION.md](./INTEGRATION.md)。

### 5. 不可违反的规则（写进代码评审的检查项）

1. Runtime 接管对象后，对应 Vue Transition 必须关闭（`:css="!controlled"`
   或整体禁用）。
2. Runtime 接管 Surface 后，该区域的 TransitionGroup 和旧 FLIP 必须跳过。
3. Vue 可以更新业务内容和 DOM 结构，但不能播放视觉过渡。
4. 所有临时 `transform`/`height`/`opacity`/`visibility` 必须由 Runtime
   统一恢复，不能散落在各处 cleanup 里各自还原。
5. 旧 Session 只能释放自己持有的 Lease，不能重置对象当前样式（不能"我以为
   我在收尾，实际上把别人正在用的样式擦掉了"）。
6. Runtime 完成交接后，先清除临时视觉样式，再恢复 Vue 控制。
7. Vue 恢复控制的那一帧不得再次执行 enter/move 动画——这是最容易漏掉、
   也是最容易复现"落地完成后又补播一次"的一条。

### 5. Runtime 是执行层，不只是 Service Container

Runtime 对外接收完整交互请求，由 `Behavior` 负责具体编排：

```ts
runtime.start({ type: 'move', objectId, input })
runtime.update(sessionId, input)
runtime.release(sessionId, input)
runtime.cancel(sessionId, reason)
runtime.interrupt(sessionId, reason)
```

`MoveBehavior` 只保存一次移动事务的行为状态；`VisualAdapter`、`Hit` 和
`GroupLayout` 作为 Runtime 内部组件继续提供已有的视觉、命中和布局实现。Runtime
负责把完整生命周期编排起来并提供统一注册 API；页面只注册 Object 和 Surface，不再
自行拼接 proxy、landing、FLIP、regrab 或通用清理步骤。


Behavior 执行期间通过上下文取得本次对象的能力：

```ts
interface BehaviorContext {
  session: Session
  visual?: VisualAdapter
  hit?: HitResolver | null
  emitAction?: (action: Action) => void
}
```

这些依赖按 Session 注入，不能在 Behavior 内保存全局可变对象；Session 结束后
对应的对象映射和视觉/命中上下文一并失效。

### 6. 分层边界

```text
interaction/
├── core/   # 框架无关：Runtime、Session、Store、Owner、Behavior、Action
├── dom/    # 浏览器相关：Input、Measure、Hit、Visual、Motion、Layout
├── vue/    # Vue 响应式与 Transition 接入
└── react/  # 未来的 React adapter
```

Core 可以依赖 TypeScript、Map/Set 和 AbortController；DOM 层可以依赖
`HTMLElement`、`requestAnimationFrame` 和浏览器事件，但 Core/DOM 不应反向依赖 Vue。

## 非目标

- 不重造 Vue，不做通用状态管理/渲染框架。
- 不要求全站交互一次性迁移；第一阶段验证机制本身，验证通过后再逐步扩大
  接管范围。
- 不追求覆盖所有可能的交互类型（拖拽/缩放/连线/窗口...）——先把"拖拽 + 布局
  联动"这一类做扎实，其余类型复用同一套 Session/Owner 模型时再按需扩展。

## 文档分工

这份文件只回答"为什么这样设计"，是写给要理解/修改 Runtime 本身的人看的。

- 具体的分层结构、模块职责表、目录结构、分阶段执行计划、Gugu-web 现有
  代码到新分层的映射，见 [PLAN.md](./PLAN.md)——同样是给自己看的，关注
  "现在做到哪了、下一步做什么"。
- 当前 Demo 默认使用 detach；具体视觉策略由 `VisualAdapter` 和对象注册配置决定。
- 怎么把一个新的业务对象接进来（注册 Object/Surface、Vue 模板怎么写、
  业务层怎么收 Action），见 [INTEGRATION.md](./INTEGRATION.md)——这份是
  写给未来接入这套 Runtime 的使用者看的，不假设读者了解 Runtime 内部
  实现，只讲"要调用什么、要在模板里写什么"。
