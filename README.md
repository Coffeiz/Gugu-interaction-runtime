# Gugu Interaction Runtime

咕咕（Gugu-web）交互框架的独立 demo 仓库：把拖拽/布局联动这类交互过程从
Vue 的响应式更新循环中分离出来，验证一套独立的 Runtime 是否可行。

设计目标见 [docs/DESIGN.md](docs/DESIGN.md)，分层结构和执行计划见
[docs/PLAN.md](docs/PLAN.md)，两套视觉策略（clone / detach）的能力对比和
接入方式见 [docs/VISUAL_STRATEGIES.md](docs/VISUAL_STRATEGIES.md)。

当前阶段：阶段 0（本仓库内最小骨架 demo），尚未接入 Gugu-web。demo 页面
顶部可以切换两种视觉策略实时对比。

```
npm install
npm run dev       # 起 demo
npm run typecheck
```
