# Interaction Runtime · 设计目标

## 背景

咕goo（Gugu-web）里项目卡拖拽、状态组折叠、抽屉高度联动这类交互，本质上都是
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

一句话：**Runtime 管过程，Vue 管界面，Store/API 管事实。**

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
就该留的出口：

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
- 两套视觉策略（clone/detach）的能力对比和取舍，见
  [VISUAL_STRATEGIES.md](./VISUAL_STRATEGIES.md)。
- 怎么把一个新的业务对象接进来（注册 Object/Surface、Vue 模板怎么写、
  业务层怎么收 Action），见 [INTEGRATION.md](./INTEGRATION.md)——这份是
  写给未来接入这套 Runtime 的使用者看的，不假设读者了解 Runtime 内部
  实现，只讲"要调用什么、要在模板里写什么"。
