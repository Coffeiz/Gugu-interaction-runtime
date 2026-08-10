# Interaction Runtime · 分层结构与执行计划

> 当前稳定版本：2.0.0。Runtime 2.0.0 已以 Gugu-web 的真实看板作为回归场景，
> 验证“只注册 Object、Surface、Target 和 Action 即可接入业务”的 Runtime 契约。Gugu-web
> 直接编译本仓库 `src/`，不经 npm 包或构建产物。

设计动机见 [DESIGN.md](./DESIGN.md)。本文件是具体的模块划分、目录结构和
分阶段执行计划——写给自己看的架构/进度文档。如果你是要接入这套 Runtime
的使用者，看 [INTEGRATION.md](./INTEGRATION.md) 就够了，不用读这份。

## 一、三层职责

```
Gugu App
│
├── Business          决定发生什么，保存什么
│   ├── Project
│   ├── File
│   ├── Calendar
│   └── Mind
│
├── Vue                创建真实 DOM，展示业务状态
│   ├── Components
│   ├── Store
│   └── Interaction Hooks
│
└── Interaction Runtime  负责交互过程、临时视觉对象和动画
    ├── Runtime
    ├── Session
    ├── Object
    ├── Surface
    ├── Input
    ├── Hit
    ├── Owner
    ├── Visual
    ├── Motion
    ├── Layout
    ├── Render
├── Action
    ├── VueControl
    └── Cleanup
```

## 二、核心模块职责

| 模块 | 职责 |
| --- | --- |
| `Runtime` | 组织其余模块，不写具体项目逻辑 |
| `Session` | 一次完整交互（拖拽/缩放/连线...），声明 `objects`/`surfaces` 接管范围 |
| `ObjectStore` | 注册可交互对象（`project-card`/`file-item`/`mind-note`...） |
| `SurfaceStore` | 注册可容纳对象的区域（列/文件夹/日期格/画布/垃圾桶...） |
| `Input` | 鼠标/触摸/键盘输入 |
| `Hit` | 判断指针命中了谁、命中了哪个 Surface |
| `Owner` | 对象级 `ControlMode` 总闸 + channel 级 Lease，两层控制权 |
| `Visual` | proxy、placeholder、辅助线等临时 DOM，随 Session 创建/销毁 |
| `VisualAdapter` | 业务可选的对象视觉覆盖；未注册时由 Runtime 使用默认 DOM 解析与样式快照 |
| `Motion` | 跟随、弹簧、惯性、落地动画 |
| `Layout` | 排序、重排、FLIP、布局变化 |
| `GroupLayout` | 多组展开/收起的高度测量、Relative Group FLIP 与滚动锚点 |
| `Render` | 统一读取/写入 DOM 的出口，避免各模块各自读写产生撕裂 |
| `Action` | Session 结束后输出的业务结果（`MoveAction` 等），不直接碰 Store/API |
| `VueControl` | 告诉 Vue 侧某对象/Surface 当前是否被 Runtime 接管，Transition 是否应关闭 |
| `Cleanup` | 统一清理监听器、RAF、临时 DOM、Lease |

## 三、核心流程（以项目卡跨列移动为例）

```
pointerdown
  → Input 收到输入
  → Runtime 创建 Session
  → Session 声明 objects/surfaces 接管范围，Owner 关闭对应 Vue Transition
  → Visual 创建 proxy / placeholder
pointermove
  → Hit 判断当前 Surface
  → Layout 移动 placeholder
  → Motion 更新 proxy
pointerup
  → 生成空间结果 → 转换成 Action
  → 业务层更新 Store / API
  → Vue 渲染最终 DOM（仍处于 runtime 接管态，不播放 Transition）
  → Runtime 播放落地动画
  → handoff：对齐本体与临时视觉对象，清除 Vue 误判的 move/enter 状态
  → 恢复 Vue Transition，Cleanup 清理
```

## 四、目录结构（2.0.0）

```
src/
├── Runtime.ts              # 对外编排门面
├── core/                   # 框架无关事件与交互公共类型
├── behavior/               # 行为注册与移动事务
├── session/                # Session 状态机与生命周期
├── object/                 # 业务对象注册表
├── surface/                # 可接收对象的容器注册表
├── input/                  # 指针生命周期、取消与 regrab
├── owner/                  # ControlMode 与 channel Lease
├── action/                 # 业务可消费的语义事件
├── motion/                 # 速度、landing、retarget 与运动配置
├── dom/                    # 浏览器视觉、命中、测量与布局实现
│   ├── Visual.ts
│   ├── VisualAdapter.ts
│   ├── Hit.ts
│   ├── GroupLayout.ts      # 组展开/收起与组级 FLIP
│   └── ...
├── runtime/                # 默认编排与 detach 视觉策略
│   ├── RuntimeInput.ts
│   ├── RuntimeMove.ts
│   ├── RuntimeSession.ts
│   ├── RuntimeVisual.ts
│   └── detach/DetachAdapter.ts
├── adapters/               # Vue/React DOM 生命周期适配器
│   ├── vue.ts
│   └── react.ts
└── demo/                   # 看板、文件系统与调试演示
```

## 五、执行计划

### 当前稳定基线

Runtime 2.0.0 当前基线为提交 `4fde68e`（`完善抓取代理紧凑布局配置`）。
Session、MoveBehavior、Action、MotionController、landing/reveal、regrab、FLIP、
Vue/React DOM 适配器、文件系统 Demo 和 `proxyLayout` API 均已进入稳定实现。
后续新增能力继续从独立分支开始，并通过 Demo 与浏览器回归验证；Gugu-web 文件页、
画布和多选等业务迁移仍按阶段 2/3 的计划推进。

### 阶段 0：本仓库内的最小骨架（demo，不接业务）

> 说明：demo 只用于验证 Runtime 核心协议，不承担 Gugu-web 的完整业务迁移。
> clone/detach 看板示例保留作历史对照和回归观察；0.5 阶段只收紧 Runtime
> 执行层，不继续搬迁业务生命周期。

目标：只验证机制本身有没有设计缺陷，不接 Gugu-web 任何真实组件。

- [x] `Runtime`/`Session`/`Owner`（对象级 `ControlMode` + channel Lease）
- [x] `Visual`/`Layout` 的最小实现，并由 MotionController 提供跟手、释放和 landing 运动
- [x] `Cleanup`
- [x] demo 页面：三列看板（两个普通列 + 一个按分组展示的完成列），验证
      跨列拖拽触发兄弟重排 + 列表自身高度变化
- [x] Demo 通过 `runtime.isControlled()` 和 `runtime.onOwnershipChange()` 控制
      `<TransitionGroup :css>`；不再引入 Vue 专用 transition composable

验收标准（均已在浏览器 + 程序化 pointer 事件下验证，见 2026-07-19 两次提交）：
- [x] 连续拖拽、中途中断（regrab）、快速连续操作，不出现"两套动画都在跑"
      的画面撕裂
