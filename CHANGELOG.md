# Changelog

## v1.0.3

### 改进
- **拖拽跨列/落地卡顿优化**：命中判定去重复测量、位置动画改用合成层 transform、跳过折叠分组卡片的 FLIP 快照、合并重复的 Surface 查询，并将拖拽代理提升为独立合成层，大幅降低跨列和落地时的主线程阻塞与掉帧。
- **框架 DOM 接入收敛**：新增 Vue/React DOM 生命周期适配器，统一处理 Object、Surface、Target 的元素绑定、旧节点清理和布局更新时机；Core 注册 API 保持不变，业务仍直接注册语义对象。
- **文件 Demo 接入基线完善**：补齐多级目录、面包屑、网格/列表切换、文件夹 Target 和目录切换 FLIP，文件与文件夹统一复用 Runtime 的 detach/clone 生命周期。

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
