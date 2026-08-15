# Landing handoff continuity：去掉位置冻结，统一 transform ownership

## 背景

此前画布卡片在 `pointerup` 后进入 landing 时，偶发出现首帧向前/向后跳几像素。2026-08-14 的修复通过读取浏览器当前已经呈现的 rect，并把 `motionState.x/y` 改写为该位置，再从这个“冻结位置”启动 landing。

这个方案能掩盖首帧跳跃，但不是根因修复：位置来自浏览器滞后的 CSS transition 中间帧，速度/旋转仍来自 MotionController 当前帧，组合出来的 handoff state 并不是同一时刻的物理状态，因此快速释放时仍可能出现短暂后退或速度方向与位置不匹配。

## 根因

真正的问题在 grabbing 阶段的 transform ownership。

- `createDragProxy()` / `applyFloatingStyle()` 会给 floating proxy 的根节点设置 `transform` transition，用于 pickup 的视觉过渡。
- grabbing 开始后，`MoveAdapter` 的 MotionController 又会每帧直接写同一个 floating proxy 的 `transform`。
- `MoveAdapter` 原本有“MotionController 驱动期间关闭 transition”的意图，但实际执行的是 `element.style.transition = 'none'`，这里的 `element` 是业务 source 节点；真正运动的 `floatingProxy` 仍保留 Runtime 自己设置的 transform transition。

结果是同一个位置 transform 同时被两个动画系统控制：MotionController 产生逻辑/物理帧，浏览器 CSS transition 再对这些帧做第二次插值。于是 `motionState.x/y` 已经前进到最新控制器状态，而屏幕上的 rendered pose 仍落后几十毫秒。

## 修复原则

1. floating proxy 一旦交给 drag motion driver，根节点的定位 transform 由 motion driver 独占；立即清除根节点 `transition`。
2. `pointerup` 时保留 MotionController 的同一份 `(x, y, vx, vy, scale, rotation)` 状态。
3. landing 不再读取 computed transform / rendered rect 来重采样或冻结位置，直接 seed grabbing controller 的最后状态。
4. pickup 的内容层动画、阴影、紧凑布局等视觉 transition 保持独立，不影响定位 transform ownership。

这样 grabbing → landing 的连续性由同一个运动状态保证，而不是通过 DOM readback 修补两个动画系统之间的偏差。

## Gugu-web 核对

Gugu-web `dev` 的画布对象使用 `releaseMode: 'physical'` 和 `motion.enabled: true`。业务侧的 free landing resolver 只根据释放点和 `releaseVelocity` 计算最终 coast 落点，不会在 `pointerup` 后重写 grabbing proxy 的当前位置。

因此这次问题属于 Runtime 内部的 transform ownership / handoff 问题，不需要 Gugu-web 侧增加位置补丁。

## 回归重点

- grabbing proxy 进入 motion ownership 后 `style.transition === 'none'`。
- landing 收到的 `motionState.x/y/vx/vy` 与 grabbing controller 的释放状态一致，不再用滞后的 rendered rect 改写 `x/y`。
- 画布快速甩动、低速拖动、缩放相机、同 Surface free landing、跨 Surface landing 和 regrab 均应继续检查视觉连续性。