- [x] 旧 Session 不会清理新 Session 的样式（regrab 走显式 `endSession`；
      绕过 regrab、直接在旧 Session landing 中途对同一对象开新 Session
      的极端情况下，靠 Owner 的 `ownerSessionId` 校验也不会互相清理）
- [x] 所有监听器和 RAF 都能在 dispose 后验证确实清空——`Cleanup` 模块
      维护全局活跃计数，5 次快速连续拖拽压力测试后计数归零

### 阶段 0.5：Core 去框架化并建立真正的执行层

这一阶段先不接入 Gugu-web，先把当前 demo 骨架整理成可被 Vue/React 共同使用的
交互内核：

- [x] `ObjectStore`/`SurfaceStore` 改为普通 `Map`，移除对 Vue `reactive` 的依赖
- [x] Runtime 增加事件订阅和只读快照，Vue 通过 `useRuntime` 包装为响应式，未来
      React 通过 `useSyncExternalStore` 接入
- [x] 增加 `BehaviorRegistry`，由 Runtime 根据 `request.type` 选择行为
- [x] `Runtime.start/update/release/cancel/interrupt` 成为统一入口
- [x] Session 状态转换集中校验，demo 编排已改用 `Session.transition()`；后续
      `MoveBehavior` 迁移时继续保持该入口，不允许 adapter 直接写状态。
- [x] 抽出 `MoveBehavior`，把移动事务状态、跟手更新、落地/reveal 调用时机和
      handoff 生命周期收回 Runtime；proxy、placeholder 和具体 tween 作为
      clone/detach driver 的视觉策略保留——按分阶段方案推进，每阶段独立验证：
      - [x] 已建立无 DOM 的生命周期适配器；当前 demo 通过 Runtime 入口接入，
            仅保留业务命中与 Action 回调
      - [x] clone/detach 已改用 `runtime.start({ type: 'move' })` 创建 Session
      - [x] 阶段 A：`MoveContext`（sourceElement/dragOffset/visualSnapshot/
            destination）挂在 `MoveBehavior` 自己的 Map 上，不塞进通用 Session
      - [x] 阶段 B：sourceElement 解析 + dragOffset 计算收进
            `MoveBehavior.prepare()`，clone/detach 不再各自重复计算一遍；
            regrab 场景的特殊起点偏移仍由 driver 算好后写回 MoveContext
      - [x] 阶段 C：跟手定位（`followElement` 跟着指针跑）收进
            `MoveBehavior.update()`；命中判定（认业务的落点数据形状）仍留在
            driver，没有强行拉平
      - [x] 阶段 D：业务数据变化改走 `runtime.emitAction()` /
            `runtime.onAction()`，driver 不再直接调 `moveCard()`——
            `MoveAction` 补充了可选的 `toIndex` 字段
      - [x] 阶段 E（部分）：落地飞行期间的 regrab 登记表（对象级，谁在处理
            重新抓起）从 demo 模块作用域收进 `MoveBehavior`/`Runtime`
            （`registerRegrab`/`getRegrab`/`clearRegrab`）
      - [x] 阶段 E：landing/reveal 生命周期注册、重复调用保护、Session
            结束和异步失效检查收进 Runtime；具体 FLIP/tween 仍由 driver 实现
      - [x] 阶段 F：demo 已缩减为输入、命中、业务 Action 和策略视觉回调；
            proxy/placeholder 的具体创建不再被误认为 Runtime 通用能力
      - [x] 阶段 G（部分）：`kanbanDrag.ts` 里的 `[clone-landing-probe]`
            调试日志已清理
- [x] 增加 `VisualAdapter` 注册表和默认 source/target/视觉快照解析
- [x] 增加 `Action` 联合类型与 `runtime.onAction()` 输出通道
- [x] clone/detach 输入、落点结果和初始/落地视觉状态已通过 Runtime 边界
- [x] 将浏览器相关能力归入 `dom/`，保持 Core 不依赖 Vue
      - [x] 增加 `src/dom/index.ts` 统一导出 Hit、Flip、GroupLayout、Visual、
            VisualAdapter 和视觉快照类型
      - [x] `Hit.ts`/`Flip.ts`/`GroupLayout.ts`/`Visual.ts`/`VisualAdapter.ts`/
            `VisualAdapterTypes.ts` 已物理迁移到 `dom/`（不再是转发旧路径的
            壳），`src/hit`/`src/layout`/`src/visual` 旧目录已删除，全仓库
            引用方（`Runtime.ts`/`index.ts`/`behavior/`/`demo/`）已切到新路径

完成标准：页面调用 `runtime.start()` 后，Session 状态、landing/reveal
时机、异步取消和最终结束由 Runtime 统一负责；页面只提供对象策略所需的
视觉 driver（例如 clone 的 proxy、detach 的本体浮动实现）。

### 阶段 0.6：补齐完整生命周期状态机

在扩大接管范围之前先补的几个缺口（见 DESIGN.md 原则 3/4 的完整状态机和
Object/Session 模型）——都是目前 demo 里"能跑，但没做全"的部分：

- [x] `Session` 状态机补上 `prepare`/`release`/`saving`/`interrupt`/
      `rollback`；状态转换已集中在 `Session.transition()`，demo 入口不再直接写状态
- [x] "抓起即视为脱离所有 Surface"（悬空态）：clone 入口抓起时创建
      placeholder，拖动阶段不提交 `moveCard`，松手才一次性提交目标位置
- [x] 松手时没有命中任何有效 Surface → 触发 `cancel`，恢复源视觉状态；
      clone 与 detach 两条 demo 入口都已接入无效落点取消
- [x] `ObjectStore`/`SurfaceStore` 最小实现 + `abilities` 声明，替代现在
      `session.takeObject(cardId)` 直接吃裸字符串、没有注册表的做法。
      Demo 已统一使用 Object/Surface Core API；对象 element、surface 和 generation
      生命周期由业务组件直接接入，不再维护 `useObject`/`useSurface` 框架适配层。
      `hasAbility` 已经接进两条拖拽入口，demo 里"补充测试用例"这张卡故意不给
      `move` 能力做了验证。
- [x] `hitTest` 从 `kanbanDrag.ts`/`kanbanDragDetach.ts` 里的两份重复代码
      抽成公共的 `Hit` 模块；clone 与 detach 现在共享同一套命中语义

这几项做完，[INTEGRATION.md](./INTEGRATION.md) 里的 Core API 契约已经成立，
不再保留 `useObject`/`useSurface` 作为接入入口。`Motion`（速度延续、物理运动、飞行中重新瞄准目标）暂不在这批里，
后续已在阶段 0.9.6 由 MotionController 和 Runtime 内置视觉策略完成，当前不再由
业务 Demo 维护独立的落地动画入口。

### 阶段 0.7：Runtime 纯 API 接入收口（已完成）

目标是让业务端只注册 Object、Surface、HitResolver、Action 订阅和视觉策略，
不再手动编排 Session、FLIP、target、landing、reveal 或 regrab。运动数学仍由
Runtime 已提供 MotionController 和默认 clone/detach 视觉策略；业务侧只在需要时覆盖
视觉适配器或类型级运动配置。

