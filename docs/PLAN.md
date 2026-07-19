# Interaction Runtime · 分层结构与执行计划

设计动机见 [DESIGN.md](./DESIGN.md)。本文件是具体的模块划分、目录结构和
分阶段执行计划。

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
| `Motion` | 跟随、弹簧、惯性、落地动画 |
| `Layout` | 排序、重排、FLIP、布局变化 |
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
│   └── Flip.ts
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

目标：只验证机制本身有没有设计缺陷，不接 Gugu-web 任何真实组件。

- [ ] `Runtime`/`Session`/`Owner`（对象级 `ControlMode` + channel Lease）
- [ ] `Visual`/`Motion`/`Layout` 的最小实现
- [ ] `Cleanup`
- [ ] 一个假的可拖拽 demo 页面：几个方块 + 几个容器，模拟"拖入容器触发兄弟
      重排 + 容器自身高度变化"，用 Vue（或干脆先用原生 DOM，看是否需要
      Vue 参与）搭一个最小复现环境
- [ ] `useRuntimeTransition` 的最小实现，demo 里用 `<TransitionGroup
      :css="!controlled">` 验证"总闸"确实能挡住 Vue 的 Transition

验收标准：
- 连续拖拽、中途中断（regrab）、快速连续操作，不出现"两套动画都在跑"
  的画面撕裂
- 旧 Session 不会清理新 Session 的样式
- 所有监听器和 RAF 都能在 dispose 后验证确实清空（可以写一个"泄漏检测"
  小工具：dispose 后统计还挂着的 listener/RAF 数量）

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
