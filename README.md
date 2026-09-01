<div align="center">

<img src="./docs/assets/Gugu-logo-colored.png" width="128" alt="Gugu Logo">

# Gugu Interaction Runtime

<p><a href="./README_en.md">English</a></p>

<p>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-2ea44f.svg" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/Runtime-3.0.3-6f42c1.svg" alt="Runtime 3.0.3">
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178c6.svg" alt="TypeScript">
  <img src="https://img.shields.io/badge/Vue-3.x-42b883.svg" alt="Vue 3">
</p>

<p>
  <a href="./docs/API.md">API 参考</a> ·
  <a href="./docs/INTEGRATION.md">接入指南</a> ·
  <a href="./docs/integration/VUE.md">Vue 接入</a> ·
  <a href="./docs/DESIGN.md">设计说明</a>
</p>

<p><em>面向看板、文件管理器和画布的框架无关交互 Runtime。</em></p>

<p>把拖拽、布局联动、落地交接和节点连接交给 Runtime，让业务代码只需要声明对象与区域，并接收语义化 Action。</p>

<p>这是一个 Vibe Coding 项目，欢迎通过 Issue 或 Pull Request 反馈问题、提出建议和贡献改进。</p>

</div>

## 使用案例

<table>
  <tr>
    <td width="50%" valign="top">
      <img src="./docs/assets/kanban-drag-1.gif" width="100%" alt="看板跨列拖拽示例">
      <h3>看板</h3>
      <p>跨列移动、同列排序、分组布局与 FLIP 动画。适合项目看板、任务流和状态列。</p>
    </td>
    <td width="50%" valign="top">
      <img src="./docs/assets/file-drag-1.gif" width="100%" alt="文件库拖拽示例">
      <h3>文件库</h3>
      <p>文件夹目标、面包屑、多选移动与网格/列表布局。适合文件树和资源管理器。</p>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <img src="./docs/assets/canvas-drag-1.gif" width="100%" alt="画布自由落点拖拽示例">
      <h3>画布自由落点</h3>
      <p>支持画布缩放和自由坐标落地，适合白板、流程图和自由布局编辑器。</p>
    </td>
    <td width="50%" valign="top">
      <img src="./docs/assets/canvas-drag-2.gif" width="100%" alt="画布与抽屉跨容器拖拽示例">
      <h3>画布跨容器拖拽</h3>
      <p>支持画布与浮动抽屉之间的对象移动，并保持代理、落地和布局交接连续。</p>
    </td>
  </tr>
</table>

## 核心能力

| 场景 | 能力 |
| --- | --- |
| 看板 | 跨列移动、同列排序、分组展开/收起、Relative FLIP |
| 文件库 | 文件夹和面包屑目标、多选拖拽、网格/列表布局 |
| 画布 | 自由坐标落地、相机缩放、浮动 Surface、节点端口连接 |
| 通用 | proxy、landing、regrab、Action、MotionController、VisualAdapter |
| 框架 | 框架无关 Core、Vue composable、Vue/React DOM adapter |

## 安装

```bash
npm install gugu-interaction-runtime
```

Runtime 不捆绑 Vue 或 React。使用 Vue 入口时，需要在应用中安装 Vue 3；React 和其他
框架可以直接使用 Core API 或 DOM adapter。

## 30 秒接入

Runtime 的基本接入只有三步：注册对象、注册所在区域、监听 Action。

```ts
import { runtime } from 'gugu-interaction-runtime'

runtime.registerObjectType('project-card', {
  defaultVisualMode: 'detach',
})

runtime.objects.register({
  id: 'project:123',
  type: 'project-card',
  surfaceId: 'column:active',
  element: cardElement,
  abilities: ['move', 'sort'],
})

runtime.surfaces.register({
  id: 'column:active',
  type: 'project-column',
  element: columnElement,
  accepts: ['project-card'],
  layout: 'grid',
})

const stop = runtime.onAction(action => {
  if (action.type === 'move' || action.type === 'sort') {
    projectStore.applyInteraction(action)
  }
})
```

业务层负责保存 Action 和更新 Store；Runtime 负责命中、代理、跟手、landing、FLIP、
regrab 和清理。

## 基本概念

```text
Object     可被抓取、排序、移动或连接的对象
Surface    对象所在的列表、文件夹、画布或其他布局区域
Target     没有 Object 身份、但可以接收落点的语义目标
Session    一次交互的生命周期
Action     Runtime 输出给业务 Store 的交互结果
```

Runtime 不持有项目、文件、权限或后端 API，只提供交互执行和视觉生命周期。

## Vue 接入

Vue 项目推荐使用独立入口。composable 会处理 DOM ref、响应式字段更新、组件卸载和
generation 保护：

```ts
// main.ts：在应用级注入 Runtime 实例
import { createApp } from 'vue'
import { runtime } from 'gugu-interaction-runtime'
import { runtimeInjectionKey } from 'gugu-interaction-runtime/vue'
import App from './App.vue'

createApp(App).provide(runtimeInjectionKey, runtime).mount('#app')
```

