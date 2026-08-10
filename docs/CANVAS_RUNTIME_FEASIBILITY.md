# 画布（Mind Canvas）接入 Runtime 可行性 + 实施方案

> 状态：调研报告，尚未开始实施。不改变任何现有代码或 API 承诺。
>
> 关联文档：[INTEGRATION.md](./INTEGRATION.md)（Core API 契约）、
> [integration/VUE.md](./integration/VUE.md)（Vue 适配层设计基线）、
> [PROJECT_RUNTIME_CLOSURE_PLAN.md](./PROJECT_RUNTIME_CLOSURE_PLAN.md)（项目页收口方案，
> 结构参考对象）。

## 背景与目标

Gugu-web 的看板（`Projects`）和文件库（`Files`）已经完成 Runtime 接入，并且已经在用
`gugu-interaction-runtime/vue` 的 `useObject`/`useSurface`/`useTarget`（`useTarget` 已随
Core `TargetStore` 补齐 generation/`update()` 落地，见下文"现状确认"）。画布
（`frontend/src/views/Mind/`，思维导图/贴纸自由画布）是唯一还跑在旧引擎
（`frontend/src/interaction/drag/` 下的 `startPhysicsDrag`/`startThresholdDrag`，
`usePhysicsDrag.ts`）上的主力交互面。

目标：评估画布迁移到 Runtime 的可行性，给出具体差距、新增 API 草案、复用/重写清单和
分阶段计划，供后续实际排期参考。**本报告不改代码。**

## 现状确认（本次调研新验证的事实）

1. **Vue 适配层已用于生产**：`frontend/src/views/Files/components/RuntimeFileCard.vue`、
   `RuntimeFolderCard.vue`、`RuntimeFileListRow.vue`、`RuntimeFolderListRow.vue`、
   `RuntimeBreadcrumbTarget.vue` 以及 `Projects/components/ProjectCard.vue`、
   `KanbanColumn.vue`、`DoneColumn.vue` 均已使用 `useObject`/`useSurface`/`useTarget`。
   `useTarget` 不再是"待实现"状态——文件库面包屑吸入已经在用它，说明 VUE.md 里
   "TargetStore 补齐 generation/update() 后再实现 useTarget" 这条前置条件已经完成。
2. **画布完全没有接入痕迹**：`grep -rl "useObject\|useSurface\|useTarget\|useRuntimeAction\|
   useRuntimeTransition" frontend/src/views/Mind` 零命中。画布拖拽全部走
   `frontend/src/interaction/drag/adapters/canvasDrag.ts`（`useCardDrag`）→
   `usePhysicsDrag.ts` 的 `startPhysicsDrag`/`startThresholdDrag`，与 Runtime 无关。
3. **`runtime.registerObjectType` 已注册的类型**（`frontend/src/interaction/runtime/setup.ts`）
   只有 `project-card`、`file-item`、`folder-item`，没有任何画布贴纸类型。

## 画布现有拖拽链路（完整梳理）

```
NoteSticker/EntitySticker/ProjectRefCard/FileRefCard/ProjectDrawerCard（各贴纸组件）
  → useCardDrag(canvasDrag.ts) .onPointerDown
    → startThresholdDrag（usePhysicsDrag.ts，位移阈值判定，复用看板/文件同一份）
      → startDrag → startPhysicsDrag（usePhysicsDrag.ts，旧物理引擎：抓取克隆、
        弹簧跟手 spring-follow、松手速度采样、抛物线惯性、CSS transition 落地飞行）
        → onFollow 回调：screenToWorld(clientX,clientY) 换算世界坐标 → onDragMove
          → MindCanvas.vue onItemDragging：只改本地视觉状态（不落库）
            → RelationLayer.vue 用这份"正在拖拽的位置"重算连线路径（纯响应式 computed，
              不依赖拖拽引擎）
        → onDrop 回调：coastOffset() 把松手速度折算惯性偏移 → screenToWorld 算落点世界坐标
          → opts.onDropAt(worldX, worldY) 同步写回 item.x/item.y（落库）
          → animateLanding()：cubic-bezier(0.22,1,0.36,1) 精确复刻 usePhysicsDrag 的
            _SETTLE 曲线，逐帧回调 onLanding 只喂 RelationLayer 一份"未到终点的插值位置"，
            避免连线在落库瞬间抢跳到终点
          → onLandingDone：清掉插值覆盖，RelationLayer 改读真实 item.x/y
```

