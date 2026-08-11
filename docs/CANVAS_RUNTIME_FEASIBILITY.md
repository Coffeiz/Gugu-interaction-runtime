# 画布 Runtime 接入方案

> 状态：Stage 1 A-B 已完成，S1-C 已完成基础 Object/Surface 接入，正在收尾关系临时位置与完整回归。
>
> 本文是画布接入的执行基线，不把实验性 Demo、相机适配和连线 Runtime 混入 Stage 1。
> Stage 1 先让咕咕画布使用现有 Runtime Core API，完成抽屉、画布卡片、自由落点和两种
> 降落模式；D 阶段再增加 Node/Connection Runtime；Stage 2 最后做相机适配与独立 Demo。

关联文档：

- [INTEGRATION.md](./INTEGRATION.md)：Runtime Core API 契约
- [integration/VUE.md](./integration/VUE.md)：Vue DOM 生命周期适配
- [DESIGN.md](./DESIGN.md)：Runtime 内部职责和设计约束

## 一、目标与非目标

### 目标

1. 画布卡片通过 `runtime.objects.register()` 接入，画布和抽屉分别通过
   `runtime.surfaces.register()` 接入；抽屉内容通过 Runtime Group 接入。
2. 业务侧只负责注册语义对象、Surface、目标和提交 `Action`；不再在画布入口自行编排
   pointer listener、代理、MotionController、landing 或清理生命周期。
3. 提供两种释放后的降落模式：
   - `normal`：沿普通落点过渡，适合不需要速度继承的标准卡片移动；
   - `physical`：继承抓取阶段的释放速度、旋转和缩放状态，按咕咕现有画布物理手感降落。
4. 默认使用 `physical`，保证画布接入后仍以咕咕当前行为为基线。
5. Stage 1 不要求 Runtime 理解相机；业务提供当前视口坐标下的 `LandingRect`，命中和
   降落先在屏幕坐标中完成。

### 非目标

- Stage 1 不实现 Runtime Camera，不改 `worldToScreen`/`screenToWorld` 的业务语义。
- Stage 1 不制作独立 Runtime Canvas Demo；Demo 放到 Stage 2，避免用半成品相机模型反向
  约束 Core。
- Stage 1 不把 SVG 连线、关系持久化或 RelationLayer 搬进 Runtime。
- Stage 1 不实现多选、框选、群组拖拽和 ConnectionRuntime。
- 不重写卡片视觉组件；优先复用咕咕现有卡片、抽屉和 RelationLayer 的渲染。

## 二、现状审核

审核基线：Runtime `main`（`9d55d40`）与 Gugu-web 当前画布代码。

### 2.1 Runtime 已具备的能力

- Core 注册表：`runtime.objects`、`runtime.surfaces`、`runtime.targets`。
- 单对象 Move Session、命中、Action 提交和 ownership 生命周期。
- detach/clone 视觉代理、regrab、取消、源节点隐藏与恢复。
- MotionController 的跟手弹簧、旋转/缩放状态、释放速度采样和 retarget 基础设施。
- 普通 default/target landing、目标 morph、淡出和已有 Surface FLIP。
- Runtime 侧的 `LandingRect` 已被底层视觉动画使用，但上层
  `ObjectTypeRegistration` 和 `VisualAdapter.land()` 仍将目标收窄为 `HTMLElement`。

### 2.2 Runtime 当前的缺口

| 项目 | 当前状态 | 对 Stage 1 的影响 |
| --- | --- | --- |
| 任意连续位置降落 | 底层动画能消费矩形，上层只接受 `HTMLElement` | 必须补 `free` 判别分支 |
| normal/physical 公共策略 | 内部已有 direct-follow / MotionController 两条路径，但没有画布级明确策略名和默认值 | 必须形成稳定注册配置，默认 physical |
| target 与 free 的目标生命周期 | target 需要真实目标节点，free 不应等待节点或隐藏目标 | 必须拆开 resolve/wait/land 分支 |
| Surface FLIP | 已有 | 直接复用，不在画布业务侧重写 |
| camera | 当前没有 Runtime 语义 | 延后到 Stage 2 |
| connection | 当前不是 Core 必选模块 | 延后，不阻塞卡片迁移 |

