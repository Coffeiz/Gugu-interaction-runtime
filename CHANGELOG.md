# Changelog

## v2.0.1

### 新增
- Vue 适配层正式导出为独立入口，业务可直接引入使用。
- Demo 补齐多选/群组拖拽的完整接入与状态机。
- 新增画布接入 Runtime 的可行性调查报告。

### 改进
- 默认叠卡视觉下沉为 Runtime 内置实现，多选场景不用重复接入。
- 整理移动适配器代码，优化多选拖拽性能。

### 修复
- 修复列表代理抓取与落地尺寸计算问题。
- 修复 clone 落地动画与紧凑代理布局的显示问题。
- 修复 Vue Surface viewport 回调接入问题，修复跨 Surface 对象生命周期问题。
- 修复多选场景下单卡/多卡回位重抓的问题。
- 修复 `motion.enabled: false` 时抓取跟手阶段仍然使用物理运动的问题，现在会正确退化为直接跟手。
- 修复多卡代理落地时的布局问题。
- 修复底部拖拽自动滚动的位置偏移问题。

## v2.0.0

### 新增
- **文件系统 Demo 接入基线**：新增多级目录、面包屑、文件夹目标、目录切换，以及网格/列表视图；文件和文件夹统一复用 Runtime 的 detach/clone 生命周期。
- **框架无关的 DOM 接入**：收敛 Vue/React DOM 适配器和 Core API，业务只需注册 Object、Surface、Target 并订阅 Action。
- **类型级代理布局配置**：新增 `ObjectTypeRegistration.proxyLayout`，可声明列表卡片等对象的 compact 抓取布局；Runtime 统一处理首帧、收缩过渡和 landing 恢复。

### 改进
- **Runtime Core API 收口**：移除 Vue 适配层对核心生命周期的隐式依赖，统一由 Runtime 编排 Session、Owner、输入、目标解析、proxy、landing、reveal、regrab 和清理。
- **目标落地交接稳定化**：支持语义目标可见性控制、可选 `disableTargetVisualMorph`、面包屑目标内容交接和落地期间目标实时跟随兄弟卡片 FLIP。
- **拖拽视觉一致性**：修复高刷屏落地卡顿、代理边框/毛玻璃/深阴影不回落本体、regrab hover 状态丢失，以及布局锚点列尾首帧闪动。
- **运动与布局性能**：拖拽代理提升为独立合成层，命中测量和 Surface 查询去重，跳过折叠分组快照；自动滚动速度按刷新率归一化，减少跨列和 landing 阶段主线程阻塞。
- **文档与接入边界**：补充文件系统迁移计划、Runtime 文件职责、视觉适配边界和 compact proxy API 示例。

### 测试
- Runtime 单元测试、Vue/React 接入类型检查、文件系统 Demo 浏览器回归和 Gugu-web 看板回归保持通过。
- 覆盖文件夹、面包屑、非法落点、连续拖拽、regrab、FLIP、滚动目标和 landing/reveal 清理路径。

## v1.0.3

### 改进
- **拖拽跨列/落地卡顿优化**：命中判定去重复测量、位置动画改用合成层 transform、跳过折叠分组卡片的 FLIP 快照、合并重复的 Surface 查询，并将拖拽代理提升为独立合成层，大幅降低跨列和落地时的主线程阻塞与掉帧。
- **框架 DOM 接入收敛**：新增 Vue/React DOM 生命周期适配器，统一处理 Object、Surface、Target 的元素绑定、旧节点清理和布局更新时机；Core 注册 API 保持不变，业务仍直接注册语义对象。
- **文件 Demo 接入基线完善**：补齐多级目录、面包屑、网格/列表切换、文件夹 Target 和目录切换 FLIP，文件与文件夹统一复用 Runtime 的 detach/clone 生命周期。
- **新增 `disableTargetVisualMorph` 配置项**：target landing 时可关闭"代理套上目标背景/圆角/内容"的视觉 morph，只保留位置和缩小淡出——源和目标对象内部结构差异较大时，默认的内容 morph 会插值出不对齐的中间态，看起来像代理直接变成了目标；只对 `landingMode:'target'` 生效，无效落点飞回原位的默认 landing 不受影响。

### 测试
- **文件系统回归覆盖**：增加切换子目录后空白落点回到当前卡片的回归场景，并通过文件夹、面包屑、非法落点和连续拖拽浏览器测试。

## v1.0.2

### 改进
- **布局与释放性能优化**：合并事务内几何读取、分离 FLIP 读取与写入、缓存滚动容器边界，并收窄 collection presence 扫描范围，减少释放阶段的主线程工作量。
- **CI 依赖安装可复现**：补齐 Vite/Vitest 所需的 esbuild 0.28.1 及平台包，使严格的 `npm ci` 能完成安装。
- **类型工具链 peer 依赖补齐**：devDependencies 补上 `@vue/language-core`，避免接入方类型检查工具链解析缺依赖。

### 修复
- **落地滚动与分组布局时序**：动态跟踪滚动后的落点，修复年月组 FLIP、底部卡片和分组收起过程中内容被提前裁切或动画不同步的问题。
- **输入与动画资源清理**：优化拖动输入链路，清理无效生命周期和重复动画资源，保留完成列表 presence 与收起高度动画。
- **拖拽落地玻璃态交接**：恢复隐藏本体路径在目标样式切换前的过渡，避免 landing 过程中毛玻璃、背景和边框瞬间跳变。

## v1.0.1

### 新增
- 项目页 Runtime 稳定接入契约：业务端只需注册 Object、Surface、Motion 配置并订阅 Action。

### 改进
- Runtime 统一编排项目卡的输入、Session、目标解析、视觉代理、landing/reveal、regrab、滚动、FLIP、组动画和 collection presence。
- Gugu-web 项目页移除旧拖拽与完成列布局编排，直接通过 Runtime 源码接入。
- 合并布局读取与动画写入，复用事务内几何测量结果，并限制 collection presence 扫描范围、延迟幽灵节点创建，降低 release 阶段的主线程阻塞。

### 修复
- 清理项目页残留的旧目标等待、完成列特判和重复生命周期入口，避免与 Runtime 事务竞争。

## v0.9.6

### 新增
- 接入 MotionController 的 grabbing、landing、retarget 和释放运动链路。
- 新增 `configureMotion()`，支持配置跟手、旋转、释放、FLIP、Surface resize、landing 和分组动画参数。

### 改进
- Vue Demo 改为通过 Runtime 注册对象、Surface 和 Motion 配置。
- 重整接入、设计和执行计划文档，补充 API 参数说明与完整示例。

### 修复
- 修复落地交接、Surface resize 时序、快速 regrab 和无效落点回飞相关问题。

## v0.7.1
- 修复 detach 策略落地时内容徽章瞬间出现/消失、没有交叉淡变的问题。

## v0.7.0
- 落地动画新增内容交叉淡变（`targetContent`），落点内容跟源不一样（比如多个徽章）时不再只能靠双克隆整体方案。

## v0.6.2
- 修复 detach 策略落地时样式瞬间跳变、阴影没有过渡动画的问题。

## v0.6.1
- 修复 git 依赖安装后找不到构建产物的问题。

## v0.6.0
- 首个可安装版本：Runtime 核心骨架、MoveBehavior、Action 通道、多组折叠布局。
- 修复跨列拖拽时目标列卡片和容器高度动画不同步的问题。
- 补上 MIT 协议和库打包配置。