关键支撑设施：

- **`MindCanvas.vue` 的 `screenToWorld`/`camera`（x/y/scale）**：纯坐标数学，处理画布
  pan/zoom。`camera` 通过 CSS `transform: translate3d(...) scale(...)` 应用在
  `.canvas-world` 容器上，贴纸是这层的绝对定位子元素。
- **`RelationLayer.vue`**：连线路径完全是"读当前 `item.x/y`（或某个覆盖位置）→ 算锚点 →
  画 SVG path"的纯响应式渲染，**不订阅、不依赖任何拖拽引擎的事件或 API**——只要业务把
  "当前正在被拖动的位置"这份数据喂给它（不管这份数据来自旧引擎的 `onFollow` 还是新
  Runtime 的等价回调），连线渲染逻辑本身不用动。
- **`interaction/drag/adapters/drawerDrag.ts`**：抽屉（`components/drawer/`）方向的拖拽
  适配器，抽屉本身是线性滚动容器（`DrawerTrack.vue`），卡片拖进抽屉是"落在语义容器"
  （结构上等价于文件拖进文件夹，`landingMode:'target'` 已解决）；拖出抽屉回画布则是
  "落在任意世界坐标"，与画布内部拖拽同一个缺口。
- **`resolveAbsorbTarget`/`resolveAbsorbLandingTarget`**（`canvasDrag.ts` 里
  `useCardDrag` 的可选参数）：画布项目卡拖回已打开的项目抽屉时，命中该区域就不走世界坐标
  落点，改成"缩小吸入语义容器"——这一段本质上就是 `landingMode:'target'` 的手写实现，
  Runtime 接入后可以直接被 `resolveMoveLandingTarget` + `landingMode:'target'` 替代。

## Runtime 现有能力 vs 画布需求：差距分析

### 结论先行

画布需求可以拆成四块，其中三块 Runtime 现有 API 已覆盖或只需组合现有能力，**只有一块
（"落在任意世界坐标"）是真正阻塞画布迁移的 API 缺口**，且这个缺口的动画执行层其实已经
就绪，缺口窄到只在"契约类型"这一层。

多选/批量拖拽在下表里单列一行，但**不是阻塞本次迁移的需求**——本次调研在
`frontend/src/views/Mind` 下没有找到任何多选/框选/选区状态的现有实现（`grep`
`multiSelect`/`box-select`/`selectedIds` 等关键字零命中），画布当前甚至没有"选中单张
贴纸"的概念，遑论多选。多选是 Runtime 层面确实缺失的能力，但**不是画布现状需要迁移的
功能**，只有当产品明确要给画布加多选时才需要立项；本报告把它的 API 草案放进"附录"，
不计入阶段 1-3 的迁移范围。

| 需求 | 是否有缺口 | 结论 |
|---|---|---|
| 抓取代理创建、跟手视觉、抛开手感 | 否 | `createDragProxy`/`grabAlign`/动量已覆盖 |
| 落在真实 DOM 语义容器（抽屉/项目抽屉吸入） | 否 | `landingMode:'target'` + `resolveMoveLandingTarget` 已覆盖，等价于文件拖入文件夹 |
| pan/zoom 下的命中判定 | 否（已验证） | 见下文"验证 2" |
| 连线跟手重算 | 否 | 纯业务渲染，与拖拽引擎解耦，替换引擎不影响这部分代码 |
| **落在任意连续世界坐标（无对应 DOM 节点）** | **是** | Runtime 契约层（`Runtime.ts`/`VisualAdapter.ts`）的 `resolveMoveLandingTarget`/`land()` 签名都写死 `HTMLElement`；但底层动画基元 `landDragProxyWithMotion`（`Visual.ts:660`）已经只依赖 `LandingRect = Pick<DOMRect,'left'\|'top'\|'width'\|'height'>`，不要求真实 Element。缺口在"谁来产出这个 rect 并传下去"，不在动画能力本身 |
| 多选/批量拖拽（贴纸群组一起移动） | 是（但非本次范围） | `Session`/`ObjectStore` 是单对象设计，无 Group Session；但画布现状没有多选功能，不是迁移需要覆盖的需求，草案见附录，不排入阶段 1-3 |

