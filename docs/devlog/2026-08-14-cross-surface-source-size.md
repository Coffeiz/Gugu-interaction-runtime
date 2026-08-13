# 跨 Surface 落地尺寸回退

## 现象

画布缩放后，从项目抽屉拖出的卡片松手时，landing 代理会落在鼠标上方。Runtime 的代理中心与 target 中心一致，但 target 本身比释放点高出一段距离。

## 根因

抽屉卡片的移动 Action 在源节点已经被 Runtime 隐藏后才触发业务插入。业务侧再次读取源节点 `getBoundingClientRect()` 得到 0，于是回退到固定的 `240x120`。实际抽屉卡片高度约为 `98px`，乐观插入的画布 target 因此按错误高度计算顶部位置，中心向上偏移。

## 修复

Runtime 在移动准备阶段捕获源元素的 CSS 尺寸，并通过 `MoveAction.sourceSize` 透传。抽屉接入使用该快照计算乐观画布对象位置，不再读取已隐藏的源 DOM，也不改变 Runtime 对 landing target 的几何对齐职责。

## 回归约束

`moveActionSurfaceId.test.ts` 覆盖跨 Surface Action 必须保留源尺寸，防止未来重新在业务侧读取隐藏节点或丢失尺寸元数据。
