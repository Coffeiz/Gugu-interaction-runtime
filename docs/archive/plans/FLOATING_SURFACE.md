# Floating Surface 收敛设计与执行计划

> 状态：Phase 0–5 已完成；浮动 Surface 的业务侧收敛和 Runtime 发布验收已完成。
>
> 本文针对需要“外壳尺寸动画 + 内容分组布局 + 内部滚动 + 拖拽落点可见性”协同工作的
> 浮动 Surface，例如 Gugu-web 画布右侧项目抽屉。Core 的完整契约仍以
> [INTEGRATION.md](../../INTEGRATION.md) 为准，Vue composable 的现有契约见
> [VUE.md](../../integration/VUE.md)。

## 一、问题与目标

当前一个浮动抽屉需要业务侧同时维护：

- 外层命中节点和布局节点；
- 内部真实滚动节点；
- `scrollHeight` 到 Surface 自然高度的测量函数；
- `ResizeObserver` 和 `nextTick` 后的重复测量；
- 组开合与 Surface resize 的事务衔接；
- 拖拽 landing 目标的自动滚动；
- Vue 组件卸载时 Surface 的注销。

这些逻辑本质上属于 Surface 接入层和 Runtime 布局编排，不应由每个抽屉组件重复拼装。
目标是让 Vue 业务侧能够声明：

```ts
const { elementRef } = useSurface({
  id: 'mind:drawer',
  type: 'mind-drawer',
  accepts: ['mind-project-object'],
  layout: 'grid',
  floating: true,
})
```

然后由 Vue 适配层自动完成稳定 DOM 节点发现、Surface 注册和更新、尺寸观察、真实滚动
视口接线、生命周期清理，并把最终的 `layoutElement`、`measureLayout`、`viewport`
描述交给 Core。业务仍然拥有内容结构、展开状态和数据，不把文件树或项目 Store 放进 Runtime。

## 二、现有代码调查结论

### 2.1 Core 已有能力

Runtime Core 当前已经提供以下能力，不需要为浮动 Surface 重新发明一套动画：

- `Surface.layoutElement`：命中外壳与实际参与 FLIP/resize 的节点可以分离；
- `Surface.measureLayout`：固定外壳背后的自然高度由 Runtime 在布局事务中读取；
- `Surface.viewport`：真实滚动容器由 Runtime 用于目标可见性和自动滚动；
- `Runtime.runGroupToggle()`：组高度、组级 FLIP、Surface resize 和事务清理统一编排；
- `Runtime.keepSurfaceTargetVisible()`：以 landing 时长驱动真实滚动容器，避免代理先结束而滚动还未完成；
- `SurfaceStore` 的 generation、增量 `update()` 和 Vue composable 生命周期保护。

因此，`floating` 不应在 Core 中复制一套“抽屉动画”。它应表达 Surface 需要启用的
浮动布局接入策略，Core 继续消费普通的 Surface 描述和布局事务。

### 2.2 Gugu-web 当前抽屉接入

当前 `CanvasSidebar.vue` 只声明 `mind:drawer` Surface 的业务身份、相机和浮动配置：

- `elementRef` 绑定抽屉外壳，用于命中；
- `floating.open` 声明外壳开合状态；
- `floating.scrollKey` 选择当前真实滚动视口；
- `floating.maxHeight` 声明浮动 Surface 的限高策略；
- `camera` 声明抽屉卡片与画布相机比例的交接。

`useSurface` 负责节点发现、自然高度测量、Resize/Mutation 观察、开合高度动画和生命周期。
`DrawerViewport.vue` 只提供 `data-layout-role="viewport"` 语义节点与样式，不保存高度、不调用
过渡函数；`CanvasSidebar.vue` 只保留内容显隐、项目分组状态和业务数据。业务侧不再维护
`panelHeights`、`measurePanel()`、`ResizeObserver` 或 `targetHeight`。

### 2.3 看板列是现有基准

项目普通列和已完成列已经使用：

```ts
useSurface({
  id,
  type: 'project-column',
  accepts: ['project-card'],
  layout: 'grid',
  viewport: () => colBodyRef.value,
})
```

它们的关键区别是：列本身不需要“浮动外壳自然高度”策略，`viewport` 直接由组件 ref
提供。因此浮动 Surface 应该是 `useSurface` 的增强模式，而不是新的注册体系。

## 三、目标 API

### 3.1 第一阶段 API：显式开启浮动模式

```ts
interface UseSurfaceOptions {
  // 现有字段...
  floating?: boolean
}
```

```ts
useSurface({
  id: 'mind:drawer',
  type: 'mind-drawer',
  accepts: ['mind-project-object'],
  layout: 'grid',
  floating: true,
})
```

`floating: true` 的含义是：Vue 适配层启用一组约定式节点发现和观察策略。它不是
`layout: 'free'` 的替代品，也不改变卡片视觉、物理、landing 或 Surface 的 grid/free
语义。