### 验证 1：落地缺口的精确位置（逐层追踪）

自底向上追踪落地相关代码，确认"任意坐标落地"具体卡在哪一层：

1. **`landDragProxyWithMotion(proxy, target: LandingRect, options)`**
   （`gugu-interaction-runtime/src/dom/Visual.ts:660`）——**不要求 Element**。
   `LandingRect = Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>`
   （`Visual.ts:429`），动画部分（`createCardMotionController` 弹簧、`retarget()`、
   dismiss 淡出）全部基于这个纯数据 rect 运行。这一层已经具备落在任意坐标的能力，
   画布甚至可以不改这一层，直接构造一个 `{left, top, width: cardWidth,
   height: cardHeight}` 传进去。
2. **`DefaultVisualAdapter.land(proxy, target: HTMLElement, context)`**
   （`gugu-interaction-runtime/src/dom/VisualAdapter.ts:169`）——这里开始要求
   `HTMLElement`：`target.getBoundingClientRect()`、`target.isConnected` 判断、
   `concealElement(target, ...)`（落地时隐藏目标节点，任意坐标场景没有目标节点可藏）。
   这是第一处需要改造签名的位置。
3. **`Runtime.resolveMoveLandingTarget(sessionId, destination, fallback)`**
   （`gugu-interaction-runtime/src/Runtime.ts:896`）与
   **`ObjectTypeRegistration.resolveMoveLandingTarget(context)`**（`Runtime.ts:128`）
   ——返回类型都硬编码 `HTMLElement | null`。`waitForMoveTarget`
   （`Runtime.ts:940`）还依赖 `target.getBoundingClientRect()`、
   `surfaces.get(...).contains(target)` 等"目标是个已挂载 DOM 节点"的假设来判断
   跨 Surface 落地是否完成——任意坐标场景没有"目标 Surface"这个概念，这段跨帧等待
   逻辑对画布贴纸应该整体跳过，而不是复用。

结论：**只有第 2、3 层的契约类型需要扩展**，动画执行层（第 1 层）不用动。这比最初设想的
"需要一整套新落地语义"要窄——是类型层面的收窄（`HTMLElement` → `HTMLElement | LandingRect`
或等价的判别联合），不是新写一套动画。

### 验证 2：pan/zoom 是否影响命中判定

`gugu-interaction-runtime/src/dom/Hit.ts` 与 `LayoutMeasurement.ts` 的命中/量测全部基于
`element.getBoundingClientRect()`。`getBoundingClientRect()` 返回的是元素在视口坐标系下
**应用完所有祖先 CSS `transform`（包括画布 `.canvas-world` 的
`translate3d(camera.x, camera.y) scale(camera.scale)`）之后**的实际矩形——这是浏览器
标准行为，不是 Runtime 需要适配的地方。也就是说：

- 画布贴纸如果注册为 Runtime Object/Surface，`getBoundingClientRect()` 拿到的已经是
  pan/zoom 变换后的正确屏幕位置，**不需要 Runtime 感知 `camera` 状态，也不需要专门的
  坐标系适配层**。
- 唯一需要业务自己注意的是：`camera.scale` 影响的是"代理脱离 `.canvas-world` 祖先后跟手
  缩放要不要补偿"，这属于视觉细节（`usePhysicsDrag.ts` 现有 `contentScale` 参数已经在
  处理，见"复用清单"），不是命中判定问题。
- 这条此前没有实测验证，本次结论：**pan/zoom 对 Runtime 命中判定无影响，是本报告确认的
  "无遗漏项"之一，不需要新增适配。**

