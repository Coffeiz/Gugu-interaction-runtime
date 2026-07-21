# Visual Runtime 演进计划

> 目标：在不推翻现有 Interaction Runtime 的前提下，渐进建立统一的视觉对象、运动计算与渲染管线，优先解决卡片拖拽全过程中的视觉连续性问题。

---

## 1. 背景与目标

当前 Interaction Runtime 已经完成 Session、Owner、MoveBehavior、VisualAdapter、Motion、Layout、Cleanup 等基础能力，也已经能够控制拖拽、landing、reveal、regrab 与 Vue Transition 的交接时机。

现阶段最主要的问题不再是“拖拽能不能工作”，而是：

> 同一个业务对象在一次交互过程中，仍可能由多个 DOM 元素分别代表。

典型流程：

```text
source DOM
  → 跟手本体 / drag proxy
  → landing proxy
  → source DOM reveal
```

虽然这些 DOM 由同一个 Session 编排，但浏览器看到的仍是多个独立元素，因此容易出现：

- `transform` 被多个系统竞争写入；
- CSS `:hover` 与 landing / FLIP 动画互相覆盖；
- source / proxy 切换时 hover、阴影、圆角、字体继承或层级发生跳变；
- regrab 时视觉主体从 overlay 回到业务 DOM，产生 z-index 与 stacking context 冲突；
- Motion、FLIP、业务 CSS 分别控制同一视觉属性，导致硬切和二次动画；
- 用户感受到的是多个 DOM 接力，而不是同一张卡片连续存在。

### 1.1 本阶段核心目标

建立一层 **Visual Runtime**，让 Runtime 内部始终以“视觉对象”而不是“当前 DOM 节点”作为交互主体。

目标模型：

```text
Business Object
      ↓
Visual Object
      ↓
Visual State / Motion State
      ↓
Renderer
      ↓
DOM / Overlay
```

最终用户感知应当是：

> 从按下、跟手、松手、landing、reveal 到 regrab，全程都是同一张卡片在运动。

### 1.2 本阶段优先级

第一优先级：解决视觉连续性。

第二优先级：统一 `transform` 与运动写入出口。

第三优先级：逐步让 Motion 与具体 DOM 解耦。

暂不追求完整 Canvas / WebGL 渲染引擎，也不一次性迁移所有业务 adapter。

---

## 2. 当前现状

## 2.1 已完成能力

当前 Runtime 已具备：

```text
Runtime
├── Session
├── Owner
├── MoveBehavior
├── VisualAdapter
├── Motion
├── Layout / FLIP
├── Action
├── VueControl
└── Cleanup
```

### Session

负责一次完整交互的生命周期与状态转换：

```text
prepare
  → active
  → release
  → landing
  → handoff
  → disposed
```

### Owner

负责对象级控制权与 channel Lease，防止 Vue Transition 与 Runtime 同时操作同一对象。

### MoveBehavior

负责：

- 跟手更新；
- 命中与 destination 结果消费；
- release / landing / reveal 时机；
- regrab 登记；
- 异步失效与 Session 生命周期保护。

### VisualAdapter

负责：

- source / target DOM 解析；
- proxy 视觉创建；
- 视觉快照；
- 业务样式应用。

### Motion / Layout

分别负责：

- 跟随、弹簧、landing 等运动；
- FLIP、重排、组布局与 Surface 尺寸变化。

### Cleanup

统一清理：

- listener；
- RAF；
- timer；
- proxy；
- Lease；
- pointer capture。

---

## 2.2 当前视觉链路

现有交互中，视觉主体仍由多个 DOM 元素切换：

```text
业务 source DOM
   ↓
拖动阶段本体或 proxy
   ↓
landing proxy
   ↓
最终 source DOM
```

当前系统拥有 Session 身份，但缺少持续存在的视觉身份。

换句话说：

```text
Session 是连续的
Visual Entity 不是连续的
```

---

## 2.3 当前主要冲突

### 2.3.1 transform 多写入者

已知写入来源包括：

