# Gugu Interaction Runtime

咕咕（Gugu-web）交互框架的独立 demo 仓库：把拖拽/布局联动这类交互过程从
Vue 的响应式更新循环中分离出来，验证一套独立的 Runtime 是否可行。

文档分两类：

- **给自己看的架构文档**：设计目标见 [docs/DESIGN.md](docs/DESIGN.md)，
  分层结构和执行计划见 [docs/PLAN.md](docs/PLAN.md)。
- **给使用者看的接入文档**：怎么把一个新对象接进这套 Runtime，见
  [docs/INTEGRATION.md](docs/INTEGRATION.md)；当前 Demo 默认使用 detach 策略。
- **视觉连续性设计**：proxy/source 切换、Visual State 和运动交接原则见
  [docs/DESIGN.md](docs/DESIGN.md)。

当前稳定版本：1.0.1。Runtime 已在 demo 和 Gugu-web 看板回归场景中接入 Session、移动事务、
landing/reveal、MotionController、Surface FLIP，以及可选的 Collection Presence。
业务端通过对象/Surface 注册和 `runtime.onAction()` 接入；默认视觉由 Runtime 处理，
只有需要特殊视觉时才通过 adapter/driver 覆盖。

```
npm install
npm run dev       # 起 demo
npm run typecheck
```
