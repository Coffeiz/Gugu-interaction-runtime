# Visual State & Transform Composition Design

## 背景

当前 Runtime 已经解决了 Session 生命周期、移动事务、proxy/source 切换等问题，但卡片视觉连续性仍存在一个核心问题：

> 用户看到的是同一张卡片，但实现上却可能经历 source → proxy → source 的 DOM 宿主切换。

如果视觉状态绑定在 DOM 上，会出现：

- hover 状态在 proxy 和 source 之间丢失
- hover transition 未结束时切换本体导致跳变
- drag / landing / hover / FLIP 多个 transform 来源互相覆盖
- 不同阶段由不同 DOM 控制视觉，导致卡片“不像同一个对象”

因此后续视觉系统需要让状态脱离 DOM。

---

## 目标

实现一个连续的 Card Visual 生命周期：

```
Pointer Down
    ↓
Dragging
    ↓
Landing
    ↓
Reveal
    ↓
Interactive
```

用户感知：

> 卡片一直是同一个视觉对象，只是渲染宿主发生变化。

---

## 核心原则

### 1. Visual State 属于对象，不属于 DOM

不要依赖：

```css
.card:hover
```

作为唯一状态来源。

应该由 Runtime 管理：

```ts
interface CardVisualState {
  hovered: boolean
  hoverProgress: number
  dragging: boolean
  landing: boolean
  scale: number
  rotate: number
}
```

proxy 和 source 共享同一个 Visual State。

---

### 2. Motion 与 Visual 分离

MotionController 负责空间运动：

- x/y
- velocity
- spring
- landing path
- FLIP 位移

不负责：

- hover
- shadow
- scale
- tilt

---

### 3. TransformCompositor 统一合成视觉变换

禁止多个模块直接写：

```ts
element.style.transform = ...
```

所有 transform 来源进入 compositor：

```
hover channel
      +
 drag channel
      +
 landing channel
      +
 effect channel
      ↓
TransformCompositor
      ↓
最终 transform
```

例如：

```ts
{
  hover: translateY(-2px),
  drag: scale(1.03),
  landing: rotate(3deg)
}
```

最终生成：

```css
transform:
 translate3d(...)
 rotate(3deg)
 scale(1.03)
 translateY(-2px)
```

---

## 注意事项

### 不要让 proxy 和 source 各自维护动画状态

错误：

```
proxy:
 hover=true
 landing=true

source:
 hover=false
```

正确：

```
CardVisualState
        |
   +----+----+
   |         |
 proxy    source
```

---

### hover 必须支持进度转移

不能简单切换：

```
hover=true
 ↓
hover=false
```

因为 transition 可能还在播放。

需要保存连续值：

```
hoverProgress: 0 ~ 1
```

例如：

```
鼠标离开

hoverProgress:
1.0
 ↓
0.7
 ↓
0

中途 proxy → source

source 继续从 0.7 渲染
```

---

## 渐进实施方案

### Phase 1: 状态抽象

目标：不改变现有 MotionController。

新增：

- CardVisualState
- VisualStateStore
- hover progress 管理

验收：

- proxy/source 可以共享 hover 状态
- 切换宿主无跳变

---

### Phase 2: TransformCompositor

目标：统一 transform 来源。

迁移：

- hover transform
- drag scale
- landing rotate
- effect transform

验收：

- 多个视觉效果同时存在
- 不再出现 transform 覆盖

---

### Phase 3: Runtime 集成

目标：让 Runtime 管理完整视觉生命周期。

验收：

- 拖起 → 落地 → hover 全程连续
- regrab 不丢失视觉状态
- source/proxy 对用户不可感知

---

## 非目标

当前阶段不追求：

- 所有 DOM 都由 Runtime 渲染
- 替换 MotionController
- 通用动画引擎

只解决卡片视觉连续性问题。