### 3.2 DOM 语义标记

默认发现规则必须稳定、可检查、与领域无关：

```html
<div ref="surfaceRef" data-runtime-surface data-floating-surface>
  <div data-layout-role="viewport">
    <div data-drawer-scroll="projects">
      <div data-layout-collection>
        <div data-layout-content data-layout-open="true">
          <!-- cards -->
        </div>
      </div>
    </div>
  </div>
</div>
```

推荐角色：

- `data-runtime-surface`：`useSurface().elementRef` 绑定的命中/外壳节点；
- `data-layout-role="viewport"`：默认 `layoutElement`；
- `data-drawer-scroll`：默认 `viewport`，同一 Surface 有多个滚动面板时由 key 选择；
- `data-layout-content`、`data-layout-open`：供现有 GroupLayout 使用，不由适配层代替业务
  修改展开状态。

自动发现失败或 DOM 拓扑特殊时，仍允许显式覆盖：

```ts
useSurface({
  // ...
  floating: true,
  layoutElement: () => viewportRef.value,
  viewport: () => scrollRef.value,
  measureLayout: () => ({ height: contentRef.value?.scrollHeight ?? 0 }),
})
```

显式回调优先于自动发现，保证迁移期间可渐进接入，也避免适配层猜错 Teleport、嵌套
Surface 或虚拟列表的真实滚动节点。

### 3.3 自动计算边界

Vue 适配层可以自动计算：

- `layoutElement`：查找 Surface 根下第一个 `data-layout-role="viewport"`；
- `viewport`：优先查找当前 `scrollKey` 对应的 `[data-drawer-scroll]`，否则查找
  `data-scroll-viewport`，最后不自动回退到外壳；
- `measureLayout`：读取 `layoutElement` 的自然尺寸，或读取其下第一个布局内容/滚动
  内容的 `scrollHeight`，再按可选 max size 限制；
- `ResizeObserver`：在节点挂载、子树尺寸变化、Surface 切换时更新描述；
- `generation`、ref 同步和卸载注销：继续由现有 `useSurface` 完成。

以下内容不自动猜测：

- 哪些业务组默认展开；
- 搜索过滤、项目归属和权限；
- 外壳最大高度的产品规则；
- 内容滚动位置是否锚定底部；
- 多个同级滚动容器之间的业务选择。

这些应通过 `floating` 选项或显式函数提供，而不是写死到 Runtime。

## 四、推荐的实现边界

### Vue 适配层负责

1. 扩展 `UseSurfaceOptions` 的 `floating` 和可选 `scrollKey/maxHeight`；
2. 以 `elementRef` 为根建立受限的 DOM 查询，不扫描全局 `document`；
3. 将自动发现结果转换成 Core 的 `layoutElement`、`viewport`、`measureLayout`；
4. 用 ResizeObserver 触发 Surface 的增量 `update()`，并在组件卸载时清理；
5. 对节点暂时不存在、Teleport 切换和旧 generation 进行安全处理；
6. 提供可观察的开发期诊断信息，但不输出用户内容或业务数据。

### Runtime Core 负责

1. 消费 Surface 描述，不认识 Vue、DrawerViewport 或具体业务类名；
2. 统一执行组开合、Surface resize、FLIP 中断和事务合并；
3. 统一执行 landing 目标自动滚动；
4. 处理 Session、regrab、proxy 和 Surface ownership；
5. 保证未提供 `floating` 时现有 `useSurface` 行为完全不变。

### Gugu-web 业务侧保留

1. `data-layout-*` 结构标记；
2. 组的 open/closed 状态和点击事件；
3. 项目数据过滤、排序、移动 API 和 Action 消费；
4. 外壳视觉 CSS、宽度、最大高度产品规则；
5. 内容滚动位置的产品语义（例如底部锚定）；
6. 在自动发现无法表达时提供显式 getter。

## 五、实施记录

### Phase 0：基线与契约 ✅

- [x] 冻结 `floating?: boolean | FloatingSurfaceOptions` 的最小 API，不先加入过多开关。
- [x] 确认 `data-runtime-surface`、`data-layout-role="viewport"`、`data-drawer-scroll`
  的命名和优先级。
- [x] 记录看板列、文件库 Surface、项目抽屉三类现有行为作为回归基线。
- [x] 增加“自动发现失败不回退到错误外壳滚动”的文档和诊断契约。

### Phase 1：Vue Surface 自动发现 ✅

- [x] 抽出纯函数 `resolveFloatingSurfaceDom(root, options)`，不依赖 Vue 响应式。
- [x] 实现 `layoutElement`、`viewport`、自然高度测量和 max size 计算。
- [x] 让显式 getter 覆盖自动发现结果。
- [x] 在 `useSurface` 中接入 ResizeObserver 和 MutationObserver，更新 Surface 描述。
- [x] 覆盖根节点内节点发现、真实滚动节点选择、显式覆盖和卸载清理。

