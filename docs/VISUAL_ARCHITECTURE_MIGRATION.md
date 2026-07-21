# Visual Architecture Migration

## 目标

解决当前拖拽卡片在 source / proxy / target 之间切换时视觉状态断裂的问题。

核心目标：

> 用户看到的是同一张卡片持续运动，而不是多个 DOM 对象接力。

要求：

- 抓起 → 跟手 → 落地 → reveal 全程保持视觉连续
- hover、scale、shadow、rotation 等效果不能被不同动画系统覆盖
- Motion 负责运动，Visual 负责状态合成
- Vue DOM 只负责业务渲染

---

# 当前架构（旧）

```
Pointer
  |
  v
Runtime Session
  |
  +----------------+
  |                |
MotionController  Visual Driver
  |                |
translate         proxy/source切换
  |                |
  v                v
DOM transform     DOM transform

CSS hover
  |
  v
DOM transform
```

问题：

1. 多个地方直接写 transform

```
MotionController
createDragProxy
applyFloatingStyle
CSS :hover
FLIP
```

互相覆盖。

2. source/proxy 是不同 DOM

```
source
  ↓ handoff
proxy
```

切换瞬间重新计算：

- hover 状态
- transition 状态
- transform 状态

导致跳变。

---

# 新架构

```
                    Runtime
                       |
              Interaction Session
                       |
        +--------------+--------------+
        |                             |
 MotionController              VisualRuntime
        |                             |
 movement frame              visual state
        |                             |
        +--------------+--------------+
                       |
              TransformCompositor
                       |
              final transform
                       |
                       v
                    DOM
```

---

# 新文件结构

```
src/
├── motion/
│   ├── MotionController.ts
│   ├── Spring.ts
│   └── Frame.ts
│
├── visual/
│   ├── VisualState.ts
│   ├── VisualRuntime.ts
│   ├── TransformCompositor.ts
│   └── HoverController.ts
│
├── render/
│   └── Render.ts
│
└── behavior/
    └── MoveBehavior.ts
```

---

# 职责变化

## MotionController

负责：

- 拖拽跟手
- landing 动画
- spring
- inertia

不负责：

- hover
- shadow
- scale状态

输出：

```
MotionFrame
{
 x,
 y,
 scale,
 rotate
}
```

---

## VisualRuntime

负责：

```
VisualState
{
 hoverProgress,
 dragProgress,
 elevation,
 shadow,
 scale,
}
```

source/proxy共享同一个状态。

---

## TransformCompositor

唯一 transform 写入口。

输入：

```
Motion channel
Hover channel
Effect channel
Landing channel
```

输出：

```
transform: matrix(...)
```

禁止：

任何模块直接修改 style.transform。

---

# 关键注意事项

## 1. hover 不是 boolean

错误：

```
hover=true
hover=false
切换DOM
```

正确：

```
hoverProgress

1.0
 ↓
0.7
 ↓
handoff
 ↓
0
```

handoff 时继承当前动画状态。

---

## 2. source/proxy 不应该拥有状态

旧：

```
proxy hover
source hover
```

新：

```
CardVisualState
        |
        +---- proxy
        +---- source
```

---

## 3. Transform 单写入口

禁止：

```ts
el.style.transform = xxx
```

统一：

```ts
compositor.setChannel('motion', frame)
```

---

# 迁移原则

渐进替换：

旧：

```
MotionController
 + CSS hover
 + proxy transform
```

新：

```
MotionController
 + VisualRuntime
 + TransformCompositor
```

不一次重写 Runtime。
