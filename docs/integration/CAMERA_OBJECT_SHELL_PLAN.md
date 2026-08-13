# Object Camera Shell 统一适配实施计划

> 状态：Phase 1A、Phase 1B、Phase 2 已完成，进入抓取与 landing 的专项回归阶段。
>
> 目标：让摄像机适配成为对象类型的显式能力。只有注册时声明 `camera` 的对象才会
> 在 Runtime 创建代理 `cameraShell`，并消费 Surface 的 camera scale/origin；普通列表、
> 网格和抽屉对象保持原有尺寸与内容布局流程。

## 一、调查结论

### 1. 当前已有的基础能力

- `Surface` 已支持 `camera.scale`、`camera.origin` 和 `camera.pickupDuration`。
- `Runtime` 已有 `getSurfaceCameraPickupScale()`、`getSessionContentScale()`、
  `getSurfaceCameraOrigin()`，可以提供抓取期间的实时 camera 状态。
- `createDragProxy()` 已有 `data-runtime-proxy-scale-shell`，用于把外层运动尺寸和
  内容布局尺寸分离。
- landing 已有相机 glue、目标快照和双快照结构，能够承载相机变化期间的连续运动。
- 画布对象当前通过 Surface camera 进入这条链路，但对象注册本身没有 camera 能力声明。

### 2. 当前问题

当前 `Runtime.createVisualLifecycleContext()` 会无条件注入 `contentScale` 和
`cameraOrigin`；`MoveAdapter` 抓取时也无条件调用 Surface camera pickup scale。结果是：

1. 普通对象跨 Surface 时可能误用 camera scale；
2. 窄列到宽列时，卡片内部文字/间距会随整体 shell 错误放大；
3. 画布对象和普通对象没有明确的能力边界，问题只能靠 Surface 类型和业务侧约定隐式判断；
4. landing 的外层尺寸、目标内容布局尺寸和 camera 比例没有统一的对象级策略入口。

### 3. 重要约束

- 不在对象注册时直接插入真实 DOM。`registerObjectType()` 注册的是类型策略，具体对象
  元素可能尚未挂载；shell 应在 proxy 创建时懒创建。
- 不改变业务真实 DOM 的结构。`cameraShell` 只属于 Runtime 临时 proxy；本体仍由 Vue/
  React 管理。
- 普通对象默认不启用 camera。需要画布适配的对象类型必须显式声明 `camera`。
- camera scale 只能作用于外层 shell 一次；目标内容层不能再次套用同一比例。
- camera 适配不能改变普通 grid/list 的目标宽高插值和内容自然重排。

## 二、目标 API

在 `ObjectTypeRegistration` 增加对象级 camera 策略：

```ts
type ObjectCameraConfig = {
  /** 是否启用对象级 camera 适配；未配置等同于 false。 */
  enabled?: boolean
  /** 抓取阶段是否使用 Surface.camera.scale；默认 true。 */
  pickup?: boolean
  /** proxy 内容是否由 cameraShell 承载 scale；默认 true。 */
  scale?: boolean
  /** free landing/rebase 是否跟踪 Surface.camera.origin；默认 true。 */
  origin?: boolean
  /** landing 阶段是否继续跟踪相机变化；默认 true。 */
  landing?: boolean
}

runtime.registerObjectType('mind-card', {
  defaultVisualMode: 'detach',
  camera: { enabled: true },
})

runtime.registerObjectType('project-card', {
  defaultVisualMode: 'detach',
  // 不声明 camera，保持普通列表卡片的尺寸和内容布局逻辑。
})
```

实现上建议支持 `camera: true` 作为简写，规范文档统一使用对象形式，便于未来分别
关闭 `pickup`、`origin` 或 `landing`。最终公开类型从 `src/index.ts` 导出。

### 2.1 本轮 API/函数审查结论