执行顺序固定为：

1. [x] 新增 `MoveTransaction`，统一保存 source、destination、target、phase 和
   异步 token；
2. [x] 将 MoveAction 的生成收回 Runtime，业务端只订阅 `runtime.onAction()`；
3. [x] 为事务提供统一的 Layout lifecycle（capture → play → cancel）接口，
   Runtime 在 commit 前后调用；demo 现有 FLIP driver 的迁移仍列在第 7 项；
4. [x] 将同步 source/target 解析收回 Runtime；target 等待不作为全局强制流程，
   由 clone 等需要等待的视觉策略在 proxy 接管后自行处理，detach 保持同步解析；
5. [x] 将 clone/detach 的视觉实现注册为 `VisualStrategy`，Runtime 只调用统一的
   `beginDrag/landing/reveal/cancel/dispose` 生命周期；
6. [x] 将 regrab、旧 token 失效和旧 session cleanup 收回 Runtime；
7. [x] 删除 demo 中重复的 Session、Action、FLIP、target 和 regrab 编排。

验收标准：

- 业务入口不再直接调用 `captureLayoutFlip`、`scheduleLayoutFlip`、
  `createDragProxy`、`landDragProxy`、`registerRegrab` 或 `emitAction`；
- 每个移动事务只产生一次 Action、landing 和 reveal；
- commit/landing/reveal 失败都进入统一取消和清理路径；
- interrupt 后旧 Promise、旧 listener 和旧 Lease 不再影响新 Session；
- clone/detach 视觉行为不改变；clone 的 target wait 不得发生在 proxy 创建之前；
- Runtime 提供并驱动 MotionController，但不保存业务 Store 状态。

0.7 的最终边界：Runtime 不阻塞视觉代理的创建。detach 直接使用同步 target；clone
先创建可见 proxy，再由策略内部等待目标节点 mount。目标等待不能放在 source 隐藏和
proxy 创建之间，否则会产生 release 视觉空窗。

### 阶段 0.8：Surface 与输入生命周期收口

0.8 建立在 0.7 稳定实现之上，目标是让业务端只提供对象、Surface、命中和视觉
策略，不再手动编排卡片与 Surface 的事务生命周期。本阶段不重新实现运动数学，
不引入新的 `CardVisualHost`，并保持 Runtime 内置 MotionController 与 clone/detach
视觉行为兼容。

执行顺序：

1. [x] 收口 Surface 生命周期：source/destination Lease、Surface enter/leave、
   placeholder 登记与释放、跨 Surface cleanup 和事务锁；
2. [x] 收口输入生命周期：pointerdown、pointermove、pointerup、pointercancel、
   lostpointercapture、window blur 和 regrab；
3. [x] Runtime 已统一推进主流程 `prepare → active → release → landing → revealing →
   completed/cancelled → disposed`，clone/detach 视觉策略不再直接调用
   `session.transition()` / `session.handoff()`；
4. [x] 将 listener、RAF、ResizeObserver、Lease 和 placeholder 纳入同一清理出口；
5. [x] 清理 clone/detach 入口中重复的 Session、Surface、输入和 Promise 编排，
   保留项目卡专属 DOM、样式、proxy 和 target 时序。两种策略现在统一通过
   `orchestrateMoveSession`、Runtime Lease、Runtime 输入绑定和 Session Cleanup
   接入；策略文件仅保留各自的 DOM、proxy、target 等视觉时序。

视觉策略边界保持明确：detach 使用同步 target 解析；clone 如需等待目标 mount，
必须先创建可见 proxy，再由策略内部等待。Runtime 不强制所有策略等待 target。

0.8 验收标准：

- 业务入口只注册 Object、Surface、MoveBehavior、HitResolver、Action 和视觉策略；
- 业务端不再直接管理 Session 状态、Lease、输入监听和通用 cleanup；
- cancel、interrupt、regrab、landing-failed 都只执行一次清理；
- clone/detach 的同列、跨列、landing regrab 和连续拖动行为保持不变；
- 不新增 MotionController，不迁移文件卡、画布卡，不改变业务 DOM 结构。

0.8 状态：已完成。后续阶段只处理真实业务接入和策略专属视觉迁移，不再扩大
Runtime 的通用职责。

### 阶段 0.9：将业务交互编排整体迁入 Runtime

本阶段的目标是：把当前业务端已经验证过的 detach/clone 编排逻辑整体迁入
Runtime 内部，业务端最终只注册 Object 和 Surface。迁移不是重写动画，而是把现有
`Visual`、`GroupLayout`、`Hit` 和策略逻辑收进 Runtime 的内部模块，避免业务侧继续
维护 Session、landing、reveal、regrab、FLIP 和清理顺序。

#### 0.9.1 Runtime 内部职责重组

内部模块按功能域收敛，不再按单个动作继续拆文件。最终目标是：

```text
RuntimeRegistry  Object / Surface / Visual 注册
RuntimeSession   Session / Lease / Gate / Cleanup
RuntimeMove      start / update / release / commit / landing / reveal / Action
RuntimeVisual    VisualState / Target / Proxy / VisualAdapter
RuntimeInput     pointer 输入、capture 和 regrab
```

- [x] `Runtime.ts` 保留公共注册和统一输入 API，内部实现开始拆到协调器模块；
- [x] 将 object/surface/adapter 注册移入 `RuntimeRegistry`；
- [x] 建立 `start/update/release/cancel/interrupt` 的 `RuntimeDispatcher` 分发入口；
- [x] 将上述操作的实际实现完全移出 `Runtime.ts`；Runtime 仅保留端口适配和公共 API；
- [x] 将移动目标规范化和 Action 去重提交移入 `MoveActionCoordinator`；
- [x] 将 Session 到视觉代理的唯一引用移入 `VisualProxyCoordinator`；
- [x] 将 active 阶段的 pointer update 分发移入 `MoveUpdateCoordinator`；
- [x] 将 release 前置状态判断移入 `MoveReleaseCoordinator`；
- [x] 将 commit、Surface leave/enter、布局播放和 Action 提交移入 `MoveCommitCoordinator`；
- [x] 将 landing、handoff、reveal 和成功结束移入 `MoveLandingCoordinator`；
- [x] 将 Session 索引、CompletionGate、对象 Lease 获取和 Cleanup 注册移入
  `SessionCoordinator`；
- [x] 将 Session 的最终 dispose/release 顺序和 cancel/interrupt 清理移入
  `RuntimeSession`；
- [x] 成功结束路径的 Session dispose、CompletionGate 收束和索引删除已移入
  `SessionCoordinator`；
- [x] cancel/interrupt 的 Session 终止、Lease/Cleanup 和索引删除已移入
  `SessionCoordinator`；
- [x] 将 VisualAdapter 的状态快照、状态写入和 target 解析移入
  `VisualStateCoordinator`；
- [x] 将 VisualProxy 的 create/update/land/reveal 调度移入
  `VisualMotionCoordinator`；