### 是否还有遗漏的硬缺口

逐项对照第 1、2 条已知结论之外的画布特性，未发现新的硬缺口：

- 连线跟手重算：纯业务渲染（见上文"关键支撑设施"），确认不需要 Runtime 介入。
- 抽屉双向拖拽：拖入抽屉=已解决的 `landingMode:'target'`；拖出抽屉回画布=复用"任意坐标"
  缺口的同一个方案，不是第三种缺口。
- `resolveAbsorbTarget`（画布项目卡吸入已打开的项目抽屉）：与"拖入抽屉"同构，也是
  `landingMode:'target'` 的手写版本，接入后可删除这段手写逻辑。
- 抓取代理的紧凑布局（`proxyLayout.compact`）：确认画布贴纸用不上（不是表格列布局），
  不纳入画布接入范围。

## 新增 API / 参数设计草案

本节只有"落地坐标模式"是本次画布迁移实际需要的新增能力，纳入下文实施阶段 1。多选装饰
卡片的草案放在文末"附录：多选（非本次范围）"，不在阶段 1-3 之内，不要误当成迁移的必做项。

### 落地坐标模式：`landingMode: 'coordinate'`

在现有 `'default' | 'target'` 基础上新增第三个值，与现有命名风格（动词化状态名）一致：

```ts
// Runtime.ts
export interface ObjectTypeRegistration {
  // ...
  /** landing 的终态表现：default 飞回对象原 DOM 位置；target 飞向语义目标节点后缩小
   *  淡出；coordinate 飞向业务给出的任意矩形（不要求对应真实 DOM 节点），用于自由画布类
   *  场景（贴纸松手落在指针对应的世界坐标）。*/
  landingMode?: 'default' | 'target' | 'coordinate'

  /** coordinate 模式下必须提供：解析业务落点矩形（视口坐标系，与 getBoundingClientRect
   *  同一坐标系）。返回 null 时退回 default 行为（飞回原位）。*/
  resolveMoveLandingRect?(context: {
    objectId: string
    destination: unknown
  }): LandingRect | null
}
```

`resolveMoveLandingTarget` 的返回类型改为判别联合，而不是新增一个完全平行的方法族，
避免 `Runtime.ts` 里 `resolveMoveTarget`/`resolveMoveLandingTarget`/
`resolveLandingTarget`/`waitForMoveTarget` 这一串已有方法各自再复制一份"坐标版"：

```ts
export type MoveLandingResolution =
  | { kind: 'element'; element: HTMLElement }
  | { kind: 'rect'; rect: LandingRect }

resolveMoveLandingTarget(
  sessionId: string,
  destination: unknown,
  fallback?: () => HTMLElement | null,
): MoveLandingResolution | null
```

调用方（`VisualAdapter.land`）按 `kind` 分支：`'element'` 走现有 `concealElement` +
`getBoundingClientRect()` 路径不变；`'rect'` 跳过 `concealElement`（没有目标节点可藏）、
跳过 `waitForMoveTarget` 的跨 Surface 等待（画布贴纸落地不存在"等待业务重渲染出目标节点"
这个阶段，坐标是拖拽过程中实时算出来的，落地那一刻就已经就绪），直接把 `rect` 传给
`landDragProxyWithMotion`——这条路径本来就已经支持纯 `LandingRect`，改动量最小。

`DefaultVisualAdapter.land()` 签名对应改为：

```ts
land(
  proxy: VisualProxy,
  target: HTMLElement | LandingRect,
  context: VisualLifecycleContext,
): Promise<{ completed: boolean; reason?: string }>
```

`LandingRect` 已经是 export 的公共类型（`Visual.ts:429`），不需要新增类型定义。

画布业务侧调用形状（对照 `setup.ts` 现有 `file-item`/`folder-item` 注册的写法）：

