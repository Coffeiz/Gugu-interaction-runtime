# Interaction Runtime 优化与 Benchmark 报告（2026-10-20）

## 结论

本轮改动已按 Runtime 优化、benchmark/报告基础设施、画布夹具修复三类分别提交。重新运行的 444 个合成 benchmark 样本全部成功；另有 12 个 dnd-kit `regrab` 样本按能力不对等规则排除。真实 Gugu-web 看板 smoke 也通过（80 张真实 Vue 卡片）。

在扁平 2000 项 same-list、CDP CPU 6× 条件下，Runtime 的 `commitMs` 中位数由历史 raw run `2026-10-20T02-15-16-774Z` 的 141.0 ms 降至当前 B04（run `2026-10-20T10-26-58-416Z`）的 67.8 ms（约低 52%）；历史 run 不属于当前批次表中的 B03。`>24ms` 帧占比由 15.1% 降至 8.9%，Long Tasks 中位数由 8 降至 3。新 telemetry 中位数显示 1999 个候选卡片里有 1968 个被视口范围排除、29 个测量并动画，说明这条优化实际作用于大列表捕获范围。

这是一组跨批次、跨源码 revision 的方向性前后读数，不是严格同时间、同二进制的 A/B；不能把百分比解释为所有业务页面都会获得同等加速。`inputMs` 是脚本 12 个 rAF 驱动输入步骤的墙钟时间，会被主线程负载及帧调度放大，不等于输入延迟。

## 本轮优化与修复

- Runtime：对垂直列表同容器移除 FLIP 捕获按实际滚动视口收窄参与范围，减少大列表中视口外卡片的布局读取；free-layout Surface 在 capture 中跳过不需要参与重排的同级对象，并保留 telemetry 计数。
- Benchmark/report：接入 FLIP 事务 telemetry、运行清单、失败样本留痕、实现筛选及自动汇总；修正汇总器中的旧批次硬编码，报告按实际 manifest 与 trace 批次生成。
- Canvas fixture：修复提交时按 list index 错误重排卡片的问题，改为按释放点和抓取偏移定位自由画布卡片。Playwright 手动复现验证了 Runtime 在 50 与 2000 项时释放后坐标正确、proxy 清理且样本完成。
- 视觉修正：拖动 proxy 固定字体表现，避免抓取时文本意外放大。

## 本轮 benchmark

环境为 Apple M2 / macOS arm64、Node v22.23.2、Chromium 151.0.7922.34，Playwright Headless Chromium。三轮新运行对应 B02–B04，使用源码 revision `66ae66d`；历史批次 B01 使用 `a90d23a`，早于视口裁剪优化 `bc7862f`。新批次 manifest 的 `dirty=true` 只记录工作树非干净，未保存差异路径，因此不能断言差异仅来自真实页面 smoke JSON。结果是 CDP CPU 节流模拟，不代表真实低配硬件。

| 条件 | Runtime commit 中位数 | dnd-kit commit 中位数 | Runtime >24ms 帧 | Runtime Long Tasks | Runtime telemetry 摘要 |
|---|---:|---:|---:|---:|---|
| flat / 2000 / same-list / 6× | 67.8 ms | 42.3 ms | 8.9% | 3 | 1999 candidates；1968 offscreen skipped；29 measured / animated |
| grouped / 2000 / grouped / 6× | 65.1 ms | 114.5 ms | 7.7% | 5 | 1999 candidates；1969 offscreen skipped；60 measured / animated entries |
| canvas / 2000 / canvas-node / 6× | 48.0 ms | 2.7 ms | 43.5% | 5 | 1999 candidates；1999 range skipped；0 measured / animated entries |

表格只呈现不同功能实现的观测数据，不将差异解释为等功能效率胜负。Telemetry 的计数单位依字段而异，group/container 与 card visits 不可简单相加；它说明 Runtime 内部参与者范围和工作量，不用于推导耗时优势。Canvas 行已使用修复后的坐标落位夹具；旧报告中 55.9 ms 的 canvas 优化后读数已作废，不与本表对比。

汇总共纳入 450 个有效重复样本 / 150 条条件行，其中 444 个来自本轮三次完整运行，另 6 个来自已有历史批次。当前三份新 manifest 的 444 次尝试全部成功；dnd-kit 的 12 次 regrab 由 runner 明确排除。汇总仍保留历史运行中的 2 次失败：一条 2000 项 Runtime regrab 超时（无 move action），一条旧批 dnd-kit 页面加载超时；均不插补、不进入有效统计。2000 项 regrab 仍无成功样本。

真实页面 smoke 使用 Gugu-web 看板与真实 Vue 卡片样式，80 张卡片，浏览器 API mock，不写入业务数据；该验证与合成计时分开。全套合成样本为 headless，尚无 headed 或真实低配设备结果。

## 按类别提交

| 类别 | Commit | 内容 |
|---|---|---|
| Runtime 优化 | `bfcdf7d` | free-layout Surface FLIP capture 优化 |
| Runtime 优化 | `bc7862f` | 大列表移除 FLIP 捕获范围按视口收窄 |
| Benchmark 基础设施 | `a90d23a` | benchmark harness、FLIP telemetry |
| 报告与数据口径 | `fff2461` | 批次来源及历史比较口径修正 |
| Benchmark fixture | `66ae66d` | 修复 canvas drop 语义、增加实现筛选 |

## 复现与来源

```sh
npm run benchmark -- --repetitions 3 --throttle 1 --interaction same-list,multi-select,cross-column,grouped,folded-context,canvas-node
npm run benchmark -- --scenario flat --count 50,200,500,1000 --repetitions 3 --throttle 1 --interaction regrab
npm run benchmark -- --count 50,2000 --repetitions 3 --throttle 4,6 --interaction same-list,cross-column,multi-select,grouped,folded-context,canvas-node
npm run benchmark:report
```

真实页面复现：`GUGU_WEB_ROOT=/path/to/Gugu-web npm run benchmark:real-page`。

汇总见 [benchmark-report.md](benchmark-report.md) 和 [benchmark-summary.json](benchmark-summary.json)；三份本轮运行清单为 `run-2026-10-20T10-19-41-542Z.json`、`run-2026-10-20T10-26-35-698Z.json`、`run-2026-10-20T10-26-58-416Z.json`。逐样本压缩 trace 位于本机 `docs/reports/raw/`（gitignored）。