- [x] 将 landing target tracking 和 Cleanup 登记归入 `RuntimeVisual` 功能域；
- [x] 将落地阶段 regrab 监听和 Session Cleanup 绑定归入 `RuntimeInput` 功能域；
- [x] 将 pointermove/up/cancel/blur/lost-capture 监听归入 `RuntimeInput` 功能域；

收尾时合并当前细分协调器：Move*Coordinator 归入 `RuntimeMove`，
VisualState/VisualMotion/VisualProxy 归入 `RuntimeVisual`，
`SessionCoordinator` 整理为 `RuntimeSession`，Dispatcher 根据最终入口归入
`RuntimeInput` 或 `RuntimeMove`。这一步只做文件和职责合并，不改变行为。

#### 0.9.2 Runtime 接入基础收口

- [x] 看板业务的 pointerdown 不再直接调用 `startCardDragDetach` 或其他 legacy 启动函数；
- [x] Runtime 输入层根据 ObjectStore 的元素绑定自动启动默认 detach driver；
- [x] Runtime 负责创建 MoveSession、绑定输入、终止 Session、释放 Lease 和登记 Cleanup；
- [x] 业务侧只保留 Object/Surface 注册、元素绑定和 Action 订阅；
- [x] detach driver 迁移完成，Runtime 通过 `DefaultVisualAdapter.createMove()` 自动启动；

当前进度补充：Session 的创建、索引、查找、CompletionGate、对象 Lease 获取、
事务 Cleanup 注册以及终态清理均已迁入 `RuntimeSession` 功能域。

当前进度：Registry、Dispatcher、SessionCoordinator、RuntimeInput 和内置 detach driver
均已由 Runtime 使用；看板元素绑定后的 pointerdown 直接进入 Runtime 默认移动事务。

现状核对：detach 的 pickup、跟手、落点判定、regrab、landing/reveal、CompletionGate
和取消清理已经由 `DetachAdapter`/`DetachMoveDriver` 在 Runtime 内部统一编排，业务侧
只保留 Object/Surface 注册、元素绑定和 Action 订阅。

#### 0.9.3 迁移 DetachMoveDriver

- [x] `Visual.ts` 作为 Runtime 内部的运动原语；
- [x] `GroupLayout.ts` 作为 Runtime 内部的 Group/Surface FLIP 实现；
- [x] `Hit.ts` 作为 Runtime 内部的统一命中实现；
- [x] detach 视觉策略已迁入 Runtime 内部策略目录（`DetachAdapter`）；
- [x] 已删除 `kanbanDragDetach.ts` 和 `DetachReleaseCoordinator.ts`，编排全量迁入 `DetachAdapter`/`DetachMoveDriver`；

当前迁移进度：0.9.3 已完成。Runtime 侧统一提供 Session/Lease、pickup、dragging/update、
release、landing/reveal、regrab 和 dispose，业务入口不再保留 detach 事务闭包。

#### 0.9.4 业务编排收口顺序

下一步按以下顺序执行，不改变现有动画实现：

1. [x] Runtime 根据对象注册自动创建移动事务；
2. [x] detach 的 pickup、跟手、落点判定和 regrab 编排已迁入 `DetachMoveDriver`；
3. [x] landing、reveal、CompletionGate、cancel/dispose 顺序已迁入同一个 driver；
4. [x] `kanbanVisualAdapter.ts` 已删除，视觉实现由 Runtime 内置；
5. [x] 已删除迁移期 `legacyStart` 接口、Runtime fallback 分支和对应旧测试；
6. [x] `KanbanBoard.vue` 只保留 Object/Surface 注册、元素绑定和 Action 订阅。

目标调用链固定为：

```text
pointerdown → Runtime.start → DetachMoveDriver.prepare
→ Runtime.update → resolveDestination → emitAction
→ landing → reveal → Runtime.dispose
```

`DetachMoveDriver` 只组合现有 Runtime 能力，不重新实现 `Visual`、`Hit`、
`GroupLayout` 或运动参数。

#### 0.9.5 单一生命周期所有者

- [x] `DetachAdapter.createDetachMoveFromAdapter` 是唯一生命周期所有者，内部调用 Runtime 协调器；
- [x] cancel/interrupt/regrab/dispose 均由 detach adapter 内部闭包统一触发；
- [x] 业务入口不再传递 legacy 启动函数，不接触 Lease/proxy/FLIP；
- [x] `kanbanDragDetach.ts` 已删除，编排全在 `DetachMoveDriver.ts`；

0.9 不负责：重写 MotionController、创建 CardVisualHost、改变现有动画参数、迁移
文件/画布对象或重做业务 DOM。阶段验收以“业务只注册 Object/Surface、行为不变、
Runtime 内部只有一套生命周期编排”为准。

**0.9 完成情况（2026-07-27）**：detach 策略迁移已全部完成。
- `kanbanDragDetach.ts` → 已删除，编排迁入 `src/runtime/detach/DetachAdapter.ts`
- `DetachReleaseCoordinator.ts` → 已删除，幂等保护内联为 `released` 布尔
- `legacyStart` 已删除，默认视觉模式通过 `DefaultVisualAdapter.createMove()` 启动 detach driver
- clone 编排已从 demo 收敛到 Runtime；detach 与 clone 均由 `DefaultVisualAdapter.createMove()`
  按 `visualMode` 选择，demo 只注册对象类型和策略开关

**接下来（阶段 1 前置工作）**：
- [x] detach 策略迁移完成（`createMove` + `DetachAdapter` + `DefaultVisualAdapter` 内置）
- [x] Teleport fly-to 修复（`objectLease.release()` 释放控制权，Teleport 关闭后元素回到列容器）
- [x] 删除 `kanbanDrag.ts`（legacy clone 编排）
- [x] 删除 `kanbanVisualAdapter.ts`（能力内联到 `DefaultVisualAdapter`，用户不需要手动创建）
- [x] 浏览器验证 detach 拖拽全场景（同列/跨列/无效落点/landing regrab/连续拖动）
- [x] 新增拖拽自动滚屏能力（`dom/AutoScroll.ts`），指针贴近列边缘时持续滚动，滚动期间通过
      `onScroll` 回调重新计算命中/落点索引，避免指针静止时索引停留在滚动前的旧值上
- [x] 收拢重复的 detach 编排（2026-07-27）：
      旧的 `executeDetachDrag`／`createDetachMoveRequest`／`startDetachSession`／`createDetachMoveDriver`
      已从 `DetachMoveDriver.ts` 删除；regrab 改为调用 `Runtime.startObjectPointer(objectId, liveEl,
      event, fromRect)`，与首次拾取走同一条 `createMove → createDetachMoveFromAdapter` 路径；
      `startObjectPointer` 新增可选的 `fromRect` 透传参数，以及原本只在 `executeDetachDrag` 里的
      "已登记 regrab handler 时直接转发"兜底检查，现在挪到 `startObjectPointer` 顶部对所有对象通用