```ts
runtime.registerObjectType('canvas-sticker', {
  defaultVisualMode: 'detach',
  landingMode: 'coordinate',
  resolveMoveLandingRect: ({ destination }) => {
    // destination 携带指针世界坐标（业务在 createMove/drag 过程中写入）
    const { worldX, worldY, width, height } = destination as CanvasDropDestination
    const screen = worldToScreen(worldX, worldY) // MindCanvas.screenToWorld 的逆运算
    return { left: screen.x, top: screen.y, width, height }
  },
})
```

## Gugu-web 现有代码复用/重写清单

### 可原样复用

- `MindCanvas.vue` 的 `screenToWorld`/`camera`（x/y/scale）坐标数学——与拖拽引擎无关，
  已验证 `getBoundingClientRect()` 天然处理 pan/zoom，Runtime 接入后这套坐标换算原样保留。
- `RelationLayer.vue` 连线渲染逻辑——纯响应式渲染，只要业务在拖拽过程中继续提供"当前
  正在被拖动的位置"这份响应式数据（不关心数据源是旧引擎回调还是新 Runtime Action），
  这个组件不用改。
- 贴纸业务数据结构（`item.x/y/z`、`relations` 等）、`coastOffset()` 的惯性物理公式
  （`canvasDrag.ts`）——惯性甩动是纯数学，可以作为落点计算的前置步骤保留，只是落点算出来
  之后不再自己调用 `animateLanding()`，改成把算好的世界坐标转换成 `LandingRect` 交给
  Runtime 的 `landingMode:'coordinate'`。
- `resolveAbsorbTarget`/`resolveAbsorbLandingTarget` 背后的"命中语义容器就吸入"业务判断
  （命中检测逻辑本身，不是执行落地动画的那部分）——迁移后改为 Runtime 的
  `resolveMoveLandingTarget` + `landingMode:'target'`，判断"是否命中抽屉/项目抽屉"的
  业务规则可以原样保留，只是接入点从 `useCardDrag` 的回调换成 `createMove`/对象类型注册。

### 需要重写/迁移

- `useCardDrag`（`canvasDrag.ts`）——整个文件是 `startPhysicsDrag` 的适配层，接入 Runtime
  后应替换为 `runtime.objects.register('canvas-sticker', ...)` +
  `registerObjectType('canvas-sticker', { landingMode: 'coordinate', ... })` +
  `useObject`（画布贴纸场景下 `useObject` 的 `surface` 语义需要重新设计，画布不是"卡片
  归属某个列表容器"的模型，可能不需要真正的 Surface，只需要 Object + 自定义
  `createMove`）。
- `animateLanding()`（`canvasDrag.ts`）——手写的 cubic-bezier 落地插值，功能上被
  `landDragProxyWithMotion` 的 `retarget`/`onFrame` 回调取代；但"给 `RelationLayer` 喂
  落地过程中的插值位置"这个接口需要保留（Runtime 侧通过 `useRuntimeTransition` 或
  `onFrame` 回调等价物重新对接，具体桥接方式留待实现阶段设计）。
- `startThresholdDrag`/`startPhysicsDrag`（`usePhysicsDrag.ts`）画布这一侧的调用——
  Runtime 有自己的 `pointerInput`/`createMove` 入口，不复用旧引擎的阈值判定和物理弹簧，
  改用 Runtime `motion` 配置里的抓取/释放弹簧参数（`grabAlign`、`motion.profile`）重新
  调参以匹配现有手感（"贴纸中心跟手"等价于 `grabAlign: { align: 'center' }`，与看板卡的
  `offsetY: 12` 不同，需要单独配置）。
- 多选批量拖拽——当前画布未见多选实现痕迹（本次调研在 `Mind/` 下未找到多选选区代码），
  如果多选是后续要新增的功能而非现有能力迁移，应等 `extras` API 落地后按新功能设计，不
  算作"迁移"范畴。
- 抽屉拖出回画布（`drawer/` 组件方向的反向拖拽）——需要等 `landingMode:'coordinate'`
  落地后才能迁移，当前手写实现应保留到该 API 就绪。

## 实施阶段（勾选式 checklist）

参考 `docs/integration/VUE.md`"实施顺序"的写法，阶段之间存在依赖关系，建议按序执行：

### 阶段 0：准备