### 2.3 Gugu-web 当前画布链路

当前画布主要经过：

```text
Note/Entity/Project/File/Drawer Card
  -> canvasDrag.ts / useCardDrag
  -> usePhysicsDrag.ts
  -> startThresholdDrag / startPhysicsDrag
  -> onFollow: screenToWorld -> 修改画布临时位置
  -> onDrop: coastOffset -> screenToWorld -> 写回 item.x/item.y
  -> animateLanding: 手写落地插值
  -> RelationLayer: 读取拖动或落地中的临时位置
```

抽屉方向另有 `drawerDrag.ts`、`resolveAbsorbTarget` 和
`resolveAbsorbLandingTarget`。这些逻辑与文件夹吸入同构，但目前仍由业务适配器自己决定
目标、代理和落地执行。

### 2.4 审核结论

1. **不是重新发明一套画布拖拽系统。** Runtime 已拥有大部分生命周期，画布应迁移到 Core
   的 Object/Surface/Target 注册和统一 Move 编排。
2. **free 是 Stage 1 唯一的 Core 硬缺口。** 底层 `landDragProxyWithMotion()` 已经以
   `LandingRect` 为基础，缺口主要在 Runtime 解析类型、VisualAdapter 分支和测试。
3. **normal 与 physical 不应通过业务侧复制两套拖拽代码实现。** 物理释放状态应该从同一
   Move Session 传给 Runtime，由 landing profile 选择执行策略。
4. **camera 不能在 Stage 1 偷渡。** 当前画布的 `screenToWorld`、`camera.x/y/scale` 和
   `.canvas-world` CSS transform 属于 Gugu-web 业务；在没有明确 Camera API 前，free
   landing 只接受屏幕坐标快照。
5. **连线不是卡片迁移前置条件。** RelationLayer 可以继续消费业务临时位置；连线 Runtime
   另行设计，避免在 Stage 1 同时改变卡片、相机和连接三套坐标语义。

## 三、Stage 1 契约设计

### 3.1 对象与 Surface

画布和抽屉各自注册为 Surface。卡片只注册一次 Object，并通过 `surfaceId` 表示当前所在
Surface；抽屉内容注册为 Group，由 Surface 变化触发展开/收起、容器高度和卡片 FLIP。
抽屉本身不注册 Target。只有没有 Object 身份的面包屑、吸入按钮等语义落点才注册 Target，
不能把一个临时代理注册成业务 Object。

Gugu-web 是 Vue 业务，实际接入必须优先使用 `gugu-interaction-runtime/vue` 的 Vue API；
Vue composable 内部再调用下面的 Core 注册表。业务组件不直接维护 generation、DOM ref
同步和卸载保护。Group 没有独立的 `useGroup` 或 `runtime.groups.register()`，通过
`data-layout-group`、`data-layout-surface` 标记由 Runtime 自动捕获。

```ts
// Vue 业务接入示意
provideRuntime(runtime)

const drawer = useSurface({
  id: 'canvas:drawer',
  type: 'canvas-drawer',
  accepts: ['canvas-card'],
})

const card = useObject({
  id: `canvas:card:${cardId}`,
  type: 'canvas-card',
  surface: () => inDrawer.value ? 'canvas:drawer' : 'canvas:main',
  abilities: ['move'],
})
```

Vue composable 的内部 Core 描述等价于：