- [x] 落地时把目标滚动进列容器可视范围（`DetachAdapter.ts` 的 `keepElementWithinColumn`）：
      年/月分组增删、FLIP 收尾可能跨多个 frame 才提交完，参考
      `Gugu-web-drag-animation-refactor` 里 `DrawerViewport.vue` 的做法，落地那一帧校正一次后，
      接下来几帧再重新校正，而不是只做一次性快照
- [x] `landDragProxy` 的 `retarget` 加最小间隔节流（60ms）：兄弟卡 FLIP 期间目标位置逐帧变化，
      之前每次 `retarget` 都立即重启一次过渡（冻结当前状态→强制回流→下一帧写新终点），逐帧重启
      会打断浏览器正在合成的动画，表现为落地途中卡顿；现在把高频 retarget 合并到较低频率补一次
- [x] 删除迁移期 clone 编排和重复 detach 编排
- [x] 进入阶段 1：接 Gugu-web 看板项目卡

### 阶段 0.9.6：接入 MotionController，统一 grabbing → landing 的 JS 运动链路

本阶段在接入 Gugu-web 之前完成。目标不是重写业务拖拽，而是把当前由 CSS
transition/`landDragProxy` 分散驱动的代理运动，收口为 Runtime 可控制的 JS
MotionController。Runtime 继续负责事务状态和清理，MotionController 负责每一帧的
位置、速度、缩放和落点目标；业务端不再直接启动 landing transition。

范围固定为单代理 detach 流程：

```text
grabbing
  → pointer follow (position + velocity)
  → release (冻结当前 MotionState)
  → landing (JS spring/tween，支持 retarget)
  → settled
  → reveal/dispose
```

执行项：

- [x] 从 Gugu-web 历史提交 `4b0b742` 提取纯运动部分：`integrateSpring`、位置/缩放二阶弹簧、follow/settle
      两种模式、速度驱动姿态和 RAF 生命周期；对应 Runtime 文件为 `src/motion/`。没有迁入
      clone/holder DOM、命中、FLIP、Store、Surface、滚动或 reveal/cleanup。
- [x] 将提取出的 `MotionController` 首先接入 detach landing：proxy 的位置、尺寸和完成通知由
      JS controller 驱动；阴影、圆角、背景、内容交叉淡变仍由现有视觉适配器处理。
- [x] landing 默认弹簧改为接近临界阻尼，长距离移动缓出且不回弹；跟手阶段参数暂不改变。
- [x] demo 增加 Motion 调参面板：滑块实时预览，保存写入浏览器本地调试配置，重置回到已保存值；
      业务接入 API 不依赖该面板。
- [x] 定义位置、速度、缩放和旋转状态；`timestamp` 由 RAF 时间戳在控制器内部维护，不暴露给业务视觉层；
- [x] grabbing 阶段由 controller 接管 detach pointer follow，保留现有 dragOffset、DOM/Lease/FLIP
      编排；跟手使用 Gugu 原有 360/0.85 弹簧参数，landing 参数仍可独立调节。
- [x] landing 阶段支持目标更新、速度连续、取消和 interrupt，取消返回当前帧状态；
- [x] `VisualAdapter.land` 已接到 MotionController；`createProxy/updateProxy/dispose` 暂不改变，
      以保证本轮只替换 landing 的运动来源。
- [x] `landDragProxy` 降级为 DOM 写入适配，不再拥有动画时序和 Promise；
- [x] 统一 landing/reveal 的完成门，MotionController 完成后 Runtime 才允许 reveal；
- [x] 补充纯逻辑测试：速度连续、retarget、cancel、interrupt、完成门和 RAF 清理；
- [x] 保持现有 detach 视觉样式、FLIP、Surface 和 Action 行为不变；
- [x] 浏览器回归同列、跨列、无效落点、landing regrab、连续拖拽和自动滚屏。

不在 0.9.5 处理：多代理、多选拖拽、CardVisualHost、文件/画布接入和业务 DOM
重构。MotionController 只接管代理运动，不接管 Store、Hit、Surface 或业务样式。

验收标准：

- grabbing 到 landing 只有一个 JS motion loop；
- 不再依赖 `transitionend` 或 CSS transition duration 判断落地完成；
- regrab 保留当前视觉位置和速度，不回到旧 target；
- 任意 cancel/interrupt 后 RAF、监听器和 proxy 都能清理；
- 现有 Runtime 测试和 detach 浏览器回归不改变行为。

### 阶段 1：迁移 Gugu-web 看板项目卡（已完成）

首个真实接入目标是看板项目卡。看板已有 clone/detach 两种视觉策略和
完整的跨列、同列、落地中断回归场景，适合先验证 Runtime 纯 API 是否能收回
业务侧的事务编排。这也是 2.0.0 的真实业务回归门槛，不再把 Demo 通过视为业务接入通过。
目标调用方只有三类代码：

```text
对象组件：runtime.objects.register({ id, type, surfaceId, element, abilities })
容器组件：runtime.surfaces.register({ id, type, element, accepts })
页面 Store：runtime.onAction(action => store.apply(action))
```

业务端不得再为卡片移动维护 pointerdown、拖拽阈值、DOM reparent、proxy、placeholder、
命中、FLIP、landing/reveal、regrab 或清理逻辑；文件上传、卡片内按钮、年/月折叠等非移动
交互不属于本阶段迁移范围。

执行步骤：

1. [x] 给看板相关 `Transition`/`TransitionGroup` 加 `controlled` 开关
   （`:css="!controlled"`）。
2. [x] 由 Runtime 的一个 MoveTransaction 统一接管 Surface 命中、Action 提交、
   兄弟布局 FLIP 调度、落地和交接顺序。
3. [x] 保留 clone/detach 的具体视觉实现，但业务入口只注册 API，不再直接编排
   Session、target、landing/reveal 和 regrab；clone 使用 Runtime 内建的独立代理与源节点占位。
4. [x] 保留 Vue 作为 DOM 创建/销毁工具，但关闭它对这些节点的自动 move/leave 动画。

#### 1-1：源码直连与真实回归基线

- [x] Gugu-web 通过本地源码桥接直接编译 Runtime `src/`，移除 npm 依赖与裸包名解析；
      已在 2026-07-31 验证 `vue-tsc --noEmit`、`vite build` 与 devserver 模块解析均通过。
- [x] 建立“项目看板 Runtime-only”回归页：普通列、滚动列、完成列年/月分组、glass/overflow、
      同列/跨列 DOM 重挂载；
- [ ] 每个回归用例记录 Action、Session、proxy 数与最终 DOM，作为 Runtime 浏览器集成测试，
      不以 jsdom 单测替代。

#### 1-2：默认 DOM 生命周期契约

把 Demo 中隐含在 adapter/Teleport/CSS 里的条件迁入 Runtime 默认 detach 策略：

- [x] Runtime 在 pointerdown 自动以元素 rect 计算 `dragOffset`，保证卡片抓取点不偏移；
- [x] grabbing 到 landing 全程使用 Runtime overlay 中的唯一视觉 proxy；业务源节点保持业务 DOM
      唯一来源，Runtime 只通过 visibility/layout lease 隐藏或占位，绝不要求业务 Teleport 或
      手工 reparent；
