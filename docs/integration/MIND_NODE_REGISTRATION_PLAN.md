# 画布节点注册与抽屉首次落地连接实施方案

> 状态：Phase 0 调查待开始。Phase 0 只收集运行时证据，不修改业务逻辑。

## 目标

确认“项目抽屉拖入画布后，第一次落地不能直接连接节点，必须再次拖动一次才可以”的根因，
并在不增加业务字段的前提下统一对象身份与节点能力边界。

## 当前约束

- 抽屉卡仍需要 `move` 能力，才能拖入画布。
- 只有画布中的对象应注册 `node.ports` 并参与连线。
- 业务侧不新增 `isNode`、`enableLink` 等字段；由已有 `surfaceId` 派生是否为画布对象。
- Runtime 负责端口坐标、命中和连接生命周期；业务侧负责连线绘制与关系持久化。

## Phase 0：首次落地连接失败调查（先做，不改代码）

### 调查假设

A. 抽屉卡或乐观画布卡的 `node.ports` 注册时机不完整；

B. 乐观插入使用 `clientKey` 生成的 object ID，但连接逻辑仍按 `nodeId` 拼接旧 ID；

C. 首次落地时 DOM 尚未挂载或 `ObjectStore.element` 尚未更新，导致端口读取为空；

D. 画布卡已经注册正确，但连接命中仍使用旧的节点模型坐标，未读取 Runtime 实时
`getNodePorts()`。

### 需要记录的证据

只允许使用临时 JSON 探针，禁止输出消息正文或真实用户信息：

1. 抽屉卡抓取前：`objectId`、`surfaceId`、是否存在 `node.ports`、`abilities`；
2. 画布乐观卡首次挂载后：`item.id`、`clientKey`、`nodeId`、Runtime 注册 object ID；
3. 首次连接开始前：连接逻辑生成的 object ID、`runtime.objects.get()` 是否存在、
   `getNodePorts()` 数量；
4. 第二次拖动前后重复同样记录，比较首次与第二次差异；
5. 记录 DOM 是否 connected、`getBoundingClientRect()` 是否为零尺寸。

### Phase 0 判定标准

- 若首次连接查询 ID 与实际注册 ID 不一致：判定为对象身份问题；
- 若 ID 一致但 `node.ports` 缺失：判定为节点能力注册问题；
- 若能力存在但 element 未挂载/尺寸为零：判定为首次落地生命周期时序问题；
- 若端口存在且尺寸正常但命中失败：判定为连接坐标或相机坐标转换问题。

Phase 0 完成后先更新本节调查结论，再进入实现阶段；在根因确认前不修改 `MindCanvas`
或 `useMindRuntimeObject`。

## Phase 1：统一节点能力边界

在 `useMindRuntimeObject()` 内部根据已有 `surfaceId` 派生能力：

- 画布 Surface：保留 `move`，注册 `node.ports`；
- 项目抽屉 Surface：保留 `move`，不注册 `node`；
- 其他 Mind Surface：默认只保留现有移动能力，不自动注册节点。

不新增业务数据字段，不改变已有组件调用参数。

## Phase 2：统一画布 object ID

- 所有连接开始、命中和完成逻辑统一调用 `mindCanvasObjectId(item)`；
- 禁止在 `MindCanvas.vue` 中手写 `mind:${nodeId}`；
- 乐观插入使用 `clientKey` 时，连接逻辑必须继续使用同一稳定 ID；
- 服务端落库替换数据时保留 `clientKey`，直到当前交互生命周期结束。

## Phase 3：回归测试与验收

- 抽屉对象没有 `node.ports`，但仍可以拖入画布；
- 画布对象拥有左右端口；
- 抽屉拖入画布后第一次落地即可连接，不需要二次拖动；
- 乐观对象替换为服务端对象后连接仍可用；
- 普通画布节点、文件引用、便签和已有连接去重逻辑不回归。

## 相关文件

- Runtime：`src/node/Node.ts`、`src/object/ObjectItem.ts`、`src/Runtime.ts`
- Gugu：`frontend/src/views/Mind/composables/useMindRuntimeObject.ts`
- Gugu：`frontend/src/views/Mind/components/MindCanvas.vue`
- Gugu：`frontend/src/views/Mind/components/ProjectDrawerCard.vue`
- Gugu：`frontend/src/interaction/runtime/canvas.ts`

