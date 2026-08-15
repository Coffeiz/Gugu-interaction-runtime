# Landing 透视倾角修复

## 现象

画布内快速拖动，或从抽屉与画布之间跨 Surface 拖动后松手，landing 代理偶发出现上下边错位的斜切效果。斜切在高速释放时更明显，随后才逐帧恢复正常。

## 根因

抓取阶段的 MotionState 会记录 `rotateX`。landing 继续直接继承该值时，代理的 `perspective(...) rotateX(...)` 会让上下边产生不同的屏幕投影。这个问题与目标坐标、摄像机缩放和 `rotateZ` 无关。

## 修复

Runtime 在进入 landing 前清零 `rotateX`，同时保留位置、缩放、释放速度和 `rotateZ`。因此落地仍然保留平面旋转和运动连续性，但不会把抓取阶段的前后倾角带入落地代理。

## 回归覆盖

- 跨 Surface landing 不继承 perspective 前后倾，并保留平面旋转。
- 同 Surface landing 不继承抓取时的 perspective 前后倾，并保留释放速度与平面旋转。
