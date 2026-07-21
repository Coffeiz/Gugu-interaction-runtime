# Visual Migration Execution Plan

## 当前基础

Runtime 已具备：

- Runtime / Session 生命周期
- Owner / Lease 控制
- MoveBehavior
- VisualAdapter
- Motion 执行层
- Cleanup

当前问题集中在视觉层：

- 多处 transform 写入
- source/proxy 状态分离
- hover 与 landing 动画冲突
- handoff 时视觉状态重新计算

---

# Phase 1: 建立 Visual State

目标：让卡片视觉状态脱离 DOM。

新增：

```
VisualState
VisualRuntime
```

保存：

- hoverProgress
- scale
- shadow
- elevation
- rotate

验收：

- proxy 创建后不保存独立视觉状态
- source/proxy 可以共享状态

---

# Phase 2: TransformCompositor

目标：统一 transform 来源。

新增：

```
TransformCompositor
```

Channel:

```
motion
hover
effect
landing
```

流程：

```
MotionController
       |
       v
 MotionFrame
       |
       v
TransformCompositor
       |
       v
DOM transform
```

验收：

- 全仓库只有 compositor 写 transform
- hover 不覆盖 landing
- FLIP 不覆盖拖拽

---

# Phase 3: Handoff 重构

目标：消除 source/proxy 切换。

旧：

```
proxy
 |
切换
 |
source
```

新：

```
VisualState
    |
    +-- proxy
    +-- source
```

handoff：

1. 保存当前视觉 frame
2. 创建 source 显示
3. source 继承 frame
4. 删除 proxy

验收：

- 用户感觉不到 DOM 切换
- hover transition 不重新开始

---

# Phase 4: MotionController 接管边界

保持：

MotionController:

- 位置
- 速度
- 弹簧
- landing

Visual:

- 状态
- transform 合成
- 表现层

禁止：

MotionController 修改视觉状态。

---

# 回归测试

## 基础

- 抓起卡片
- 移动
- 松手
- reveal

## Hover

测试：

1. hover卡片
2. 拖起
3. 落地保持hover

预期：

视觉连续。

---

## 边界情况

### 落地时移开鼠标

旧问题：

```
proxy hover取消动画
        |
        v
source重新判断hover
        |
        v
跳变
```

新要求：

```
VisualState继续过渡
```

---

### regrab

要求：

- 不创建第二套视觉状态
- 不重置transform
- 不丢失hoverProgress

---

# 完成标准

满足以下条件才替换旧视觉系统：

- [ ] transform 单入口
- [ ] source/proxy共享VisualState
- [ ] hover状态连续
- [ ] landing期间重新抓取无闪烁
- [ ] MotionController无需知道hover存在
- [ ] demo与业务层无需操作transform