| 来源 | 典型用途 |
| --- | --- |
| MotionController / follow | 跟手位移、弹簧、旋转、缩放 |
| landing tween / flyTo | landing 位移与缩放 |
| FLIP / Group FLIP | 布局反向位移 |
| applyFloatingStyle | 拖起后的 scale / transform |
| CSS `:hover` | 上浮、缩放 |
| 业务状态 class | selected / pressed 等视觉状态 |

这些来源目前可能直接或间接写入同一个 `transform`。

### 2.3.2 hover 与 landing 冲突

CSS hover 与 Runtime landing 同时控制 `transform` 时，只能有一个最终值生效。

因此会出现：

- landing 中 hover 被硬切；
- hover 触发后覆盖 motion；
- reveal 时 source 的 hover 状态与 proxy 不一致；
- transition 在 handoff 时重新播放。

### 2.3.3 source / proxy 视觉身份断裂

source 与 proxy 可能拥有不同：

- stacking context；
- font / color 继承；
- hover 状态；
- transition 状态；
- z-index；
- DOM parent；
- event target。

因此即使几何位置一致，用户仍可能感到“换了一张卡片”。

### 2.3.4 regrab 边界

regrab 目前容易出现：

```text
landing proxy
  → 销毁 / interrupt
  → source DOM 重新接管
  → 新 Session / 新跟手视觉
```

这会重新引入：

- overlay 与 BODY 的 stacking context 竞争；
- visibility ownership 交错；
- 旧 Session cleanup 影响新 Session；
- transform / hover / scale 状态丢失。

本计划不要求第一阶段立即重写 regrab，但新架构必须为后续连续 handoff 留出清晰边界。

---

## 3. 目标架构

## 3.1 VisualObject

新增持续存在的视觉对象抽象：

```ts
interface VisualObject {
  id: string
  objectId: string
  sessionId: string

  phase: VisualPhase
  state: VisualState
  transform: TransformState

  sourceElement: HTMLElement | null
  renderElement: HTMLElement | null
  rendererMode: 'source' | 'overlay'
}
```

VisualObject 表示“用户眼中这一个对象当前的视觉存在”。

它不等同于 source DOM，也不等同于 proxy DOM。

### 核心约束

- 一个交互对象在一个 Session 中只有一个 VisualObject；
- source 与 proxy 都只是 Renderer 使用的载体；
- VisualObject 的状态不应因 DOM 切换而重新初始化；
- hover、grabbed、selected、motion 等状态都归属于 VisualObject；
- Renderer 切换不能改变 VisualObject 身份。

---

## 3.2 TransformState

新增结构化 transform 状态：

```ts
interface TransformState {
  motion: TransformChannelState
  layout: TransformChannelState
  interaction: TransformChannelState
}

interface TransformChannelState {
  x: number
  y: number
  scaleX: number
  scaleY: number
  rotateX: number
  rotateY: number
  rotateZ: number
}
```

第一版不要求矩阵分解，也不解析任意 transform 字符串。

只支持 Runtime 当前实际需要的结构化字段。

---

## 3.3 TransformComposer

新增统一 transform 合成器：

```text
Layout Channel
      +
Motion Channel
      +
Interaction Channel
      ↓
TransformComposer
      ↓
一次完整 transform 写入
```

建议第一版固定合成顺序：

```text
layout → motion → interaction
```

含义：

- `layout`：FLIP / 布局修正；
- `motion`：拖拽、landing、spring、惯性；
- `interaction`：hover、press、focus 等微交互。

第一版只要求统一写入出口，不要求自动处理任意矩阵乘法。

---

## 3.4 VisualRenderer

Renderer 负责把 VisualObject 渲染到具体 DOM：

```ts
interface VisualRenderer {
  mount(object: VisualObject, mode: 'source' | 'overlay'): void
  render(object: VisualObject): void
  handoff(object: VisualObject, mode: 'source' | 'overlay'): void
  dispose(object: VisualObject): void
}
```

第一版只实现 DOM Renderer。

### Renderer 模式