```ts
runtime.registerObjectType('canvas-card', {
  defaultVisualMode: 'detach',
  landingMode: 'free',
  releaseMode: 'physical',
  resolveFreeLandingRect: resolveCanvasLandingRect,
})

runtime.surfaces.register({
  id: 'canvas:main',
  type: 'canvas',
  element: canvasElement,
  accepts: ['canvas-card'],
})

runtime.surfaces.register({
  id: 'canvas:drawer',
  type: 'canvas-drawer',
  element: drawerElement,
  accepts: ['canvas-card'],
})

// Group 不通过独立注册表注册，由 Runtime 从布局标记自动捕获。
// 抽屉容器负责 Surface 高度，内容分组负责组级 FLIP 和展开/收起。
// <section data-layout-surface data-surface-type="canvas-drawer">
//   <section data-layout-group data-drawer-group="canvas:drawer-content">
//     ...drawer cards...
//   </section>
// </section>

runtime.objects.register({
  id: `canvas:card:${card.id}`,
  type: 'canvas-card',
  surfaceId: card.inDrawer ? 'canvas:drawer' : 'canvas:main',
  element: cardElement,
  abilities: ['move'],
})
```

`releaseMode`、`landingMode: 'free'` 和 `resolveFreeLandingRect` 已进入 Runtime Core；
业务不允许自行读取 pointer 速度后再创建第二个 landing 引擎。

### 3.2 normal / physical

两种模式共享同一套抓取、命中、源节点隐藏、兄弟布局 FLIP、regrab 和清理流程，只在
释放后的运动策略上分流：

- `normal`：以释放时的最终位置为起点，使用标准 landing profile 到达自由落点；不把释放
  速度继续注入目标运动。
- `physical`：保留抓取阶段的释放状态交给 Runtime 完成视觉交接；最终自由落点由业务
  通过 `resolveFreeLandingRect` 提供，落点后的视觉飞行由 free 专用的单调缓出策略完成，
  不把释放速度继续注入固定目标弹簧。

默认值必须是 `physical`。调试面板可以切换模式，但业务页面不能根据模式分别绑定两套
pointer 事件。

### 3.3 free landing

`free` 的目标是连续位置，不是一个需要等待出现的 DOM 节点。建议使用判别联合，避免
复制现有 target landing 方法族：

```ts
type MoveLandingResolution =
  | { kind: 'element'; element: HTMLElement }
  | { kind: 'rect'; rect: LandingRect }

runtime.registerObjectType('canvas-card', {
  landingMode: 'free',
  resolveFreeLandingRect: ({ destination }) => {
    const point = destination as { left: number; top: number; width: number; height: number }
    return point
  },
})
```

`rect` 分支必须满足：

- 使用视口坐标，与 `getBoundingClientRect()` 同一坐标系；
- 不调用 `concealElement(target)`，因为不存在目标节点；
- 不进入 target landing 的跨 Surface 等待；
- 仍然使用同一个 `landDragProxyWithMotion()`、同一个 retarget 和完成/取消清理；
- 新事务开始时重新读取当前视觉 rect，不能飞回旧的固定位置。

Stage 1 不把 `camera` 放进该接口。咕咕业务在计算 free rect 前，把世界坐标转换为当前
屏幕坐标；Stage 2 再把这个转换下沉为 Camera API。

### 3.4 free landing 运动参数

画布 free landing 不复用 `LANDING_PROFILE` 的列表弹簧。旧版 Gugu-web 的行为是：释放
速度只参与惯性落点计算，代理从当前视觉位置以固定时长缓出到最终位置。因此 Runtime
对外提供独立配置：

```ts
runtime.configureMotion({
  freeLanding: {
    duration: 550,
    easing: 'cubic-bezier(.22,1,.36,1)',
  },
})
```

默认值与旧画布的落地时长和缓动对齐。`landing` 仍只控制列表/网格 landing，
`freeLanding` 不影响项目列、文件网格或语义目标吸入。free landing 不使用欠阻尼弹簧，
因此不应出现目标点附近的回弹。释放后的最终世界坐标仍由业务通过
`resolveFreeLandingRect` 提供，Runtime 不在视觉层偷偷追加偏移，避免代理终点与真实本体
坐标不一致。释放速度的倍率和上限可以通过对象类型的
`motion.profile.freeLanding.release` 配置；该配置只影响 free 对象，不会改变列表/网格卡片。

