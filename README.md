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

当前稳定版本：2.0.2。Runtime 已在 Demo 和 Gugu-web 看板回归场景中接入 Session、移动事务、
landing/reveal、MotionController、Surface FLIP、regrab、语义目标和可选的 Collection Presence。
文件系统 Demo 还覆盖了多级目录、面包屑、文件夹目标及网格/列表视图。

业务端通过 Object/Surface/Target 注册和 `runtime.onAction()` 接入；默认视觉由 Runtime
处理，只有需要特殊视觉时才通过 VisualAdapter 覆盖。列表卡片可以通过
`registerObjectType().proxyLayout.compact` 声明抓取时的紧凑尺寸，尺寸过渡和 landing 恢复
由 Runtime 统一编排。

```
npm install
npm run dev       # 起 demo
npm run typecheck
```

发布库构建：

```bash
npm run build:lib
```