### Phase 2：Core 事务接入

- [x] 确认 `floating` 不进入 Core 的 DOM 猜测逻辑；Core 只接收标准 Surface 字段。
- [x] 为 `viewport` 与 `layoutElement` 不同的 Surface 增加自动滚动回归测试。
- [x] 覆盖组开合、卡片拖入、卡片拖出、landing 中断和 regrab 的 resize/scroll 时序；组开合、事务中断和 regrab 使用 Runtime 现有回归用例，浮动形态另补分离节点用例。
- [x] 确认 Surface resize 与业务侧旧高度动画不会并行运行；Runtime 的 `runtimeLayoutTransaction`、Surface resize token 和布局缓存测试覆盖重复捕获与中断续播。

Phase 2 的关键约束是：浮动 Surface 的外壳只负责命中和容器语义，`layoutElement` 负责尺寸事务，
`viewport` 负责滚动。Core 不读取 `floating`，也不根据业务类名猜测节点。对应回归覆盖位于
`src/__tests__/runtimeOrchestration.test.ts` 与 `src/__tests__/surfaceLayoutMeasure.test.ts`。

### Phase 3：Runtime Demo 迁移

- [x] 给 Demo `CanvasDrawer` 加稳定语义标记。
- [x] 用 `useSurface({ floating: true })` 替代 Demo 侧手写 Surface getter。
- [x] 删除 Demo 中重复的 Surface DOM 查询、observer 和注册生命周期代码；Demo 只保留组件根节点的 composable ref 绑定。
- [x] 保持现有抽屉视觉、卡片尺寸、拖拽速度和 landing 样式不变，并完整迁入备份分支的浮动外壳、宽度开合和标题过渡。
- [x] 添加抽屉目标在可视区外时自动滚动到位的 DOM 回归；`runtimeOrchestration.test.ts` 同时断言外壳滚动位置不变、内部 viewport 滚动到目标。

Phase 3 已完成。Demo 的浮动抽屉现在只通过稳定语义标记和 `useSurface({ floating })` 接入；
抽屉组件只保留内容显隐、滚动语义和分组状态。

### Phase 4：Gugu-web 迁移

- [x] 将 `CanvasSidebar` 的 `mind:drawer` 注册迁移到 Vue composable。
- [x] 将 `DrawerShell` 的 Surface 根节点和 `DrawerViewport` 的布局/滚动语义接入收口。
- [x] 删除业务侧重复的 Surface `querySelector`、注册/注销生命周期、面板高度缓存、测量函数和观察器；保留项目组、双面板和滚动状态同步。
- [x] 由 Runtime 统一管理浮动 Surface 的自然高度、最大高度和开合高度动画。
- [x] 接入项目抽屉 Surface 的展开态命中边界：收起态和画布面板不注册为项目抽屉落点，避免扩大旧命中范围。
- [x] 做项目抽屉与项目已完成列的跨 Surface 拖拽、landing、regrab、超出视口自动滚动回归（Phase 5 发布验收）。

### Phase 5：收口与发布

- [x] 跑 Runtime typecheck、unit、build 及 Demo E2E。
- [x] 跑 Gugu-web frontend typecheck；关键交互由现有 Runtime/Gugu 回归基线覆盖。
- [x] 删除迁移期的业务高度观察、重复 FLIP 编排和临时探针；保留通用列表自身的独立布局动画。
- [x] 更新 `VUE.md`、`INTEGRATION.md`、CHANGELOG 和迁移说明。
- [x] 记录明确的回滚点：关闭 `floating` 后普通 Surface 行为必须保持可用。

## 六、验收标准

- 普通 grid/free Surface 不受 `floating` 实现影响。
- 浮动 Surface 只需注册 `useSurface({ floating: true })` 和稳定 DOM 标记，即可获得
  正确的布局节点、真实滚动节点、自然高度测量和生命周期清理。
- 目标卡位于抽屉可视范围外时，Runtime 滚动真实内容容器，landing 目标最终可见。
- 组展开/收起、卡片进出和 Surface resize 不出现二次动画、反向动画或高度闪现。
- landing/regrab 不会因为自动发现节点暂时为空而飞向浏览器左上角或丢失代理。
- 显式 getter 可以覆盖自动发现，复杂 DOM 拓扑无需修改 Core。
- Gugu-web 视觉和拖拽行为保持当前基线，业务侧只减少接线代码，不改变产品样式。

## 七、明确不做的事情

- 不把 `floating` 做成新的拖拽模式或新的 landingMode。
- 不把外壳 resize、组状态、滚动锚定塞进 Object 或 Target。
- 不让 Core 依赖 Vue、CSS 类名或 Gugu-web 业务组件名。
- 不用自动发现替代权限、数据移动、Action 提交和业务 Store。
- 不在测试失败时通过修改断言、删除用例或 `skip` 掩盖回归。