## 四、职责边界

### Runtime 负责

- pointer 输入、阈值、Session、ownership 和 regrab；
- Object/Surface/Target 命中与 MoveAction；
- detach/clone 代理和源节点可见性；
- normal/physical 的释放状态、landing、retarget、淡出和清理；
- Surface 布局 FLIP；
- 对 free rect 跳过 DOM target 等待，并保持与 target landing 相同的完成语义。

### Gugu-web 负责

- 卡片和抽屉内容、类型、权限、数据保存和 API 请求；
- `item.x/y`、当前 camera 状态和 `screenToWorld/worldToScreen`；
- 注册 Object/Surface/Target 并同步 DOM 生命周期；
- `RelationLayer` 的 SVG path、关系样式、关系持久化和离场快照；
- 在 Stage 1 提供当前屏幕坐标下的 free landing rect。

### 明确禁止

- 业务侧再次调用 `startPhysicsDrag`、`startThresholdDrag` 编排已迁移的卡片；
- 业务侧创建独立 proxy、landing Promise 或第二个释放速度算法；
- 为画布复制看板/文件的 FLIP、reveal、regrab 逻辑；
- Stage 1 为了通过测试加入隐式 camera fallback。

## 五、Stage 1 实施 TODO

### A. Runtime Core

- [x] 在 `Runtime.ts` 增加 `landingMode: 'free'` 的类型与对象类型解析。
- [x] 增加 `MoveLandingResolution` 判别联合，优先以兼容方式扩展现有解析接口，避免破坏
      file/project 的 `HTMLElement` 调用者。
- [x] 在 `VisualAdapter` 中接受 `HTMLElement | LandingRect`，实现 `element` 与 `rect`
      两条路径；rect 不隐藏目标、不等待目标 DOM。
- [x] 将 `normal`/`physical` 提升为明确的 release/landing 配置，默认 `physical`。
- [x] 确保释放运动状态只从当前 Move Session 传入 landing，不由业务重新采样。
- [x] 检查 `retarget()`、regrab、cancel、pointercancel、旧 session completion 的 owner
      token，确保新事务不会被旧回调覆盖。
- [x] 为 free landing 增加纯 rect 的目标解析、降落、淡出和销毁路径。
- [x] 增加同一对象在兄弟 FLIP 期间 landing 的实时 retarget 测试（复用
      `LandingTargetTracker` 的位置变化回归覆盖）。

### B. Runtime 回归测试

- [x] `free + normal`：有效自由坐标、无效落点回原位、目标没有 DOM。
- [x] `free + physical`：释放状态继承与 MotionController 路径回归。
- [x] target landing 回归：既有 folder 等语义目标仍使用原有目标动画，不能被 free 分支影响。
- [x] 抓取、regrab、取消、pointercancel 后源节点、代理和 ownership 都恢复。
- [x] 卡片 A landing 未完成时抓取卡片 B，A 能跟随兄弟 FLIP 的新位置 retarget。
- [x] 抽屉展开/收起期间卡片进入和退出，Surface 高度与卡片 FLIP 不重复执行。
- [x] 不同尺寸卡片、内容高度变化和空抽屉。
- [x] 运行 typecheck、Runtime 单测和现有项目/文件回归测试。

### C. Gugu-web 画布迁移

- [x] 在咕咕画布入口注册 `canvas` 与 `drawer` Surface。
- [x] 为 Note、Entity、Project、File 卡片建立稳定 Object ID 和统一 Object 类型；Drawer 作为语义 Surface 接收项目回退。
- [ ] 为抽屉内容注册 Group，并接入展开/收起、容器高度和卡片 FLIP；抽屉本身不注册 Target。
- [x] 将 `.canvas-world` 和抽屉 DOM 接到 Core API，保留现有卡片视觉组件。
- [x] 首先迁移 Note 卡，并复用同一 Runtime 对象绑定入口。
- [x] 迁移 Entity、Project、File 卡片，统一使用 `releaseMode: 'physical'`；Runtime 类型保留
      `normal` 配置能力。
