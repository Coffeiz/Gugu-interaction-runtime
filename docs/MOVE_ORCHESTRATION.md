# Move Session 编排边界

本分支将 demo 中重复的移动事务编排收进 Runtime，同时保留业务与视觉策略边界。

## Runtime 现在负责

- `orchestrateMoveSession()`：统一绑定 Surface 接管范围、Move driver、landing/reveal lifecycle 和 pointer 输入。
- `PointerSessionInput`：安装 `pointermove` / `pointerup`，松手立即解绑，Session dispose 时幂等兜底。
- `MoveBehavior.resolveDestination()`：把输入解析出的落点保存进 `MoveContext.destination`。
- `MoveBehavior.commit()`：在 release 阶段统一提交已确认落点。
- `LandingTargetTracker`：landing 期间观察目标及祖先尺寸变化并调用 `retarget()`，自动接入 Session Cleanup。
- Runtime 在 reveal 后统一推进 `handoff` 并结束 Session。
- MoveContext 的 source DOM 与 drag offset 在 `start()` 返回前同步初始化；session driver 的 `prepare()` 仍可在绑定后执行。

## 策略层仍负责

- clone 的 proxy / placeholder 创建与视觉样式。
- detach 的 Teleport object lease、浮动本体和落地代理。
- 业务特定 HitResult 的形状转换。
- Layout FLIP 捕获范围与 Action 内容。
- Vue Store / API 如何应用 Runtime 输出的 Action。

Runtime 不认识 `columnId`、项目、文件或日历等业务字段。业务侧只注入：

```ts
runtime.orchestrateMoveSession(session.id, {
  surfaceIds,
  driver: {
    resolveDestination,
    commit,
    cancel,
  },
  lifecycle: {
    landing,
    reveal,
  },
})
```

## 后续可继续收口

- 将 clone / detach 整理成正式 `MoveVisualStrategy` 注册表。
- 把可提前释放的 object lease 建模为可转移的 ownership policy。
- 将 FLIP capture → Action → measure → play 收敛成 `LayoutTransaction`。
- 把 regrab 从 handler 登记表升级为 Runtime 内部 Session handoff transaction。
