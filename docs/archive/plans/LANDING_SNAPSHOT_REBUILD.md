# Landing 双快照重构执行文档

## 目标

恢复 landing 的稳定视觉语义：松手时冻结 grabbing 卡片和目标卡片的完整快照，使用两份独立 DOM 进行交叉淡化；位置、尺寸、相机缩放和姿态由外层代理控制，业务卡片布局不参与代理编排。

本次修复针对以下问题：

- 松手首帧内容直接变成目标卡片比例；
- grabbing 阴影或蓝色描边残留到 landing 结束；
- 相机缩放后内容重复缩放；
- 目标卡片的 grid/flex/padding 布局污染源快照；
- 跨 Surface landing/regrab 时代理内容消失或飞向左上角。

## 设计约束

- 不在 Vue、画布、抽屉或文件库业务侧增加 landing 补丁。
- Runtime 不通过搬运 childNodes 来拼装另一张卡片。
- source 和 target 都必须保留完整卡片根节点及其布局上下文。
- 外层运动尺寸与内容布局尺寸分离；camera scale 只能应用一次。
- landing、cancel、invalid return、regrab 都使用同一套快照生命周期。
- 测试失败时先检查实现和夹具，不得通过修改断言、删除用例或 skip 掩盖回归。

## 目标结构

```text
landingHost
├── fromSnapshot   # grabbing 完整快照
└── targetScaleShell
    └── toSnapshot # target 完整快照
```

`landingHost` 负责位置、尺寸、相机 glue、姿态和 pointer-events。两个快照负责自己的业务布局以及表面样式，只有 opacity、目标表面属性参与 landing 过渡。
`targetScaleShell` 单独承接目标内容的比例交接：首帧继承 grabbing 的视觉内容比例，目标快照淡入时再过渡到 `scale(1)`，避免文字、间距和内部 grid/flex 布局在松手瞬间跳到目标比例。

## 执行阶段

### Phase 0：基线与探针收口

- [x] 核对旧版 Gugu `createLandingClone` / `morphLifecycle` 的双快照语义。
- [x] 核对 Runtime 当前 `wrapContentForMorph`、`prepareLandingScaleShell` 和 `VisualAdapter` 调用链。
- [x] 记录蓝色描边、内容比例和 camera scale 的现状。
- [x] 删除诊断探针，避免进入最终提交。
- [x] 固定当前 proxy/layout 测试基线。

### Phase 1：双完整快照

- [x] 新增明确的双快照内部结构。
- [x] 从 grabbing proxy 创建 `fromSnapshot`，冻结创建时的完整 DOM、class、内联布局和视觉状态。
- [x] 从目标元素创建 `toSnapshot`，复制目标完整 DOM、继承文本样式和 CSS variables。
- [x] 两份快照均脱离源节点和目标节点，不共享可变业务布局根。
- [x] 删除 childNodes 搬运和公共内容布局根逻辑。

### Phase 2：外壳与内容解耦

- [x] 外壳统一承载位置、宽高、rotate、perspective 和 camera glue。
- [x] 快照根节点只承载自身布局，不直接读取另一个快照的 grid/flex/padding。
- [x] 确保 camera scale 只作用于外层 scale shell。
- [x] 保证 landing 起点使用 grabbing 的实际视觉尺寸。
- [x] 保证目标尺寸只作为 landing 终点，不提前改写 fromSnapshot。

### Phase 3：表面样式交接

- [x] 记录 source/target/host 三层 border、box-shadow、background、backdrop-filter。
- [x] host 默认不产生额外 border 和 shadow。
- [x] grabbing 阴影、描边和玻璃效果平滑过渡到目标状态。
- [x] 清理 `is-grabbed`、临时 hover 和 Runtime 临时标记对快照的污染。
- [x] 验证抽屉、画布、普通 grid 三类 Surface 的 Runtime 测试路径。

### Phase 4：regrab、取消与异常路径

- [x] landing 过程中 regrab 接管当前 host，不读取 display:none 的旧 source。
- [x] regrab 后目标 object、surface、视觉节点保持一致。
- [x] invalid return 和 cancel 恢复正确的 grabbing 快照。
- [x] 目标节点短暂不可见时，不生成零尺寸落点。
- [x] 清理旧 proxy、快照和 camera glue，避免残留代理。

### Phase 5：测试与收尾

- [x] 增加画布缩放 1.7 拖入抽屉的内容连续缩放回归测试。
- [x] 增加 grabbing 阴影/蓝色描边不残留回归测试。
- [x] 增加不同 grid/flex/padding 的双快照布局测试。
- [x] 增加跨 Surface regrab 测试。
- [x] 增加 invalid return/cancel 测试。
- [x] 运行 typecheck、proxy layout、motion policy、完整单测和 E2E。
- [x] 清理所有探针和无效旧代码。
- [x] 更新 CHANGELOG 和相关集成文档。

## 验收标准

1. landing 首帧内容保持 grabbing 时的实际布局比例。
2. 内容在动画过程中连续过渡到目标卡片布局，不出现首帧跳变。
3. 不出现蓝色描边、抓取阴影或玻璃边框残留。
4. 画布缩放 50%/100%/170% 均只发生一次 camera scale。
5. 抽屉与画布互拖、regrab、取消和无效落点均不产生空代理。
6. 业务侧无需新增或保留 landing 专用逻辑。

## 当前进度

Phase 0–4 已完成。Phase 5 进入回归测试、探针收口和文档收尾。
