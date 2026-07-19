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

```ts
type SessionState = 'active' | 'landing' | 'handoff' | 'done'
```

### 4. 不可违反的规则（写进代码评审的检查项）

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

## 参考背景

具体的分层结构（Runtime/Session/Object/Surface/Owner/Visual/Motion/Layout/
Render/Action/Cleanup）、Vue 接入接口设计、目录结构建议见
[PLAN.md](./PLAN.md) 中"分层结构"一节；本文件只记录*为什么要这样设计*。
