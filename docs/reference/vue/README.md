# Vue 旧适配层参考基线

这里保存提交 `f4ea296` 的父提交中曾经工作的 Vue API 代码，仅用于设计兼容性对照，**不参与
构建、不作为 npm 导出，也不是当前推荐入口**。

对应设计说明见 [Vue 接入指南](../../integration/VUE.md)。

保留原因：后续实现 `useObject`、`useSurface`、`useTarget` 和
`useRuntimeTransition` 时，可以逐项确认旧 API 的可用形状与行为，不会把历史约定
误当成不存在。

其中 `useObject` 的 generation 和旧节点解绑保护是必须保留的行为基线；`useTarget`
没有历史实现，必须等 TargetStore 补齐 generation 与增量 update 后单独设计。