- [ ] 确认 `useTarget`/`TargetStore.update()` 在文件库/看板的生产验证已充分（当前已在用，
      仅需确认没有已知遗留 bug）
- [ ] 在 `gugu-interaction-runtime` 补 `LandingRect`/`MoveLandingResolution` 相关单测脚手架

### 阶段 1：Core 新增 `landingMode: 'coordinate'`

- [ ] `Runtime.ts`：`ObjectTypeRegistration.resolveMoveLandingRect` 新字段；
      `resolveMoveLandingTarget` 返回类型改判别联合（或新增 `resolveMoveLandingResolution`
      方法，视改造成本决定是否破坏现有签名）
- [ ] `VisualAdapter.ts`：`DefaultVisualAdapter.land()` 接受 `HTMLElement | LandingRect`，
      `'rect'` 分支跳过 `concealElement`/`waitForMoveTarget`
- [ ] `Visual.ts`：确认 `landDragProxyWithMotion` 现有 `LandingRect` 契约无需改动（本报告
      验证结论），仅补充单测覆盖"目标是纯 rect、无 Element"的路径
- [ ] Demo：在 `src/demo/` 补一个自由画布 Demo 场景验证新落地模式（对照 `FileSystemDemo.vue`
      的验收方式）
- [ ] Core 单测 + demo 视觉回归通过

### 阶段 2：Gugu-web 画布贴纸类型接入（单张贴纸，无多选、无抽屉）

- [ ] `setup.ts` 注册 `canvas-sticker` 对象类型（`landingMode: 'coordinate'`，
      `resolveMoveLandingRect` 桥接 `screenToWorld`/`camera`）
- [ ] 选一种贴纸（建议先做 `NoteSticker.vue`，样式最简单）接入 `useObject`，验证抓取/跟手/
      落地手感与旧引擎（`usePhysicsDrag`）对齐
- [ ] 验证 pan/zoom 期间抓取、缩放变化中松手的命中/落点正确性（对照"验证 2"的结论做实测，
      不能只依赖静态推理）
- [ ] `RelationLayer.vue` 接入新的"拖拽中/落地中位置"数据源，确认连线跟手无回归
- [ ] typecheck + 该页面已有的前端测试通过

### 阶段 3：其余贴纸类型 + 抽屉双向

- [ ] `EntitySticker.vue`/`ProjectRefCard.vue`/`FileRefCard.vue`/`ProjectDrawerCard.vue`
      逐个迁移
- [ ] 抽屉拖入（`landingMode:'target'`，复用文件夹吸入经验）+ 拖出回画布
      （`landingMode:'coordinate'`）双向验证
- [ ] `resolveAbsorbTarget`/`resolveAbsorbLandingTarget` 手写逻辑替换为
      `resolveMoveLandingTarget`，删除旧适配代码

### 阶段 4（不在本次迁移范围）：多选

画布当前没有多选功能，这不是迁移需要完成的阶段，只有产品明确排期"给画布加多选"时才
启动，具体设计见文末附录。此阶段编号仅为对照 VUE.md 的分阶段写法保留，不代表迁移
必须做到这一步。

### 阶段 5：收口

- [ ] 删除 `canvasDrag.ts`/画布方向对 `usePhysicsDrag.ts` 的依赖（看板/文件卡如果仍在用
      `usePhysicsDrag.ts` 的其它路径不受影响，只清理画布专属调用）
- [ ] 更新本文档状态标注为"已完成"，或视实施结果调整为下一版方案

## 风险与决策表