#### idle

```text
VisualObject
  renderer = source
```

#### dragging

```text
VisualObject
  renderer = source 或 overlay
```

具体由视觉策略决定。

#### landing

```text
VisualObject
  renderer = overlay
```

#### handoff

```text
VisualObject
  overlay → source
```

VisualObject 不变化，只发生 renderer handoff。

---

## 3.5 MotionController 的目标职责

MotionController 最终只负责运动求解：

```text
current state + target state + dt
              ↓
          MotionFrame
```

建议目标接口：

```ts
interface MotionFrame {
  x: number
  y: number
  scaleX: number
  scaleY: number
  rotateX: number
  rotateY: number
  rotateZ: number
  velocityX: number
  velocityY: number
}
```

MotionController 不应长期直接写：

- `HTMLElement.style`；
- class；
- visibility；
- DOM parent；
- proxy 生命周期。

但迁移必须渐进，不在 Phase 1 直接重写。

---

## 4. 渐进实施方案

## Phase 1：建立 VisualObject 基础层

### 目标

新增视觉身份与状态模型，不改变现有拖拽行为。

### 新增建议

```text
src/dom/visual/
├── VisualObject.ts
├── TransformState.ts
├── TransformComposer.ts
└── VisualRegistry.ts
```

如当前目录结构不适合，可放入现有 `src/dom/` 下，但不得引入业务命名。

### 实施内容

1. 定义 VisualObject 与 VisualPhase；
2. 定义 TransformState 默认值与复制方法；
3. 实现 TransformComposer 的纯函数版本；
4. 新增 VisualRegistry，按 `sessionId + objectId` 注册和查找；
5. 在现有 Session / MoveContext 中只保存 VisualObject 引用或 id；
6. 暂不替换现有 proxy / source 逻辑；
7. 暂不接管 hover；
8. 暂不修改 MotionController。

### 验收标准

- `npm run typecheck` 通过；
- 现有 clone / detach demo 行为完全一致；
- VisualObject 可在一次 Session 中持续存在；
- VisualObject 生命周期随 Session dispose 被完整清理；
- 不新增任何业务专用字段；
- 不出现第二套 Session 状态机。

---

## Phase 2：统一 Runtime 内部 transform 出口

### 目标

解决 Runtime 内部多个模块直接写 `style.transform` 的问题。

### 实施内容

1. 全仓库审计所有 `style.transform` / `transform =` 写入点；
2. 将 Runtime 内部 transform 写入迁移到 TransformComposer；
3. 先迁移：
   - 跟手 motion；
   - landing motion；
   - drag scale；
   - FLIP；
4. CSS hover 暂时不迁移，但必须记录剩余冲突；
5. Renderer 成为唯一写最终 `style.transform` 的模块；
6. 旧 API 可保留兼容包装，但不得继续新增直接写 transform 的调用点。

### 验收标准

- Runtime 内部只有 Renderer 写最终 `element.style.transform`；
- Motion、Layout、Visual 不再互相覆盖 transform；
- clone / detach 的跟手、landing、FLIP 与当前视觉一致；
- 不出现 scale 丢失或 transform 清空后硬切；
- 单帧内同一元素最多写一次完整 transform；
- `npm run typecheck` 通过；
- `npm run build` 通过。

---

## Phase 3：MotionController 输出 MotionFrame

### 目标

让 MotionController 从“计算并写 DOM”变为“只计算运动帧”。

### 实施内容

1. 为 MotionController 增加无 DOM 输出接口；
2. MotionController 输出 MotionFrame；
3. MotionFrame 写入 VisualObject 的 motion channel；
4. Renderer 消费 TransformComposer 的结果；
5. 旧的 DOM 直写接口暂时作为兼容层保留；
6. 按 follow → landing → spring 的顺序渐进迁移；
7. 每个迁移点独立 commit，禁止一次重写全部 motion。

### 验收标准

