# Landing 目标原生 hover 快照污染

日期：2026-08-16

## 现象

从抽屉拖出卡片后，如果鼠标在目标卡片上松手，landing 代理会继承目标卡片的 hover 阴影。代理本身已经设置为 `pointer-events: none`，但仍可能出现一帧 hover 视觉，随后才恢复正常。

## 根因

浏览器在 `pointerup` 当前帧仍可能把真实目标节点视为 `:hover`。仅临时设置目标节点的 `pointer-events: none`，不会同步清除当前 hover 匹配状态；直接读取真实节点的 computed style，会把 hover 阴影、背景或位移写入 landing 快照。

## 修复

`captureDetachTargetSnapshot()` 改为：

1. 在目标同一父节点创建临时克隆，保留主题变量和继承样式。
2. 将克隆移出视口、禁用命中、关闭 transition，并按真实目标 rect 固定尺寸。
3. 从克隆读取静态视觉快照，真实目标 rect 仍作为 landing 的几何目标。
4. 读取完成后立即移除克隆，不改变业务节点状态。

代理本身继续由 Runtime 管理为 `pointer-events: none`，regrab 通过 Runtime 捕获阶段的实时矩形判定完成，不依赖代理参与 hover。

## 回归测试

- landing proxy 不参与 hover，且不会保留 `is-hovered`。
- 目标快照使用同父级、移出命中的克隆，不读取原目标的瞬时 hover 样式。
- 临时 `opacity: 0` 仍能恢复为可见 landing 快照，原目标状态不被修改。

## 验证

- 相关测试：6 个通过
- `git diff --check`：通过
- 完整测试仍受仓库中既有调试探针对 `elementFromPoint`、`getAnimations` 的 jsdom 依赖影响，未通过修改断言或跳过用例掩盖。