| 名称 | 当前性质 | 是否写入接入文档 | 文档边界 |
| --- | --- | --- | --- |
| `ObjectTypeRegistration.camera` | 新增公开注册字段 | 是 | 说明布尔简写、对象形式和 Phase 1A 的兼容语义 |
| `ObjectCameraConfig` | 新增公开类型 | 是 | 说明 `enabled/pickup/scale/origin/landing` 的用途；不承诺 Phase 1A 已控制视觉 |
| `ResolvedObjectCameraConfig` | 新增公开只读结果类型 | 是，放在 API 类型说明 | 业务可读取结果，但不应自行创建或修改 |
| `runtime.getObjectCameraConfig(objectId)` | 新增公开查询方法 | 是 | 只返回对象类型策略的归一化结果；不是 camera 当前实时数值读取 API |
| `VisualLifecycleContext.camera` | adapter 可观察上下文 | 是，在 `VisualAdapter` 章节说明 | 供自定义 adapter 判断能力；Phase 1A 不改变 `contentScale/cameraOrigin` 的注入 |
| `Surface.camera` | 已有公开 Surface 配置 | 是 | 提供 scale/origin/pickupDuration，不决定哪些对象消费它 |
| `getSurfaceCameraScale()` | Runtime 当前公开方法 | 只在设计/高级 API 章节说明 | 读取 Surface 原始 camera scale；业务不应用它绕过 object policy |
| `getSurfaceCameraPickupScale()` | Runtime 当前公开方法 | 只在设计/高级 API 章节说明 | Runtime 内部抓取曲线；业务不应直接驱动 proxy |
| `getSurfaceCameraOrigin()` | Runtime 当前公开方法 | 只在设计/高级 API 章节说明 | Runtime 内部 landing glue 数据源；业务不应自行创建 glue |
| `getSessionContentScale()` | 私有内部函数 | 否 | 只记录在实现链路，后续由 camera policy 门控 |
| `createDragProxy()` / `applyFloatingStyle()` | DOM 内部/高级导出函数 | 否 | 不作为 camera 接入入口；shell 生命周期由 Runtime 管理 |
| `data-runtime-proxy-scale-shell` | 临时 DOM 标记 | 否 | 保留为兼容选择器，不承诺业务依赖 |
| `cameraShell` / `cameraGlue` | Runtime 临时 DOM 结构 | 否 | 只写设计约束，不写成业务可创建节点 |

### 2.2 当前语义与目标语义

Phase 1A/1B 的实现必须在文档中明确区分两套语义：

```text
历史（Phase 1A 之前）：
未声明 camera                  -> 兼容旧的 Surface.camera 注入

当前（Phase 1B）：
未声明 camera / camera:false       -> 不消费 Surface.camera
camera:true 或 enabled:true        -> Runtime 创建/维护 cameraShell 并消费 camera
```

Phase 1A 只建立声明和观察点；Phase 1B 切换 camera 数据入口；Phase 2 完成 proxy shell
标记、抓取/landing 交接和 camera glue 的能力门控。

## 三、实施阶段

### Phase 1：注册策略和能力判定

#### Phase 1A（已完成）

- [x] 新增 `ObjectCameraConfig` / `ResolvedObjectCameraConfig` 类型并加入
  `ObjectTypeRegistration.camera`。
- [x] Runtime 增加 `getObjectCameraConfig(objectId)`，统一归一化布尔简写和子开关。
- [x] 将归一化配置暴露到 `VisualLifecycleContext.camera`，供后续 adapter/shell 阶段消费。
- [x] 当时保持现有兼容行为，未切换默认值，也未改变 proxy、landing、camera glue 和内容比例。
- [x] 增加默认、显式启用、显式关闭和子开关的回归测试。

Phase 1A 只建立 API 和观察点，不会自动创建或启用新的 cameraShell。

#### Phase 1B（已完成）

- [x] 默认 `enabled: false`，确保未迁移的普通对象行为不变。
- [x] 将 `camera: false` / 未声明切换为真正的关闭语义。
- [x] 将 Runtime Demo 和 Gugu Mind 画布对象迁移为显式 `camera: { enabled: true }`。
- [x] 切换后验证普通对象不再消费 Surface.camera。

验收：未声明 camera 的对象不再得到 `contentScale` 或 `cameraOrigin`；声明 camera 的
对象得到稳定、可测试的配置。当前仍使用既有 proxy scale shell，并通过 Runtime 内部
标记和能力门控完成 cameraShell 生命周期；未新增业务可调用的独立 DOM API。

### Phase 2：统一 cameraShell 生命周期（已完成）

- [x] 将 `createDragProxy()` 的 scale shell 明确标记为 Runtime camera shell，并保留
  `data-runtime-proxy-scale-shell` 兼容选择器。
- [x] 仅当 `camera.enabled && camera.scale !== false` 时创建/启用 cameraShell 的
  camera scale 逻辑；普通对象仍可使用普通 proxy，但不套相机比例。
- [x] shell 统一承载 camera scale、尺寸交接和必要的 transform-origin；定位壳统一承载
  left/top、perspective、rotate 和 pointer-events。
- [x] source snapshot、target snapshot 和业务内容层不直接写 camera scale。
- [x] regrab、cancel、invalid return 沿用同一个 proxy shell 生命周期，避免重复创建或遗留 glue。

验收：普通列跨列时内容按目标宽度自然重排；画布对象在 50%/100%/170% camera 下只
发生一次比例变化。

