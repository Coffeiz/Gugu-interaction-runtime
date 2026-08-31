# 视觉策略参考

本文补充 [Core API 参考](./API.md) 中的视觉部分，说明 `detach`、代理和本体交接的
职责边界。它是接入约束，不是另一套 API。

## 策略选择

当前稳定接入默认使用 `detach`：抓取时由 Runtime 创建页面级 proxy，真实对象继续由
业务 DOM 渲染；移动、落地、揭示和取消完成后，Runtime 再把控制权交还给业务节点。

```ts
runtime.registerObjectType('project-card', {
  defaultVisualMode: 'detach',
})
```

业务不应依赖 clone/detach 的内部 DOM 结构，也不应自行创建第二个 proxy。特殊卡片只需
通过 `VisualAdapter` 覆盖需要定制的视觉生命周期，其余行为继续使用默认适配器。

## 生命周期

```text
idle → pressed → dragging → landing → revealing → idle
```

- `dragging`：Runtime 控制 proxy 的位置、运动状态和受影响的布局范围。
- `landing`：Runtime 解析目标节点或 `LandingRect`，处理目标可见性和落地运动。
- `revealing`：业务 Store 已提交结果后，Runtime 对齐真实节点、清理 proxy，再恢复 Vue 控制。
- `cancel` / `interrupt`：从当前视觉帧清理并回到真实节点，不把业务数据写回 Store。

代理直接挂到 `document.documentElement`，以避开 Surface、应用壳和分组的裁剪。业务
样式仍负责颜色、阴影、圆角、内容布局和状态 class；Runtime 只负责状态时序和资源清理。

## 跨容器限制

`detach` 跨 `v-for` 列表移动时，落地前后的真实对象通常不是同一个 DOM 节点。对象的
展开状态、视频播放状态或其他节点本地状态不能依赖旧引用，应在业务数据中保存，并在
新节点挂载后恢复。Runtime 会根据 ObjectStore 中当前注册的 element 重新解析目标。

## 适配器边界

```ts
runtime.registerObjectType('custom-card', {
  defaultVisualMode: 'detach',
  visual: {
    captureVisualState(element) {
      return { /* 返回 VisualSnapshot */ }
    },
    applyState(element, state) {
      element.dataset.phase = state.phase
    },
  },
})
```

适配器可以提供 source/target 解析、快照、proxy 创建与更新、landing、reveal 和 dispose。
它不拥有 Session，不提交 Action，也不能绕过 Runtime 直接修改同一节点的
`transform`、`height` 或 `transition`。

## 检查清单

- Object 注册包含稳定 `id`、正确 `surfaceId` 和 `move` 能力。
- 真实 DOM 通过 ObjectStore 或 Vue/React adapter 绑定，而不是依赖业务选择器猜测。
- 业务只消费 `runtime.onAction()` 的结果并负责保存、失败处理和回滚。
- 自定义适配器没有重复监听 pointer、创建第二个代理或自行决定清理时机。
- 跨 Surface 的目标节点在 Action 后重新挂载，并在 reveal 前完成注册。
