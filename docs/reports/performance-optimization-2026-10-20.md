# Free-layout FLIP 优化验证（2026-10-20）

## 改动

Surface 的 `layout: 'free'` 表示对象按连续坐标独立定位，移动一个对象不会重排相邻对象。Runtime 在 pickup/release 的 FLIP capture 中不再对同一 free-layout Surface 的相邻对象读取几何；grid Surface 路径保持不变。被跳过的对象仍计入候选/跳过 telemetry，不作为动画参与者。

## 验证环境与结果

Apple M2、8 核、16 GB；macOS arm64；Node v22.23.2；Headless Chromium 151.0.7922.34；CDP CPU 6×。相同 workload：canvas / 2000 项 / canvas-node / 3 次有效样本。

| 指标 | 优化前 | 优化后 |
|---|---:|---:|
| Runtime commitMs 中位数 | 208.6 ms | 55.9 ms |
| Runtime commitMs 样本 | 227.6 / 208.6 / 147.4 ms | 42.3 / 75.1 / 55.9 ms |
| 末笔 telemetry captureReads | 2000 | 1 |
| 末笔 telemetry playReads | 1977 | 1 |
| 末笔 telemetry measuredCards | 1976 | 0 |
| rangeSkipped | 23 | 1999 |

本 workload 的 Runtime commit 中位数下降约 73%；采集到的 capture/play 几何读取合计由 3977 降到 2。三次优化后样本均成功提交。dnd-kit 同轮 `commitMs` 中位数为 4.1 ms（优化前）和 7.4 ms（优化后），这里只作为同场运行控制，不是等功能性能对照。`inputMs` 是脚本输入段墙钟时间，不解释为输入延迟。

这项结果只说明当前合成 free-canvas workload 中同级对象测量可以避免；它不代表真实低配设备表现，也不应推广成 Runtime 对 dnd-kit 的总体速度结论。

## Grid 路径检查

另跑 flat / 500 项 / same-list / 6× / 3 次，Runtime `commitMs` 为 42.5 / 26.1 / 23.9 ms，telemetry 仍测量并动画 497 张 eligible 卡片，表明 free-layout 裁剪没有应用到 grid workload。该项没有同代码版本的优化前对照，只作路径覆盖，不宣称无性能回归。

flat / 2000 项的 grid 回归尝试在 dnd-kit 页面加载阶段 30 秒超时，未形成完整对照，失败不计入性能结果。

## 可追溯记录

- 优化前：[`run-2026-10-20T09-33-29-713Z.json`](run-2026-10-20T09-33-29-713Z.json)，源码 `a90d23a`，dirty=false。
- 优化后：[`run-2026-10-20T09-39-56-614Z.json`](run-2026-10-20T09-39-56-614Z.json)，源码 `a90d23a`，dirty=true。
- grid 2000 失败：[`run-2026-10-20T09-42-03-422Z.json`](run-2026-10-20T09-42-03-422Z.json)。
- grid 500 检查：[`run-2026-10-20T09-43-01-307Z.json`](run-2026-10-20T09-43-01-307Z.json)。
- 原始 trace 位于 gitignored 的 `docs/reports/raw/`，保留在本机；run 清单记录每次尝试和失败状态。