- [x] overlay 脱离任何 transform、filter、contain 与 overflow 裁切，并建立统一 z-index 策略；
- [x] 无效落点、同列放回、跨列落地和 regrab 全部走同一 proxy 生命周期，不能分别实现回飞；
- [x] 默认视觉快照复制可见内容及字体/伪类相关的关键计算样式，避免代理与本体样式漂移。

#### 1-3：Surface、Hit 与布局事务

- [x] 默认 Hit 基于 `SurfaceStore` 和 `ObjectStore` 的已注册元素，不依赖 `[data-column]`、
      `[data-card]` 等 Demo 专用选择器；数据属性仅作为可选调试标记；
- [x] 默认 Move 事务在提交前捕获所有受影响 Object 和 Surface，在业务 Action 后等待框架 DOM
      提交与目标元素注册，再统一播放对象 FLIP、Surface resize、landing；
- [x] `runtime.onAction()` 支持异步提交/渲染完成门，Runtime 不在业务 Vue 尚未更新时解析 target；
- [x] Runtime 接管期间自动关闭对应 Surface 的 Vue transition，事务结束后同帧恢复；
- [x] 组布局、滚动锚点和 resize 都纳入同一事务，快速抓放/interrupt 从当前帧状态续播。

#### 1-4：回归与发布验收

- [x] 看板同列、跨列和无效落点都只产生一次 Action；
- [x] clone/detach 的 landing、reveal、regrab 行为保持不变；
- [x] 连续拖拽、中途中断不残留 Vue transition class，也不出现旧事务清理新事务样式；
- [x] 看板兄弟卡片和 Surface 布局由同一个事务调度，避免二次 FLIP 和空位；
- [x] 回归：普通列同列、跨列、无效落点、静止抓放、landing regrab、连续两张卡、快速抓放；
- [x] 回归：overflow/glass 裁切、滚动到不可见目标、完成列年/月嵌套、Surface resize 与 FLIP；
- [x] 每个交互只输出一次 Action；任意时刻每张卡最多一个视觉 proxy；结束后无受控样式、
      listener、RAF、lease 或残留 overlay 节点；
- [x] Gugu-web 项目页不再 import 旧项目拖拽/完成列 FLIP 编排模块；
- [x] Runtime 单测、真实浏览器集成回归、Gugu-web typecheck/build 全部通过后发布 2.0.0。

**完成定义（已满足）**：Gugu-web 只保留对象/Surface 注册、对象与容器样式、Action 到 Store/API 的映射，
不再为普通卡片移动写 adapter 或生命周期闭包。回归记录用例细节（1-1 最后一项）留待后续按需补充，
不阻塞阶段完成。

### 阶段 2：文件系统 Runtime 接入（Demo → Gugu-web）

文件系统采用“先冻结 Demo 契约，再做一条真实业务链路，并将通用问题回补 Runtime”的
垂直迁移方式。Demo 不是完整文件库，而是验证 Object、Surface、Action、视觉策略和
布局协调边界的实验场。

#### 2-1：Demo 契约与回归基线（已完成）

- [x] 根目录、一级/多级文件夹和文件 mock 数据。
- [x] 文件夹卡片可进入，面包屑按真实父级链导航。
- [x] 网格/列表视图切换，根目录和文件夹内数据足够触发换行。
- [x] 文件和文件夹注册为 Object，文件夹/浏览区域注册为 Surface。
- [x] 页面层提供 `detach / clone` 策略切换，并保持目录状态不重置。
- [x] detach 优先接入文件夹卡和面包屑目录目标；文件夹 Action 使用与文件相同的业务更新通道。
- [x] 文件列表兄弟节点 FLIP 与 landing target 实时跟随。
- [x] 文件与文件夹复用 Runtime 内建 clone 视觉策略，不再新增文件系统专用 adapter。

##### 2-1.1：detach 主路径验收（已完成）

文件系统后续先只优化和验收 `detach` 主路径。第一阶段固定覆盖：文件/文件夹命中、
拖入文件夹、拖到面包屑、非法目标回弹、landing/handoff、源节点清理和同级列表让位。
`clone` 暂时保留页面开关和现有回归基线；clone/detach 均通过 Runtime 默认视觉
适配器按 `visualMode` 选择，文件业务侧不再维护独立 clone 生命周期。

detach 阶段的验收门槛：

- [x] 文件夹拖入文件夹后，目标目录可以进入并看到被移动文件夹。
- [x] 文件或文件夹拖到根目录面包屑后，目录归属正确更新。
- [x] 文件/文件夹拖入普通文件夹时，同级兄弟节点由统一 FLIP 让位。
- [x] 非法目标、拖回原位和中途重新抓取不残留本体、代理或 pointer 状态。
- [x] 网格/列表、嵌套目录和连续快速拖拽通过浏览器回归。

迁移首条链路固定为：

```text
文件卡片 → 拖入普通文件夹 → 更新 parentId/排序 → 同级文件 FLIP
         → landing/handoff → API/Store 持久化
```

`detach` 和 `clone` 只替换视觉策略，不改变目录导航、面包屑、业务 Action 或数据模型；
列表让位属于 Layout/FLIP 接入，不属于视觉 adapter 的隐含行为。真实迁移发现的对象
身份、Surface 命中、FLIP 所有权和清理时序等通用问题回补 Runtime，权限、回收站和 API
回滚等业务问题留在 Gugu-web adapter。

每个文件系统能力都按以下循环推进：

```text
Runtime Demo 冻结契约 → Gugu-web 迁移一条链路 → 对照现有行为
→ 回补通用问题 → Demo + Gugu-web 双侧验收 → 进入下一条链路
```

#### 2-2：Gugu-web 文件卡迁移（待实施）

2-1 Demo 契约验收通过并稳定运行后，复用同一套 Runtime API 接入文件卡视觉策略。
执行节奏采用“Demo 契约 → Gugu-web 一条真实链路 → 双侧回补”的垂直迁移，
不等所有文件能力在 Demo 中完成后才开始真实接入，也不在 Gugu-web 中直接发明
Runtime 私有接口。当前 Demo 已具备多级目录、面包屑、网格/列表和策略切换页面层；
文件列表兄弟 FLIP、语义 target landing 与 clone/detach 共用的 Runtime 生命周期
已经完成，本阶段的重点转为业务侧接入收敛。

##### 2-2.1：文件业务侧收敛目标

文件系统的最终接入不是让 Runtime 持有文件树、权限或 API，而是把重复的交互编排
收进一个通用的“层级集合”绑定层。Gugu-web 只保留数据查询、目录导航、权限判断和
Action 到 Store/API 的提交；Runtime 负责对象/Surface 注册、目标命中、landing、
兄弟 FLIP、detach/clone 生命周期和 DOM ref 的清理。

目标业务侧形态（Core API）：