- MotionController 核心算法可在无 HTMLElement 环境下单测；
- 跟手、landing、spring 的视觉效果无回归；
- MotionController 不再直接决定 hover、visibility、z-index；
- 中断 / cancel / dispose 后不再产生残余帧；
- 旧 adapter 不需要一次性重写。

---

## Phase 4：Interaction Channel 接管 hover / press

### 目标

解决 CSS hover 与 Runtime motion 竞争同一个 transform 的问题。

### 实施内容

1. 将“hover 是否存在”继续作为业务可提交状态；
2. hover 的视觉位移 / 缩放改写入 interaction channel；
3. 阴影、颜色、圆角仍可由业务 VisualAdapter / CSS 控制；
4. 禁止 `.card:hover` 直接写 transform；
5. source 与 overlay renderer 消费同一份 hovered / grabbed 状态；
6. landing 与 reveal 期间不得重新通过 DOM pointer 状态推断 hover。

### 验收标准

- hover 不覆盖 landing transform；
- landing 中 hover 视觉可连续保持；
- FLIP 不清空 hover 位移；
- source 与 proxy 的 hovered / grabbed 状态一致；
- handoff 后不出现 transition 硬切；
- 非拖拽状态下 hover 手感与当前版本一致或更自然。

---

## Phase 5：Renderer Handoff 接管 source / proxy 交接

### 目标

让 source 与 proxy 从“两个视觉对象”变为“同一个 VisualObject 的两个 renderer”。

### 实施内容

1. 现有 `createDragProxy` 迁移为 overlay renderer mount；
2. proxy 不再拥有独立 VisualState；
3. source / proxy 共享 TransformState 与 VisualState；
4. landing 完成后执行显式 renderer handoff；
5. handoff 只有在最终 DOM 稳定后发生；
6. visibility、content morph、VisualContext、z-index 都由 renderer handoff 统一处理；
7. regrab 第一阶段只要求不破坏现有行为，后续再改为 overlay renderer 持续接管。

### 验收标准

- 拖动全过程不出现可感知的“换了一张卡片”；
- proxy 与 source 的字体、颜色、圆角、阴影、内容一致；
- source reveal 时无闪烁；
- landing 结束时无硬切；
- 多卡同时 landing 时层级正确；
- 旧 Session 不得修改新 Session 的 renderer 状态；
- renderer handoff 可被 cancel / interrupt 安全终止。

---

## Phase 6：Runtime-native regrab 连续性

### 目标

让 regrab 成为同一个视觉事务的状态继续，而不是 source / proxy / Session 的重新创建。

### 目标流程

```text
VisualObject
  dragging
    → landing
    → regrab
    → dragging
    → landing
    → handoff
```

### 实施内容

1. landing motion 可被取消或重定向；
2. overlay renderer 保持视觉所有权；
3. regrab 不恢复 source renderer；
4. 保持同一 TransformState；
5. 保持同一 VisualObject；
6. 评估是否保持同一 Session；
7. visibility / z-index / layer ownership 不重新初始化。

### 验收标准

- regrab 无闪烁；
- regrab 无 stacking context 变化；
- regrab 不创建第二个可见视觉主体；
- 多次连续 regrab 后无 proxy、listener、timer、Lease 残留；
- 旧 landing motion 不得恢复新交互仍在使用的 visibility；
- regrab 后跟手卡片始终位于其他 landing visual 之上。

---

## Phase 7：第二业务场景验证

### 目标

确认 Visual Runtime 不是 Kanban 专用抽象。

优先接入：

1. Mind 画布单节点拖动；
2. File 卡片拖动；
3. Calendar 事件块移动。

### 原则

- 优先复用现有 VisualObject / TransformComposer / Renderer；
- 不为单个业务增加 Runtime 专用字段；
- adapter 只决定业务语义与视觉样式；
- Runtime 负责视觉连续性、运动与生命周期。

### 验收标准

- 第二个业务场景无需复制 Kanban 的 Session / ownership / cleanup 逻辑；
- adapter 不直接修改 Runtime 内部 MoveContext；
- adapter 不直接写 transform；
- adapter 不自行实现 proxy lifecycle；
- 同一套 renderer 与 motion pipeline 可以工作。

