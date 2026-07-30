# 快速抓放导致 Surface 高度回写旧值

## 现象

底部卡片抓起后立即松手，Surface 偶尔会把上方内容顶动一下；拖动一段时间再松手通常正常。日志显示同一列的 Surface 高度在短时间内出现 `594 → 548 → 594` 的恢复过程。

## 根因

卡片抓起会启动 Surface resize。旧 resize 尚未结束时，下一次快速抓放已经开始，并基于中间高度重新 capture。旧事务排队的 RAF/timeout 仍然可能在新事务期间执行，把 Surface 的 inline height 恢复成旧值。这个位移不是兄弟卡片 FLIP，也不是滚动锚点，而是过期 resize 回调与新事务竞争。

## 修复

- 新布局事务 capture 时立即取消正在运行的 Surface resize，并恢复其基础 inline 样式；
- detach 的延后一帧布局调度增加 token，旧事务的回调在新事务开始后失效；
- 保持 landing 先接管目标，再启动布局 FLIP/Surface resize 的顺序。

## 验证

覆盖底部卡片快速抓放、连续快速抓放、同列回放和跨列落地；类型检查通过，诊断探针已在确认原因后移除。