- [x] 将画布内部自由落点接到 `screenToWorld -> 当前屏幕 LandingRect`，不改 camera 实现。
- [x] 将画布到抽屉的业务提交接到 Runtime Action；抽屉的 Surface 变化和基础卡片进入路径已接通，Group FLIP 与反向进入动画待下一小步收尾。
- [ ] 验证抽屉展开/收起、卡片让位、卡片进入/退出、regrab、快速连续拖拽。
- [ ] 确认 RelationLayer 仍能读取 Runtime 提供的拖动/landing 临时位置；不迁移连接手势。
- [ ] 清理画布专属旧拖拽代码和无调用的兼容导出，保留看板/文件仍在使用的公共代码。

### D. Node / Connection Runtime

D 阶段在 Stage 1 的卡片、抽屉和 Group 接入稳定后开始。目标是让画布卡片可以声明
Node 模式，并复用咕咕当前的左右连接点和连接线交互。

#### D.1 Node 模式

- 卡片通过 `useObject({ node })` 声明是否启用 Node 模式；普通卡片不显示连接点。
- Node 连接点由 Runtime 根据卡片实时尺寸计算，不由业务侧手动维护屏幕坐标。
- 首版支持左右两侧连接点，连接点位置用 `0 ~ 1` 的边缘比例配置：

```ts
useObject({
  id: `canvas:card:${card.id}`,
  type: 'canvas-card',
  surface: () => 'canvas:main',
  node: {
    enabled: true,
    ports: [
      { id: 'left', side: 'left', position: 0.5 },
      { id: 'right', side: 'right', position: 0.5 },
    ],
  },
})
```

- 连接点视觉沿用咕咕当前样式；连接点不改变卡片 Object 的布局尺寸和拖拽命中区域。
- 卡片移动、FLIP、landing、regrab、尺寸变化后，连接点位置必须自动跟随。

#### D.2 Connection 交互

- 点击连接点进入连接创建状态，再点击另一个合法连接点完成连接。
- Runtime 负责连接点命中、连接方向、取消、重复连接校验和连接生命周期。
- Runtime 发出 `connection-create`、`connection-delete`、`connection-cancel` Action，业务侧
  只负责持久化关系数据。
- 连接端点始终从 Node 的实时 DOMRect 和端口配置计算，不缓存旧屏幕坐标。
- 首版保留 Gugu-web 的 `RelationLayer` 负责 SVG 绘制；Runtime 提供端点几何、临时预览
  状态和 Action，稳定后再评估是否收敛 Renderer。

#### D.3 D 阶段 TODO

- [ ] 在 Core 中增加 Node/Port 描述和对象类型配置。
- [ ] 增加 Vue 层 Node 声明与 DOM 生命周期适配，不新增独立业务拖拽编排。
- [ ] 实现左右连接点的位置计算、视觉状态和命中检测。
- [ ] 实现点击连接点创建连接、取消和重复连接校验。
- [ ] 提供连接端点实时解析和 RelationLayer 所需的预览状态。
- [ ] 补充卡片移动、FLIP、landing、regrab、尺寸变化和相机变化的端点回归测试。
- [ ] 对齐咕咕当前连接点样式、连接方向和连接线几何算法。

### E. Stage 1 验收