实现说明：`data-runtime-camera-shell="true"` 是 Runtime 内部标记，不是业务接入选择器；
普通对象仍保留通用 `data-runtime-proxy-scale-shell` 以兼容既有布局测试，但不会消费
Surface camera。抓取代理交接到 landing 时复用同一 shell，只有启用 camera 能力的 free
landing 才创建 `cameraGlue`。

### Phase 3：抓取与 landing 接入

- [x] `MoveAdapter` 只有在对象 camera policy 开启且 `pickup !== false` 时调用
  `getSurfaceCameraPickupScale()`。
- [x] `createVisualLifecycleContext()` 只为 camera 对象注入 `contentScale`。
- [x] `cameraOrigin` 只在 `enabled && origin !== false && landing === true` 时注入。
- [x] free landing 的 camera glue 只跟踪启用 camera 的对象；普通 grid/list landing
  不创建 camera glue。
- [x] 跨 Surface landing 使用“源 camera 状态 + 目标布局尺寸”计算外层终点，目标内容
  层不通过整体 scale 模拟目标宽度。
- [x] 目标 Surface 变化时，先读取目标实际 rect，再让 shell 过渡到目标尺寸，避免
  松手后最后几帧才突然匹配目标。

### Phase 4：业务接入与兼容

- [x] Runtime Demo 的 Canvas 对象注册 `camera: { enabled: true }`。
- [x] Gugu Mind Canvas/Drawer 的对象类型注册 camera 能力；普通项目卡、文件卡、
  看板卡不启用 camera。
- [x] 删除业务侧针对 camera shell、scale 或 origin 的重复补丁；业务只提供 Surface
  camera 数据。
- [x] 更新 `docs/INTEGRATION.md`、`docs/CANVAS_RUNTIME_FEASIBILITY.md` 和 API 示例，
  明确 camera 是 object capability，不是所有 free/grid 对象的隐式行为。

兼容说明：Gugu 旧的 `interaction/drag` 视觉实现仍作为未使用的历史模块保留，当前 Mind
卡片由 `runtime.bindObjectPointer()` 接管；它们不再被 Mind 组件导入，也不参与 camera
shell 生命周期。该批次不删除历史文件，避免影响外部旧入口，Phase 5 再统一处理废弃入口。

### Phase 5：回归测试和收口

- [ ] 注册策略测试：默认关闭、显式开启、各子开关关闭。
- [ ] proxy 结构测试：camera 对象有 shell，普通对象不执行 camera scale；shell 不
  改变业务快照的内部布局。
- [ ] 跨窄列/宽列 landing：文字、图标、padding 按目标内容尺寸自然过渡，不整体放大。
- [ ] 画布 camera 50%/100%/170% 抓取、regrab、landing、retarget 测试。
- [ ] 画布拖入抽屉、抽屉拖回画布测试，验证 source/target camera 策略交接。
- [ ] cancel、invalid return 和 landing 中 camera 变化测试。
- [ ] 运行 Runtime typecheck、单测和 Gugu 端手测；清理所有临时探针。

## 四、建议的内部数据流

```text
registerObjectType(type, { camera })
                  │
                  ▼
        Runtime 归一化 ObjectCameraConfig
                  │
    ┌─────────────┼─────────────┐
    ▼             ▼             ▼
 pickup       lifecycle       landing
 policy       context         policy
    │             │             │
    └─────── cameraShell / cameraGlue ───────┘
                         │
              fromSnapshot / targetSnapshot
                         │
              外层尺寸过渡 + 内容自然布局
```

## 五、风险与决策

### 风险 1：默认行为变化

如果默认开启 camera，普通对象会继续受到 Surface camera 的隐式影响，无法解决当前
回归。因此本计划选择默认关闭，并在画布对象注册处显式开启。

### 风险 2：注册时创建 DOM

对象类型注册早于具体 DOM 挂载，且同一类型对应多个对象；注册时创建 shell 会产生
生命周期泄漏和 Vue/React 所有权冲突。因此 shell 必须是 proxy 生命周期内的懒创建资源。

### 风险 3：重复缩放

不得同时把 camera scale 写到 proxy、cameraShell 和 target content shell。最终契约是：

- proxy：位置、姿态、普通 landing 尺寸；
- cameraShell：camera scale/origin 适配；
- content snapshot：目标自身布局和样式；
- target content shell：只做 source/target 内容交接，不重复消费 camera scale。

## 六、完成标准

1. 业务注册一个 camera-enabled object 后，不需要手动创建 cameraShell、cameraGlue 或
   处理 camera scale。
2. 未声明 camera 的 object 完全不受 Surface.camera 影响。
3. 窄列到宽列、普通列到画布、画布到抽屉三类路径都不会出现内容整体错误放大。
4. camera scale 在整个抓取到 landing 生命周期中最多应用一次。
5. 所有旧的业务侧 camera/scale 补丁已删除或有明确保留理由。
