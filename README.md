# Gugu Interaction Runtime

咕咕（Gugu-web）交互框架的独立 demo 仓库：把拖拽/布局联动这类交互过程从
Vue 的响应式更新循环中分离出来，验证一套独立的 Runtime 是否可行。

文档分两类：

- **给自己看的架构文档**：设计目标见 [docs/DESIGN.md](docs/DESIGN.md)，
  分层结构和执行计划见 [docs/PLAN.md](docs/PLAN.md)。
- **给使用者看的接入文档**：怎么把一个新对象接进这套 Runtime，见
  [docs/INTEGRATION.md](docs/INTEGRATION.md)；两套视觉策略（clone /
  detach）的能力对比见 [docs/VISUAL_STRATEGIES.md](docs/VISUAL_STRATEGIES.md)。

当前阶段：阶段 0.5（Core 与 `MoveBehavior` 执行层已完成），尚未接入
Gugu-web。Runtime 负责 Session、移动事务、landing/reveal 时机和清理；clone/
detach 的 proxy/本体视觉实现通过 driver 注入。下一步先在 demo 页面
顶部可以切换两种视觉策略实时对比。

```
npm install
npm run dev       # 起 demo
npm run typecheck
```