---

## 5. 总体验收标准

## 5.1 视觉标准

必须满足：

- 按下与拖起无闪烁；
- 跟手阶段卡片视觉稳定；
- landing 期间 hover、阴影、圆角与缩放连续；
- FLIP 不覆盖 hover 或 motion；
- reveal / handoff 无硬切；
- source / proxy 字体与颜色一致；
- regrab 不发生视觉主体切换；
- 用户感知始终是一张卡片在运动。

## 5.2 架构标准

### 单一视觉身份

一个业务对象在一个交互 Session 中只能有一个 VisualObject。

### 单一 transform 出口

最终 transform 只能由 Renderer 写入。

### Motion 与 DOM 解耦

MotionController 核心计算不依赖具体 DOM。

### Renderer 与业务解耦

Renderer 不知道 Project / File / Calendar / Mind 等业务类型。

### Ownership 明确

同一时刻只能有一个 renderer 拥有视觉主体控制权。

### 清理完整

VisualObject、renderer、RAF、timer、listener、proxy 与 Lease 必须在 Session 结束后释放。

---

## 6. 测试矩阵

每个阶段至少验证：

| 场景 | 预期 |
| --- | --- |
| clone 同列拖动 | 跟手、FLIP、landing 正常 |
| clone 跨列拖动 | target / source 交接正常 |
| detach 同列拖动 | 本体跟手正常 |
| detach 跨列拖动 | overlay landing 正常 |
| 无效落点 | 回到原位，无视觉残留 |
| 快速连续拖动 | 旧 Session 不影响新 Session |
| 多卡同时 landing | 层级与 visibility 正确 |
| landing 中 regrab | 不闪烁、不泄漏 |
| hover + landing | transform 不竞争 |
| hover + FLIP | hover 不被清空 |
| cancel / interrupt | 所有资源释放 |
| resize / scroll during landing | 目标更新不造成 source 提前显示 |

自动化优先覆盖：

- TransformComposer 纯函数；
- MotionFrame 输出；
- VisualObject 生命周期；
- Renderer ownership；
- visibility ownership；
- Cleanup 活跃计数归零。

---

## 7. 非目标

本阶段不做：

- 替换 Vue；
- 一次性重写全部 MotionController；
- 引入 Canvas / WebGL；
- 设计完整 Scene Graph；
- 实现矩阵分解库；
- 一次迁移全部 adapter；
- 为极端场景无限增加状态；
- 将业务样式全部收进 Runtime。

业务仍负责：

- 内容；
- 颜色；
- 圆角；
- 阴影设计；
- 业务状态；
- drop / commit 语义。

Runtime 负责：

- 视觉身份；
- 运动状态；
- transform 合成；
- renderer handoff；
- ownership；
- lifecycle；
- cleanup。

---

## 8. 推荐提交顺序

建议独立分支：

```text
feature/visual-runtime
```

建议按以下 commit 推进：

1. `feat(visual): add visual object and transform state`
2. `feat(visual): add transform composer and registry`
3. `refactor(render): centralize runtime transform writes`
4. `refactor(motion): emit motion frames through visual object`
5. `feat(interaction): add interaction transform channel`
6. `refactor(visual): model source and overlay as renderers`
7. `feat(visual): add explicit renderer handoff`
8. `feat(runtime): make regrab continue the visual transaction`
9. `test(visual): add continuity and cleanup coverage`

每个 commit 都必须：

- 可独立 typecheck；
- 保持 demo 可运行；
- 不混入无关业务重构；
- 具备明确回滚边界。

---

## 9. 成功标志

当本计划完成时，Interaction Runtime 将从：

> 交互生命周期与临时动画管理器

演进为：

> 管理视觉身份、运动状态、transform 合成和 renderer handoff 的 Visual Interaction Runtime。

业务层只描述：

> “对象发生了什么。”

Runtime 负责：

> “这个对象如何在屏幕上持续、自然且一致地存在。”