```ts
runtime.objects.register({
  id: item.id,
  type: item.kind === 'folder' ? 'folder-item' : 'file-item',
  surfaceId: surfaceIdFor(item),
  element,
  abilities: ['move'],
  target: item.kind === 'folder' ? {
    surfaceId: `file:surface:${item.id}`,
    accepts: ['file-item', 'folder-item'],
  } : undefined,
})

runtime.onAction(action => {
  if (action.type === 'move') fileStore.move(action.objectId, action.toSurfaceId, action.toIndex)
})
```

无拖动身份的面包屑单独注册 Target；Vue 和 React 都只需把自己的 DOM 元素绑定到同一
Core API：

```ts
runtime.targets.register({
  id: `breadcrumb:${folder.id}`,
  surfaceId: `file:surface:${folder.id}`,
  element: breadcrumbElement,
  accepts: ['file-item', 'folder-item'],
})
```

Core API 直接覆盖 Vue、React 和其他框架；其边界固定如下：

- Runtime 不读取或修改文件业务数据，不调用文件 API，也不处理权限、回收站或 rollback。
- Runtime 可接受任意层级对象/容器，文件、项目文件和未来素材库共用同一套绑定。
- 业务侧只通过 `onMove` 接收标准 MoveAction，并自行决定 optimistic update、持久化和失败恢复。
- DOM 目标注册及语义 landing 的定位属于 Runtime，不继续散落在页面的 resolver 中。

当前进度：看板和文件 Demo 都直接使用 Core API 注册 Object/Surface/Target，并通过 `runtime.onAction()`
提交移动；Demo 仅保留 mock 文件树、目录导航、循环拦截与内存 `moveFile()`。集合专用
绑定层已删除，Vue/React DOM 适配器已补齐，用于同步 DOM ref、清理 Target 和等待框架 patch；
下一步是用同一契约验证 Gugu-web 文件页。

正式接入契约是 `runtime.objects.register()`、`runtime.surfaces.register()`、
`runtime.targets.register()` 和 `runtime.onAction()`；Vue、React 共享这套 Core API。
文件夹卡可通过 Object 的 `target` 同时声明 Object/Target，面包屑使用
`runtime.targets.register()`。`runtime.registerObjectType()`
只注册类型级视觉与行为策略，不代替具体 Object 注册。

看板和文件 Demo 均直接使用上述 Core API，不再依赖 Surface/Target 的 Runtime 便捷包装；
Runtime 包不再发布 `useObject.ts`、`useSurface.ts` 和 `useRuntimeTransition.ts`。

框架适配边界已经固定：`createVueRuntimeAdapter()` 与 `createReactRuntimeAdapter()` 只提供
`bindObject()`、`bindSurface()`、`bindTarget()`、`getSurfaceElement()`、布局 mutation
和 `dispose()`。它们不替代 `runtime.objects.register()`、`runtime.surfaces.register()`、
`runtime.targets.register()`，也不隐藏 `runtime.onAction()`。因此业务侧最终仍是“直接注册
Object/Surface/Target，按框架选择一个 DOM 适配器同步元素”。

收敛按六步推进：

1. 提炼通用层级容器目标注册，收走文件页的命中与 landing target resolver。
2. [x] 增加 `TargetStore`；Object 可通过嵌套 `target` 自动登记语义落点，独立
   面包屑继续使用 `runtime.targets.register()`。
3. [x] 将 Core API 作为 Vue/React 共用唯一契约；删除 `useObject`、`useSurface` 和
   `useRuntimeTransition`，不新增框架专用注册语义。
4. [x] 增加 Vue/React DOM 生命周期适配器；适配器只负责 DOM 绑定、Target 清理和布局
   patch 时机，不承载注册语义或业务状态。
5. 用标准 `onMove` 回调替换 Demo 的直接订阅；Demo 仍用内存 Store，Gugu-web 接真实 Store/API。
6. 先迁移“文件卡 → 普通文件夹”一条真实链路，双侧验证后再迁移文件夹、面包屑、多选和回收站。

在 1、2 步没有验证出可复用边界之前，Gugu-web 继续把临时代码放在
`frontend/src/views/Files/runtime/`，不将任何文件专属逻辑硬塞进 Runtime Core。

首条真实链路固定为：

```text
文件卡片 → 拖入普通文件夹 → 更新 parentId/排序 → 同级文件 FLIP
         → landing/handoff → API/Store 持久化
```

真实迁移中发现的对象身份、Surface 命中、FLIP 所有权和清理时序等通用问题，
回补 Runtime demo；回收站语义、权限和 API 失败回滚等业务问题留在 Gugu-web adapter。

##### 2-2.2：Gugu-web 侧业务接入层

文件系统第一版由 Gugu-web 保留业务接入层，Runtime 仓库不增加文件专属模块。Runtime
已经提供可选的 Vue/React DOM 生命周期适配器，但它只负责把业务已经注册的
Object/Surface/Target 与 DOM 对齐；文件树、目录导航、权限、optimistic update 和
rollback 仍由 Gugu-web 负责：

```text
Gugu-web/frontend/src/views/Files/runtime/
├── fileRuntimeAdapter.ts
├── fileTargetResolver.ts
├── fileRuntimeTypes.ts
└── README.md
```

业务接入层只能使用以下公共能力：

- `registerObjectType()`。
- `runtime.objects.register()` / `setElement()` / `setSurface()`。
- `runtime.surfaces.register()` / `setElement()`。
- `createVueRuntimeAdapter()` 或 `createReactRuntimeAdapter()`（仅用于 DOM ref、Target
  生命周期和框架 patch 后的布局事务）。
- `runtime.onAction()`。
- 现有默认 HitResolver、detach、landing、FLIP 和清理生命周期。

Runtime 不感知文件、文件夹、项目或目录 API。文件业务层将通用 Action 翻译为文件业务操作，
继续调用 Gugu-web 现有的 `moveFiles()`、`moveFolders()`、optimistic update 和 rollback。

##### 2-2.3：对象和 Surface 协议

文件系统使用两个对象类型：

```text
file-item
folder-item
```

对象 ID 必须携带宿主 scope，例如：

```text
files:file:123
project-files:19:file:123
```

文件夹卡片和可放入的面包屑作为目标 Surface，由 Surface ID 携带目标目录信息。Runtime 只把它们当作普通可接受对象的 Surface，不新增 `folderId` 或 `fileId` 业务字段。

##### 2-2.4：Runtime 侧配合清单

- [x] 确认 Core Object API 可以稳定绑定网格卡片、列表行和项目文件面板对象。
- [x] 确认嵌套文件夹 Surface 与面包屑 Surface 的目标注册和命中路径。
- [x] 确认同一对象在当前 Demo scope 下可以切换目录，不因浏览器 Surface 复用而产生
      旧对象注册。
- [x] 确认单对象移动只产生一次 `MoveAction`、一次 landing 和一次 dispose。
- [x] 补充 Runtime 集成测试：文件对象、文件夹目标、面包屑目标和非法落点。
- [ ] 不为多选拖拽提前修改 Runtime 核心；多选继续由 Gugu-web 旧 adapter 暂存。

