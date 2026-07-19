# Interaction Runtime · 分层结构与执行计划

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

## 四、目录结构（第一版，不拆得过散）

```
src/
├── core/
│   └── Emitter.ts
├── Runtime.ts
├── session/
│   ├── Session.ts
│   └── SessionStore.ts
├── object/
│   ├── ObjectItem.ts
│   └── ObjectStore.ts
├── surface/
│   ├── Surface.ts
│   └── SurfaceStore.ts
├── input/
│   └── Input.ts
├── hit/
│   └── Hit.ts
├── owner/
│   ├── Owner.ts          # ControlMode 总闸 + channel Lease 两层
│   ├── Lease.ts
│   └── Channel.ts
├── visual/
│   ├── Visual.ts
│   ├── Proxy.ts
│   └── Placeholder.ts
├── motion/
│   ├── Motion.ts
│   ├── Spring.ts
│   └── Frame.ts
├── layout/
│   ├── Layout.ts
│   ├── Flip.ts
│   └── GroupLayout.ts       # 组展开/收起、尺寸测量、组级 FLIP
├── render/
│   └── Render.ts
├── action/
│   └── Action.ts
├── cleanup/
│   └── Cleanup.ts
└── vue/
    ├── useObject.ts
    ├── useSurface.ts
    ├── useRuntimeTransition.ts   # { disabled, transitionKey }，喂给 :css
    └── useRuntime.ts
```

## 五、执行计划

### 阶段 0：本仓库内的最小骨架（demo，不接业务）

> 说明：demo 只用于验证 Runtime 核心协议，不承担 Gugu-web 的完整业务迁移。
> clone/detach 看板示例保留作历史对照和回归观察；0.5 阶段只收紧 Runtime
> 执行层，不继续搬迁业务生命周期。

目标：只验证机制本身有没有设计缺陷，不接 Gugu-web 任何真实组件。

- [x] `Runtime`/`Session`/`Owner`（对象级 `ControlMode` + channel Lease）
- [x] `Visual`/`Layout` 的最小实现（`Motion` 暂以 CSS transition 落地飞行
      代替，尚未做弹簧/惯性）
- [x] `Cleanup`
- [x] demo 页面：三列看板（两个普通列 + 一个按分组展示的完成列），验证
      跨列拖拽触发兄弟重排 + 列表自身高度变化
- [x] `useRuntimeTransition` 的最小实现，demo 里用 `<TransitionGroup
      :css="!controlled">` 验证"总闸"确实能挡住 Vue 的 Transition

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
      - [x] 已建立无 DOM 的生命周期适配器，当前 demo 仍由 legacy driver 编排
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
      `useObject`/`useSurface` composable 也补上了；demo 里列（Surface）
      用 `useSurface` 正常接了，卡片（Object）因为没有各自独立的组件，
      暂时用 `ObjectStore` 原始 API + 一个 `watchEffect` 同步，等有了
      per-card 组件再切换成 `useObject`。`hasAbility` 已经接进两条拖拽
      入口，demo 里"补充测试用例"这张卡故意不给 `move` 能力做了验证。
- [x] `hitTest` 从 `kanbanDrag.ts`/`kanbanDragDetach.ts` 里的两份重复代码
      抽成公共的 `Hit` 模块；clone 与 detach 现在共享同一套命中语义

这几项做完，[INTEGRATION.md](./INTEGRATION.md) 里"未来目标 API"那节列的
`useObject`/`useSurface`/`runtime.start()`/`runtime.onAction()` 才有地基
可以立。`Motion`（速度延续、物理运动、飞行中重新瞄准目标）暂不在这批里，
单独排期——现在的落地动画是借用 `Layout` 的 `playFlip` 顶替的，见
[VISUAL_STRATEGIES.md](./VISUAL_STRATEGIES.md)。

### 阶段 1：迁移 Gugu-web 抽屉链路（试点，不是看板项目卡）

选择理由：这条链路（抽屉项目卡 → 状态组折叠 → `projectGroupsLayout` FLIP
→ `DrawerViewport` 高度 → TransitionGroup 挂载/卸载）已经暴露过全部三类
真实 bug（重叠事务、二次 FLIP、合成层未重绘），有现成的回归场景，不需要
凭空构造测试用例。

只做三件事：

1. 给抽屉相关 `Transition`/`TransitionGroup` 加 `controlled` 开关
   （`:css="!controlled"`）。