```ts
// 业务组件：只声明对象、区域和 Action
import {
  useObject,
  useSurface,
  useTarget,
  useRuntimeAction,
} from 'gugu-interaction-runtime/vue'

const { elementRef } = useObject({
  id: 'project:123',
  type: 'project-card',
  surface: 'column:active',
  abilities: ['move', 'sort'],
})

useRuntimeAction(action => projectStore.applyInteraction(action))
```

> `provideRuntime(runtime)` 注入的实例只对**子组件**可见。在同一个组件里先调用
> `provideRuntime()` 再调用 `useObject()` / `useRuntimeAction()` 会抛出
> `Vue Runtime provider is missing; call provideRuntime(runtime) in a parent component`。
> 请把注入放在父组件，或者按上面的写法在 app 级注入。

模板中将 `elementRef` 绑定到真实对象节点即可。浮动抽屉等复杂区域可以使用：

```ts
useSurface({
  id: 'project:drawer',
  type: 'project-drawer',
  accepts: ['project-card'],
  layout: 'grid',
  floating: true,
})
```

## React 与原生 DOM

React 或其他框架可以使用相同的 Core 注册表，也可以用 DOM adapter 管理 callback ref：

```ts
import { createReactRuntimeAdapter, runtime } from 'gugu-interaction-runtime'

const dom = createReactRuntimeAdapter(runtime)
dom.bindObject('project:123', cardElement)
dom.bindSurface('column:active', columnElement)
```

adapter 只负责 DOM 生命周期和布局 mutation，不注册业务语义，也不提交 Action。

## 常见使用场景

### Kanban 看板

注册 `project-card` Object 和 `project-column` Surface，使用 `grid` 布局。Runtime 会
输出 `move`、`move-group` 或 `sort` Action，业务只需将结果映射到项目 Store。

### 文件库

文件夹卡可以同时注册为 Object 和 Target；没有 Object 身份的面包屑单独注册 Target。
Runtime 不需要理解 `fileId` 或 `folderId`，文件权限、移动 API 和失败回滚由业务负责。

### 画布

画布使用 `layout: 'free'`，通过 `Surface.camera` 提供缩放和原点，通过
`resolveFreeLandingRect` 提供自由落点。节点连接使用 Object 上的 `node.ports`，
Runtime 负责端口几何、命中、去重和连接生命周期，业务负责关系数据和绘制。

### 多选拖拽

给 Object 设置 `selected` 后，抓取已选主对象会自动创建 Group Session，并输出
`move-group` Action。叠牌视觉由 Runtime 默认提供，也可以用 `groupVisual` 覆盖。

## 视觉与运动定制

默认使用 `detach` 视觉策略和内置 MotionController。常用配置包括：

```ts
runtime.registerObjectType('file-item', {
  defaultVisualMode: 'detach',
  grabAlign: { align: 'pointer' },
  releaseMode: 'physical',
  proxyLayout: {
    compact: {
      selector: '[data-view="list"]',
      width: 'min(320px, calc(100vw - 48px))',
    },
  },
})

runtime.configureMotion({
  flip: { duration: 220, easing: 'cubic-bezier(.22,1,.36,1)' },
  resize: { duration: 220, easing: 'cubic-bezier(.22,1,.36,1)' },
  landing: { duration: 220, easing: 'cubic-bezier(.22,1,.36,1)' },
  group: { duration: 220, easing: 'cubic-bezier(.22,1,.36,1)' },
})
```

需要特殊代理或状态样式时，实现 `VisualAdapter`；业务负责颜色、阴影、圆角和内容
结构，Runtime 负责 proxy 与真实节点之间的状态交接。

## Action 类型

Runtime 通过 `runtime.onAction()` 输出业务可消费的联合类型：

| Action | 用途 |
| --- | --- |
| `move` | 单个对象移动到另一个 Surface |
| `move-group` | 多个对象一起移动 |
| `transfer` | 不携带排序位置的区域转移 |
| `sort` | 同一 Surface 内调整顺序 |
| `connection-create` | 创建两个 Node 端口之间的连接 |
| `connection-delete` | 删除已登记连接 |
| `connection-cancel` | 取消连接操作 |

## 设计边界

- Runtime 不修改业务 Store，也不负责后端 API、权限和失败回滚。
- 业务不应与 Runtime 同时控制同一节点的 `transform`、`height` 或 `transition`。
- 代理由 Runtime 统一创建和清理，业务不应重复监听 pointer 或创建第二个代理。
- 跨列表移动后真实对象可能是新 DOM 节点，节点本地状态应保存在业务数据中。
- 不要从 `src/` 深层路径导入；使用包根入口或 `/vue` 子入口。

## 文档

- [Core API 参考](docs/API.md)
- [接入指南](docs/INTEGRATION.md)
- [Vue 接入指南](docs/integration/VUE.md)
- [视觉策略参考](docs/VISUAL_STRATEGIES.md)
- [设计目标](docs/DESIGN.md)

## 本地开发与验证

```bash
npm install
npm run dev
npm run typecheck
npm test
npm run build:lib
```

## 许可证

[MIT](LICENSE)

## 联系方式

- Email：`coffeiz216@gmail.com`
- QQ：`1005757597`
