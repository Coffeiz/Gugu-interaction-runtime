# Landing 交接首帧跳跃排查记录

日期：2026-08-14

## 问题现象

画布卡片松手后进入 landing 时，代理会在第一帧向前或向后跳一段距离。目标落点本身是正确的，动画后半段也能回到目标位置；问题只发生在抓取态交给 landing 的瞬间。跨 Surface、画布缩放以及较快拖动时更容易观察到。

## 排查过程

1. 对比咕咕 main 的旧实现。旧实现把视觉代理拆成 holder、attitude、scaleShell、content 四层：holder 负责位置和尺寸，attitude 负责透视与旋转，scaleShell 负责摄像机倍率，content 负责卡片排布。
2. 早期尝试把位移差值作为补偿写进 landing 目标。这个方法能掩盖部分首帧跳跃，但会让代理先瞄准错误位置，再在接近目标时修正，因此撤回。
3. 增加交接链路探针，记录 `pointerup`、`before-runtime-land`、`adapter-entry`、transition reset、landing 首帧的矩形和 transform。
4. 对照 Performance Trace 检查 `proceedWithTarget → startDetachLandingVisual → land`。同步 `getBoundingClientRect()` 只占约 0.1ms，调用链没有足够长的同步任务可以解释这次跳跃；“部分呈现帧”是结果，不是根因。

## 根因

抓取代理在松手时仍带有 `transform` 过渡。此时有两套坐标同时存在：

- `motionState.x/y` 是跟手控制器最后写入的定位层终值。
- 浏览器当前屏幕已经绘制出来的矩形，仍停留在 transform transition 的中间帧。

一次实际记录中，motion 的 `x` 为约 `1127px`，而当前代理矩形左边约为 `1097px`，差值约 `30px`。landing 首帧直接使用 motion 终值，覆盖了浏览器当前正在显示的中间帧，于是出现跳跃。

这不是布局测量阻塞，也不是目标矩形补偿错误，更不是摄像机把目标位置改掉。根因是生命周期交接时使用了错误的“当前位置来源”。

## 修复

### 视觉分层

恢复旧实现的职责边界：

- proxy：定位和落地尺寸变化
- attitude layer：`perspective`、`rotateX`、`rotateZ`
- scaleShell：抓取时摄像机倍率
- content：卡片内容和排布

free landing 不再把同一份落地比例同时写入 proxy 和 scaleShell。摄像机期间的变化由 camera glue 跟随，避免重复缩放。

### 交接位置种子

`VisualAdapter.land` 在关闭 grabbing transition 前先读取当前已呈现的矩形，并将它转换回 proxy 定位层坐标：

```text
positionSeed = renderedRect - centeredScaleOffset
```

只替换 `motionState.x/y`，保留 `vx/vy`、缩放速度和旋转状态。这样 landing 从用户实际看到的那一帧继续运动，不改变目标落点和物理速度。

## 回归测试

新增测试：

`transform 过渡未完成时松手：landing 以当前呈现位置接管，避免首帧跳回 motion 终值`

覆盖场景：proxy 当前屏幕位置为 `110px`，motion 终值为 `120px`，验证传给 landing 的位置种子使用 `110px`，同时保留速度 `300px/s`。

## 验证结果

- `pnpm exec tsc --noEmit`：通过
- `git diff --check`：通过
- 新增回归测试：通过
- 相机跟随回归测试：通过

完整历史测试中仍有部分旧断言与当前 motion/代理契约不一致，未通过修改断言或跳过测试掩盖；本次新增用例覆盖的是实际线上跳跃根因。