2. 由 `InteractionRuntime` 的一个 Session 统一接管：组高度变化、兄弟组
   位移（现有 `projectGroupsLayout`/`FlipTransaction` 收编进 `Layout`）、
   抽屉高度事务（`createDrawerLayoutTransaction` 收编进 `Layout`）、
   落地/交接（现有 `morphLifecycle` 收编进 `Motion`）。
3. 保留 Vue 作为 DOM 创建/销毁工具，但关闭它对这些节点的自动
   move/leave 动画。

验收标准（直接覆盖 Gugu-web 已知过的真实 bug，见
`Gugu-web/docs/devlog.md` 2026-07-17、2026-07-18 两条记录）：

- [ ] 状态组展开/收起不出现二次 FLIP
- [ ] 抽屉滚动位置不跳
- [ ] 组高度变化时不切卡片（不出现拖出底部卡片时被裁切的问题）
- [ ] 卡片拖入/拖出时，组和容器高度同步收缩/展开，不留空位
      （对应 2026-07-18 的合成层未重绘 bug）
- [ ] 连续拖拽、中途中断（regrab）不残留 Vue transition class，也不
      出现"旧事务把新事务的样式清掉"（对应重叠 FLIP 事务 bug）

### 阶段 2：视迁移效果决定是否推广到看板项目卡拖拽

不在本计划详细展开，等阶段 1 验收通过、真实跑一段时间没有回归后再定。

### 阶段 2.5：多组布局与折叠

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

### 阶段 2.6：公共 Hit 模块

- [x] 将不同拖拽策略中的命中逻辑统一到 `Hit` 公共模块；
- [x] 提供 `findSurface(point)`、`findTarget(point)`、`findIndex(surface, point)`；
- [ ] Behavior 只消费 Hit 结果，不再复制项目卡专用坐标判断。
- [ ] 由 `runtime.setHitResolver()` 注入当前业务的 Hit 实现。

VisualAdapter 已接入 clone/detach 的抓取初始状态、目标解析和视觉快照；`MoveBehavior`
上下文现在按 Session 注入 `visual`、`hit` 和 `emitAction`，landing/reveal 的
完整编排仍待迁移到 Behavior 内部。

Runtime 现在会在调用 `release` driver 前统一推进 `active → release`，业务 driver
只负责落点判定和后续 landing，不再自行模拟 release 阶段。
Runtime 在 driver 返回后会兼容旧编排：若仍处于 `release`，自动推进到 `landing`；
待后续将 driver 改为显式返回结构化落点结果。
新 driver 的推荐返回值为 `{ accepted, destination }`；`accepted: false` 由
Runtime 统一转为 cancel。
`Runtime.release()` 也会统一捕获 driver 异常并转为 cancel，避免交互链路暴露
未处理 Promise。

`MoveBehavior` 已提供可替换 driver；迁移期间可以先把现有业务编排挂到
`runtime.setMoveDriver()`。需要同时支持多个视觉策略时，使用
`runtime.bindMoveSession(sessionId, driver)` 按 Session 绑定，避免 clone/detach
之间共享可变状态；再逐步把 proxy、landing 和 Action 移入 Behavior。

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

## 六、现有 Gugu-web 代码到新分层的映射（迁移时的对照表）

| Gugu-web 现有代码 | 收编进新分层的哪里 |
| --- | --- |
| `flipCoordinator.ts` 的 `layoutOwners` WeakMap + token 判断 | `Owner`（升级为对象级 `ControlMode` + channel Lease 两层） |
| `flipCoordinator.ts` 的 `FlipTransaction`/`createGroupLayoutTransaction`/`createDrawerLayoutTransaction` | `Layout` |
| `morphLifecycle.ts` | `Motion` |
| `projectGroupsLayout.ts` 的 Session 编排（`requestLayout`/`measureAndPlay`） | `Session` |
| 各处零散的 RAF/ResizeObserver/listener 清理 | `Cleanup` |

## 七、不可违反的规则（同 DESIGN.md，代码评审时逐条对照）

1. Runtime 接管对象后，对应 Vue Transition 必须关闭。
2. Runtime 接管 Surface 后，该区域的 TransitionGroup 和旧 FLIP 必须跳过。
3. Vue 可以更新业务内容和 DOM 结构，但不能播放视觉过渡。
4. 所有临时 transform/height/opacity/visibility 必须由 Runtime 统一恢复。
5. 旧 Session 只能释放自己的 Lease，不能重置对象当前样式。
6. Runtime 完成交接后，先清除临时视觉样式，再恢复 Vue 控制。
7. Vue 恢复控制的那一帧不得再次执行 enter/move 动画。