| 风险/决策点 | 影响 | 建议 |
|---|---|---|
| `resolveMoveLandingTarget` 返回类型改判别联合，是破坏性签名变更 | 影响所有已注册 `resolveMoveLandingTarget` 的现有类型（`file-item`/`folder-item`），需要同步改造调用点 | 优先评估新增平行方法（如 `resolveMoveLandingResolution`）而非改造现有签名，降低对已上线看板/文件的回归风险；具体取舍留到阶段 1 实现时按改造成本决定 |
| `waitForMoveTarget` 的跨 Surface 等待逻辑在坐标落地场景下语义空洞 | 若草率复用会引入无意义的多帧等待，拖慢落地动画首帧 | `'rect'` 分支应完全绕开 `waitForMoveTarget`，不能只是把它的条件判断改成恒真 |
| 画布贴纸目前没有"Surface"概念（不是列表容器归属模型） | `useObject` 的 `surface` 语义可能不适用，需要设计"无 Surface 的 Object"用法或明确画布世界本身作为唯一 Surface | 阶段 2 实现前需要先在 Core 或 Vue 适配层确认"Object 可以不归属任何 Surface"是否已支持，不确认清楚会卡住整个阶段 2 |
| 多选目前在画布代码中未见现有实现 | 阶段 4 可能是新功能而非迁移，工作量被低估的风险 | 排期前找产品/前端确认多选是否是当前迭代范围，不确定就先移出本轮迁移范围 |
| pan/zoom 命中判定结论基于代码阅读 + `getBoundingClientRect` 标准行为推断，未做浏览器实测 | 如果真实浏览器有边界情况（如极端缩放比例下的亚像素误差）会在阶段 2 才暴露 | 阶段 2 checklist 已包含专项实测项，不要跳过 |
| `extras` 装饰卡片方案让影子卡继承主代理的 transform，堆叠效果的像素级观感未验证 | 多选视觉效果可能需要多轮调参 | 阶段 4 单独排足够的视觉联调时间，不要和阶段 2/3 混排 |
| 落地动画层（`landDragProxyWithMotion`）虽已支持纯 rect，但 `retarget()`/dismiss 淡出等分支是否对"无目标节点"场景完全适用未逐行验证 | 可能存在依赖 `target` 是 Element 的隐藏假设未被本次代码阅读发现 | 阶段 1 的 Core 单测必须覆盖 retarget 中途发生（画布贴纸拖拽中相机继续 pan/zoom 导致落点矩形变化）的场景，不能只测静态落点 |

## 附录：多选装饰卡片草案（非本次范围）

> 本节**不属于**画布迁移的必做范围——本次调研确认画布当前没有多选/框选功能（`Mind/`
> 目录下无任何选区状态代码），迁移画布不需要这项能力。这里只是把"Runtime 缺少多对象
> 一起飘的能力"这个已知缺口的草案记录下来，供以后产品明确要给画布（或其它页面）加多选
> 时参考，不排入阶段 1-3，也不阻塞画布迁移本身。

给 `createDragProxy` 加一个纯视觉、不注册为 Object 的装饰参数：

```ts
// Visual.ts
export function createDragProxy(
  sourceElement: HTMLElement,
  sourceRect: DOMRect,
  options: {
    glass?: boolean
    layout?: DragProxyLayoutConfig
    /** 额外的装饰性影子卡片（纯视觉，跟随主代理一起被抓起/落地，不参与命中、不注册为
     *  Object、不产生独立 Session）。用于多选批量拖拽时在主卡片后方露出堆叠的影子卡，
     *  暗示"还有其它选中项一起被拖动"。数据层的批量移动仍由业务自己读当前选区处理，
     *  Runtime 不追踪这些影子卡的身份。*/
    extras?: HTMLElement[]
  } = {},
): HTMLElement
```

实现方向：`extras` 元素在 `createDragProxy` 内被 clone（同 `beforeContent` 的克隆方式）
并以递减的层叠偏移（如 `translate(-4px,-4px) scale(0.97)` 逐张叠加）插在主代理 DOM 结构
内主内容层之后（`z-index` 低于主内容），随主代理一起参与 `landDragProxyWithMotion` 的
`transform`/`scale` 插值（因为是同一个 DOM 子树，天然继承父级 transform，不需要各自独立
的运动状态）。松手落地时这些影子卡随主代理一起淡出/消失，不单独处理 landing。

这个方向目前**未实现**，本报告只确认草案与现有 `createDragProxy` 签名风格一致，具体像素
级堆叠效果仍需实现时联调；启动前应先由产品/前端确认多选是当前迭代范围，再排期。