- [ ] 画布卡片和抽屉卡片均只通过 Object/Surface/Group 注册接入；只有外部语义落点使用 Target。
- [ ] 默认 physical 的抓取、释放、旋转、速度和落点观感与咕咕当前画布一致。
- [ ] 切换 normal 后只改变释放策略，不改变抓取、命中、FLIP、regrab 和清理。
- [ ] 画布移动不再由旧 `usePhysicsDrag` 直接编排；业务只接收 Action 并更新数据。
- [ ] 不依赖 Runtime Camera，不出现 world/screen 坐标混用。
- [ ] 通过 Runtime 与 Gugu-web typecheck、单测和人工回归；记录剩余视觉差异后才进入 Stage 2。

## 六、Stage 2：相机适配与 Runtime Demo

Stage 2 只有在 Stage 1 稳定后开始。

### 6.1 Camera API

- 提供统一的 Camera 状态、world/screen 转换和 viewport 坐标契约；
- 让 Runtime 在抓取、跟手、free landing、retarget 和 regrab 中消费当前 camera；
- 画布移动、缩放、landing 中改变 camera 时，代理仍按世界位置运动而不是旧屏幕快照；
- 明确卡片内容、代理、连接预览和点阵背景的变换层级，避免只缩放外壳不缩放内容。

### 6.2 独立 Runtime Canvas Demo

- Demo 包含 canvas Surface、可收缩 drawer、分组和多种卡片类型；
- Demo 只展示 Core API 注册和 Action 接入，不复制 Gugu-web 业务编排；
- 提供 normal/physical 开关，默认 physical；
- 复现 pan/zoom、抽屉 FLIP、自由落点、目标吸入、regrab/retarget；
- D 阶段完成后，再评估 ConnectionRuntime 和 RelationLayer Renderer 的通用化。

## 七、验证矩阵与风险

| 场景 | Stage 1 | Stage 2 |
| --- | --- | --- |
| 画布卡片抓取/跟手 | 必须 | 回归并适配相机 |
| 抽屉展开、收起、卡片 FLIP | 必须 | 回归 |
| normal/physical 降落 | 必须，默认 physical | 回归相机变化 |
| free 世界坐标 | 由业务转为屏幕 rect | 下沉 Camera 转换 |
| target 抽屉吸入 | 必须 | 回归 |
| pan/zoom 中拖拽 | 只保证业务现有行为不被破坏 | Runtime 正式支持 |
| landing 中 pan/zoom | 不纳入 | 必须 |
| 连线 Runtime | D 阶段实现 Node/Connection Core，RelationLayer 暂留业务侧 | 回归并适配相机 |
| 多选 | 不纳入 | 单独评估 |

主要风险：

1. `HTMLElement` 到判别联合的接口变更可能影响项目/文件 landing；必须保留 element 分支
   的原有行为，并在现有回归测试下升级。
2. physical 参数如果同时留在 `usePhysicsDrag` 和 Runtime，会形成两套真相；迁移完成后
   只允许 Runtime 持有释放和 landing 参数。
3. Stage 1 若把相机状态直接塞入 free landing，会把屏幕坐标和世界坐标耦合，导致 Stage 2
   仍需重写；第一阶段明确只传视口 `LandingRect`。
4. RelationLayer 仍然需要拖动中位置输入，但这不是第二套拖拽编排；应使用 Runtime 的
   生命周期回调/transition 状态桥接，保留 SVG 和关系数据在业务侧。

## 八、阶段完成定义

Stage 1 完成的标志不是“Demo 能拖动”，而是：

- Gugu-web 画布卡片与抽屉已经使用 Runtime Core API；
- 两种释放模式由 Runtime 统一实现且默认 physical；
- free landing 不依赖目标 DOM，target landing 不受影响；
- 旧画布拖拽编排已删除或明确只服务未迁移功能；
- typecheck、回归测试、连续拖拽和抽屉场景人工验证通过。

Stage 2 完成的标志是：

- Camera 成为 Runtime 明确能力，所有 landing/regrab/retarget 使用统一坐标契约；
- 独立 Demo 只展示公开 API，能作为未来接入和回归基线；
- 相机、卡片、抽屉、连线之间的职责边界在 API 文档中固定下来。