##### 2-2.5：API 复评门槛

第一阶段禁止为了文件系统增加专属 API。只有出现以下事实之一，才重新评估 Runtime 公共接口：

1. 仅靠 `Surface ID` 无法稳定表达目标信息。
2. 文件目标元数据需要被多个业务应用复用。
3. 多选拖拽需要通用的 Group Session。
4. 文件视觉策略在 Runtime 之外无法保持一致的生命周期。

候选扩展只能是通用能力，例如 Surface `metadata`、通用目标快照或 `GroupDragSession`；不得加入文件专属字段。

##### 2-2.6：收敛规则

单对象接入和项目文件面板复用验收通过后，Gugu-web 再把稳定的业务接入层从
`views/Files/runtime/` 收敛到文件页自己的交互模块。Runtime 仓库只有在通用性得到验证
后才新增 `src/file/`；多对象基础能力则单独进入 `src/group/` 评审。Vue/React DOM
适配器留在 Runtime 公共层，不复制到文件业务目录。

##### 2-2.7：阶段验收与扩展顺序

- [ ] detach 拖入普通文件夹时，原目录剩余文件有一次且仅一次 FLIP。
- [ ] clone 拖入普通文件夹时，代理、本体和兄弟节点不重复控制 `transform`。
- [ ] 取消、二次抓取、快速连续拖拽不会留下幽灵文件或旧动画。
- [ ] 每次移动只产生一次 `MoveAction`，Store/API 与页面目录一致。
- [ ] 面包屑、网格/列表和多级目录不因 Runtime 接管而重置。

普通文件夹单链路稳定后，再按风险扩展：文件夹拖入文件夹及循环拦截、两种布局的
兄弟 FLIP、批量选择/多对象 Session、面包屑目标、回收站和跨空间移动。每一项都先
在 Demo 冻结协议，再迁移一条 Gugu-web 真实链路并回补通用能力。

#### 2-3：多组布局与折叠

多组折叠不放入 `MoveBehavior`，单独作为布局行为建设：

- [x] `layout/GroupLayout.ts`：负责组高度测量、展开/收起过渡、Relative Group
      FLIP（子组扣除父组位移，只播放局部位移）和滚动锚点；
- [ ] Surface layout policy registry：Runtime 定义 Surface 的 resize/move
      运动与中断语义，业务只按 `data-surface-type` 声明类型；第二类 Surface
      （Drawer）接入时实现 `registerSurfaceLayout()`。
- [x] 补充顶部/中间/底部滚动锚点保存与恢复；
- [ ] 接入具体抽屉业务。
- `behavior/GroupLayoutBehavior.ts`：负责把折叠/展开接入 Runtime 事务生命周期。
- Vue 组件只保存展开状态、渲染组标题和触发请求，不直接编排 FLIP。
- 如果未来只剩组间位移动画，再从 `GroupLayout.ts` 中抽出内部 `GroupFlip`。

#### 2-4：公共 Hit 模块

- [x] 将不同拖拽策略中的命中逻辑统一到 `Hit` 公共模块；
- [x] 提供 `findSurface(point)`、`findTarget(point)`、`findIndex(surface, point)`；
- [ ] Behavior 只消费 Hit 结果，不再复制项目卡专用坐标判断。
- [ ] 由 `runtime.setHitResolver()` 注入当前业务的 Hit 实现。

VisualAdapter 已接入 clone/detach 的抓取初始状态、目标解析和视觉快照；`MoveBehavior`
上下文现在按 Session 注入 `visual`、`hit` 和 `emitAction`，landing/reveal 的
调用顺序、幂等保护和失败终态由 Runtime 编排，具体视觉交接仍由策略 driver 实现。

Runtime 现在会在调用 `release` driver 前统一推进 `active → release`，业务 driver
只负责落点判定和后续 landing，不再自行模拟 release 阶段。
Runtime 在 driver 返回后会兼容旧编排：若仍处于 `release`，自动推进到 `landing`；
成功 landing 后 Runtime 会进入 `handoff`，再调用一次性 reveal，最后统一 dispose。
新 driver 的推荐返回值为 `{ accepted, destination }`；`accepted: false` 由
Runtime 统一转为 cancel。
`Runtime.release()` 也会统一捕获 driver 异常并转为 cancel，避免交互链路暴露
未处理 Promise。

`MoveBehavior` 已提供可替换 driver；业务编排可以挂到
`runtime.setMoveDriver()`。需要同时支持多个视觉策略时，使用
`runtime.bindMoveSession(sessionId, driver)` 按 Session 绑定，避免 clone/detach
之间共享可变状态。默认 clone/detach driver、proxy、landing 和具体 tween 现在均由
Runtime 内部提供；业务只通过 `visualMode: 'clone' | 'detach'` 选择策略。

Action 使用明确的行为联合类型，不使用与业务数据库字段耦合的通用 patch：

```ts
type Action =
  | MoveAction
  | TransferAction
  | SortAction
  | ResizeAction
  | LinkAction
```

Action 的基础联合类型已落在 `src/action/Action.ts`，Runtime 已提供
`runtime.onAction()`/`runtime.emitAction()` 通道；当前 demo 仍直接提交业务
Store，后续迁移 Behavior 时再切换为 Action 输出。

### 阶段 3：迁移 Gugu-web 画布对象

最后接入画布对象，保留 camera、连接点和吸入动效等业务专属行为，Runtime
只负责事务和 Surface 边界。

## 六、现有 Gugu-web 代码到新分层的映射（迁移时的对照表）

| Gugu-web 现有代码 | 收编进新分层的哪里 |
| --- | --- |
| `flipCoordinator.ts` 的 `layoutOwners` WeakMap + token 判断 | `Owner`（升级为对象级 `ControlMode` + channel Lease 两层） |
| `flipCoordinator.ts` 的 `FlipTransaction`/`createGroupLayoutTransaction`/`createDrawerLayoutTransaction` | `Layout` |
| `morphLifecycle.ts` | 业务视觉 driver（暂不收编 Motion） |
| `projectGroupsLayout.ts` 的 Session 编排（`requestLayout`/`measureAndPlay`） | `Session` |
| 各处零散的 RAF/ResizeObserver/listener 清理 | `Cleanup` |

## 七、不可违反的规则（同 DESIGN.md，代码评审时逐条对照）

1. Runtime 接管对象后，对应 Vue Transition 必须关闭。
2. Runtime 接管 Surface 后，该区域的 TransitionGroup 和旧 FLIP 必须跳过。
3. Vue 可以更新业务内容和 DOM 结构，但不能播放视觉过渡。
4. 所有临时 transform/height/opacity/visibility 必须由 Runtime 统一恢复。
5. 旧 Session 只能释放自己的 Lease，不能重置对象当前样式。
6. Runtime 只编排交接时机；具体临时视觉样式由当前 driver 清除，再恢复 Vue 控制。
7. Vue 恢复控制的那一帧不得再次执行 enter/move 动画。
