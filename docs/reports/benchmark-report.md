# Interaction Runtime 拖拽性能基准

> 合成基准与真实 Gugu-web 页面验证分开报告。Runtime 完整功能与 dnd-kit 的能力集合不同，表格只呈现观测值，不把差异归因于实现效率，也不宣称等功能公平胜负。

## 数据来源批次

> 主表与 telemetry 表每行的“来源批次”列指向下表。批次时间取自原始 trace 文件名；旧 trace 未记录 Git revision，不能据此证明旧批之间代码完全一致。新 runner 会记录 revision 和 worktree dirty 状态。汇总对同一条件/重复编号采用最新有效 trace，因此新 grouped 批次替换了旧 grouped 行；旧数值仍保留在 raw 文件中，但不参与当前汇总。

| 批次 | UTC 时间 | 纳入有效样本 | 条件数 | Git revision | dirty |
|---|---|---:|---:|---|---|
| B01 | 2026-10-20T02:08:31.456Z | 168 | 28 | 未记录 | 未记录 |
| B02 | 2026-10-20T02:14:55.600Z | 12 | 4 | 未记录 | 未记录 |
| B03 | 2026-10-20T02:15:16.774Z | 156 | 26 | 未记录 | 未记录 |
| B04 | 2026-10-20T07:02:27.031Z | 60 | 10 | 未记录 | 未记录 |
| B05 | 2026-10-20T07:04:13.085Z | 48 | 8 | 未记录 | 未记录 |

### 已记录的失败尝试

| Run | 样本 | 结果 | revision / dirty | 错误与诊断 | Trace |
|---|---|---|---|---|---|
| 2026-10-20T08-30-08-108Z | flat-2000-regrab-runtime-cpu1-r1 | failed | 76dec47 / true | TimeoutError: page.waitForFunction: Timeout 60000ms exceeded.; {"status":"dragging","proxies":0,"samples":0,"actions":[]} | docs/reports/raw/flat-2000-regrab-runtime-cpu1-r1-2026-10-20T08-30-08-108Z.json.gz |

## 环境与方法

- 合成基准：Apple M2，8 核，16 GB；darwin/arm64；Node v22.23.2；Chromium 151.0.7922.34。默认由 Playwright Headless Chromium 运行。
- 场景：flat 扁平列表、flat-thumbnails 缩略图列表、kanban 看板、grouped 分组、canvas 画布；看板固定 800 张卡。
- 每个条件按 3 次以上有效样本的中位数汇总；Runtime 与 dnd-kit 交错执行。未完成提交、settle 超时、缺少帧采样或阶段时间的样本全部剔除，不插补。
- `inputMs` = pointerdown→pointerup；`commitMs` = pointerup→DOM commit-end。`inputMs` 是脚本输入段墙钟时间：拖动由 12 个 rAF-paced CDP 步骤驱动，会被主线程负载和帧调度放大，不等于 Event Timing 输入延迟。`settleMs` 是实现各自稳定检测 race 的返回值，受动画和检测窗口影响，不稳定且不可跨实现比较；本报告不把它作为对外结论，也不将阶段相加为总耗时。
- `>24ms 帧 %` = pointerdown 至视觉稳定期间 rAF 间隔超过 24ms 的比例；每个样本必须有帧数据才进入汇总。
- Drag Interaction P98 暂不进入对外汇总：本次 350 个有值原始样本中，338 个等于 Event Timing max，P98 不能代表重复交互分布。Event Timing 汇总行缺测：dnd-kit 23/72，runtime 0/76；原始样本缺测：dnd-kit 91/216，runtime 1/228。缺测记为 —，不代表 0。
- Long Tasks 是测量窗口内浏览器 Long Tasks 条目数；它不等价于卡顿次数，且不能单独代表交互质量。
- `regrab` 是 Runtime 特有的落位代理再抓取能力；dnd-kit 无对应操作，因此保留 flat 50/200/500/1000 @1× 的 Runtime 单边行但不作横向比较。2000 项目前没有成功样本：唯一保留的 2000-regrab 实跑失败并已列在“已记录的失败尝试”，不纳入有效样本。
- grouped 的 inputMs 在新批次普遍升高。grouped/50/grouped/1×：dnd-kit 从 B01 旧批 172.7 ms 变为表内 B04 425.8 ms；Runtime 从 B01 170.9 ms 变为 B04 425.1 ms。B01 旧行已被同 key 的最新有效 trace 替换，旧 raw trace 仍保留；旧批数值按 B01 raw 单独重算，不参与当前汇总。
- 版本边界：B01–B03 在本机时间 10:08–10:15 运行；`src/dom/GroupLayout.ts` 与 `src/benchmark/PerformanceRecorder.ts` 的工作树修改时间分别为 10:33:07、10:33:30；B04–B05 在 15:02–15:04 运行。因此主表中 112 行来自这两处修改之前，36 行 grouped 数据来自修改之后。flat 与 grouped 等跨边界数据不能作横向性能比较；旧 raw 未记录 Git revision，修改时间用于界定批次，不等同于逐样本源码哈希。
- 两批 grouped inputMs 的整体抬升同时发生在 dnd-kit 与 Runtime，并且跨多个规模；这提示存在运行批次/帧调度层面的墙钟差异，但现有证据无法确认唯一原因，也不能排除代码变化影响。
- 合成 fixture 不等同于真实产品 DOM。完整 Runtime 含 dnd-kit 基线没有的代理、布局联动及 Surface 行为；没有 runtime-minus 消融对照前，不应将总耗时差解释为核心算法效率差异。CPU 节流是 CDP 模拟，不代表真实低配设备。

## 真实页面验证

真实 Gugu-web 看板页面 smoke：通过；80 张卡片；Chromium 151.0.7922.34 (headless)；源码 76dec47（dirty worktree）；生成于 2026-10-20T08:31:34.914Z。使用真实 Vue 卡片和样式，API 由浏览器测试 mock，避免写入业务数据。该项验证交互/DOM 集成，不与合成基准计时混算。见 real-page-smoke.json。

## 复跑

仓库根目录执行 `npm ci` 后：

```sh
npx playwright install chromium
npm run benchmark -- --repetitions 3 --throttle 1 --interaction same-list,multi-select,cross-column,grouped,folded-context,canvas-node
npm run benchmark -- --scenario flat --count 50,200,500,1000 --repetitions 3 --throttle 1 --interaction regrab
npm run benchmark -- --count 50,2000 --repetitions 3 --throttle 4,6 --interaction same-list,cross-column,multi-select,grouped,folded-context,canvas-node
```

每次基准会在 `docs/reports/raw/` 写入 trace，并在 `docs/reports/run-*.json` 留下运行清单；清单不再被 gitignore 排除。`npm run benchmark:report` 从 trace 生成汇总。请在报告定稿和审阅完成前保留这些来源记录；本报告依赖原始 trace 做批次追溯。headed 与 headless 结果必须分开执行、分开汇总。真实页面 smoke 可通过 `GUGU_WEB_ROOT=/path/to/Gugu-web npm run benchmark:real-page` 复跑。

## 汇总数据

| 场景 | 项数 | 交互 | CPU× | 实现 | n | 来源批次 | 输入 ms | 提交 ms | >24ms 帧 % | Event Timing max ms | Long Tasks 数 |
|---|---:|---|---:|---|---:|---|---:|---:|---:|---:|---:|
| canvas | 50 | canvas-node | 1× | dnd-kit | 3 | B01 | 171.7 | 0.7 | 0.0 | — | 0.0 |
| canvas | 50 | canvas-node | 1× | runtime | 3 | B01 | 171.0 | 1.8 | 0.0 | 16.0 | 0.0 |
| canvas | 200 | canvas-node | 1× | dnd-kit | 3 | B01 | 178.3 | 0.6 | 0.0 | — | 0.0 |
| canvas | 200 | canvas-node | 1× | runtime | 3 | B01 | 175.1 | 3.8 | 0.0 | 16.0 | 0.0 |
| canvas | 500 | canvas-node | 1× | dnd-kit | 3 | B01 | 184.7 | 0.6 | 0.0 | — | 0.0 |
| canvas | 500 | canvas-node | 1× | runtime | 3 | B01 | 178.0 | 6.3 | 0.0 | 24.0 | 0.0 |
| canvas | 1000 | canvas-node | 1× | dnd-kit | 3 | B01 | 195.8 | 0.5 | 4.0 | — | 0.0 |
| canvas | 1000 | canvas-node | 1× | runtime | 3 | B01 | 184.5 | 7.5 | 0.0 | 32.0 | 0.0 |
| canvas | 2000 | canvas-node | 1× | dnd-kit | 3 | B01 | 237.0 | 0.4 | 3.7 | — | 1.0 |
| canvas | 2000 | canvas-node | 1× | runtime | 3 | B01 | 205.9 | 19.4 | 2.1 | 56.0 | 0.0 |
| flat | 50 | multi-select | 1× | dnd-kit | 3 | B01 | 174.2 | 1.8 | 0.0 | 16.0 | 0.0 |
| flat | 50 | multi-select | 1× | runtime | 3 | B01 | 385.1 | 1.3 | 1.1 | 40.0 | 0.0 |
| flat | 50 | regrab | 1× | runtime | 3 | B02 | 286.1 | 1.2 | 0.0 | 16.0 | 0.0 |
| flat | 50 | same-list | 1× | dnd-kit | 3 | B01 | 174.3 | 1.3 | 0.0 | — | 0.0 |
| flat | 50 | same-list | 1× | runtime | 3 | B01 | 176.8 | 1.2 | 0.0 | 16.0 | 0.0 |
| flat | 200 | multi-select | 1× | dnd-kit | 3 | B01 | 180.4 | 2.8 | 0.0 | 16.0 | 0.0 |
| flat | 200 | multi-select | 1× | runtime | 3 | B01 | 398.1 | 2.5 | 1.1 | 40.0 | 0.0 |
| flat | 200 | regrab | 1× | runtime | 3 | B02 | 298.5 | 2.0 | 0.0 | 24.0 | 0.0 |
| flat | 200 | same-list | 1× | dnd-kit | 3 | B01 | 179.2 | 2.3 | 0.0 | — | 0.0 |
| flat | 200 | same-list | 1× | runtime | 3 | B01 | 180.9 | 2.1 | 0.0 | 24.0 | 0.0 |
| flat | 500 | multi-select | 1× | dnd-kit | 3 | B01 | 208.2 | 4.1 | 0.0 | 16.0 | 0.0 |
| flat | 500 | multi-select | 1× | runtime | 3 | B01 | 387.1 | 4.4 | 1.1 | 32.0 | 0.0 |
| flat | 500 | regrab | 1× | runtime | 3 | B02 | 369.4 | 4.0 | 0.0 | 48.0 | 0.0 |
| flat | 500 | same-list | 1× | dnd-kit | 3 | B01 | 202.0 | 3.6 | 0.0 | 16.0 | 0.0 |
| flat | 500 | same-list | 1× | runtime | 3 | B01 | 197.4 | 4.1 | 1.3 | 48.0 | 0.0 |
| flat | 1000 | multi-select | 1× | dnd-kit | 3 | B01 | 262.6 | 6.2 | 1.4 | 16.0 | 0.0 |
| flat | 1000 | multi-select | 1× | runtime | 3 | B01 | 391.1 | 8.9 | 3.3 | 40.0 | 0.0 |
| flat | 1000 | regrab | 1× | runtime | 3 | B02 | 594.5 | 6.4 | 6.7 | 88.0 | 0.0 |
| flat | 1000 | same-list | 1× | dnd-kit | 3 | B01 | 225.0 | 4.8 | 1.5 | 16.0 | 0.0 |
| flat | 1000 | same-list | 1× | runtime | 3 | B01 | 293.2 | 6.5 | 2.9 | 64.0 | 1.0 |
| flat | 2000 | multi-select | 1× | dnd-kit | 3 | B01 | 388.1 | 11.1 | 2.7 | 40.0 | 1.0 |
| flat | 2000 | multi-select | 1× | runtime | 3 | B01 | 396.7 | 25.1 | 6.0 | 80.0 | 1.0 |
| flat | 2000 | same-list | 1× | dnd-kit | 3 | B01 | 282.3 | 7.2 | 1.5 | 24.0 | 1.0 |
| flat | 2000 | same-list | 1× | runtime | 3 | B01 | 416.7 | 23.0 | 14.5 | 144.0 | 3.0 |
| flat-thumbnails | 50 | multi-select | 1× | dnd-kit | 3 | B01 | 176.1 | 1.6 | 0.0 | 16.0 | 0.0 |
| flat-thumbnails | 50 | multi-select | 1× | runtime | 3 | B01 | 429.6 | 1.5 | 2.2 | 40.0 | 0.0 |
| flat-thumbnails | 50 | same-list | 1× | dnd-kit | 3 | B01 | 173.6 | 1.0 | 0.0 | — | 0.0 |
| flat-thumbnails | 50 | same-list | 1× | runtime | 3 | B01 | 173.6 | 1.1 | 0.0 | 16.0 | 0.0 |
| flat-thumbnails | 200 | multi-select | 1× | dnd-kit | 3 | B01 | 182.4 | 2.7 | 0.0 | 16.0 | 0.0 |
| flat-thumbnails | 200 | multi-select | 1× | runtime | 3 | B01 | 378.1 | 2.4 | 1.1 | 32.0 | 0.0 |
| flat-thumbnails | 200 | same-list | 1× | dnd-kit | 3 | B01 | 179.4 | 1.5 | 0.0 | — | 0.0 |
| flat-thumbnails | 200 | same-list | 1× | runtime | 3 | B01 | 178.9 | 2.3 | 0.0 | 24.0 | 0.0 |
| flat-thumbnails | 500 | multi-select | 1× | dnd-kit | 3 | B01 | 232.7 | 4.2 | 0.0 | 16.0 | 0.0 |
| flat-thumbnails | 500 | multi-select | 1× | runtime | 3 | B01 | 417.1 | 4.9 | 2.2 | 40.0 | 0.0 |
| flat-thumbnails | 500 | same-list | 1× | dnd-kit | 3 | B01 | 201.8 | 3.1 | 0.0 | 16.0 | 0.0 |
| flat-thumbnails | 500 | same-list | 1× | runtime | 3 | B01 | 202.1 | 4.9 | 1.3 | 64.0 | 0.0 |
| flat-thumbnails | 1000 | multi-select | 1× | dnd-kit | 3 | B01 | 272.7 | 7.2 | 1.4 | 24.0 | 0.0 |
| flat-thumbnails | 1000 | multi-select | 1× | runtime | 3 | B01 | 401.7 | 8.5 | 3.3 | 40.0 | 0.0 |
| flat-thumbnails | 1000 | same-list | 1× | dnd-kit | 3 | B01 | 224.1 | 4.7 | 1.5 | 16.0 | 0.0 |
| flat-thumbnails | 1000 | same-list | 1× | runtime | 3 | B01 | 337.9 | 6.9 | 4.8 | 72.0 | 0.0 |
| flat-thumbnails | 2000 | multi-select | 1× | dnd-kit | 3 | B01 | 405.9 | 11.9 | 1.3 | 40.0 | 1.0 |
| flat-thumbnails | 2000 | multi-select | 1× | runtime | 3 | B01 | 381.5 | 21.5 | 6.3 | 72.0 | 0.0 |
| flat-thumbnails | 2000 | same-list | 1× | dnd-kit | 3 | B01 | 289.9 | 7.4 | 1.5 | 24.0 | 1.0 |
| flat-thumbnails | 2000 | same-list | 1× | runtime | 3 | B01 | 422.1 | 18.2 | 18.3 | 144.0 | 3.0 |
| grouped | 50 | folded-context | 1× | dnd-kit | 3 | B04 | 417.2 | 4.5 | 0.0 | 24.0 | 0.0 |
| grouped | 50 | folded-context | 1× | runtime | 3 | B04 | 415.6 | 1.1 | 0.0 | 24.0 | 0.0 |
| grouped | 50 | grouped | 1× | dnd-kit | 3 | B04 | 425.8 | 2.6 | 0.0 | 16.0 | 0.0 |
| grouped | 50 | grouped | 1× | runtime | 3 | B04 | 425.1 | 1.5 | 0.0 | 24.0 | 0.0 |
| grouped | 200 | folded-context | 1× | dnd-kit | 3 | B04 | 419.5 | 3.5 | 0.0 | — | 0.0 |
| grouped | 200 | folded-context | 1× | runtime | 3 | B04 | 415.6 | 2.2 | 0.0 | 24.0 | 0.0 |
| grouped | 200 | grouped | 1× | dnd-kit | 3 | B04 | 420.9 | 3.8 | 0.0 | 24.0 | 0.0 |
| grouped | 200 | grouped | 1× | runtime | 3 | B04 | 417.8 | 2.2 | 0.0 | 32.0 | 0.0 |
| grouped | 500 | folded-context | 1× | dnd-kit | 3 | B04 | 435.8 | 5.6 | 0.0 | — | 0.0 |
| grouped | 500 | folded-context | 1× | runtime | 3 | B04 | 417.1 | 4.2 | 0.0 | 32.0 | 0.0 |
| grouped | 500 | grouped | 1× | dnd-kit | 3 | B04 | 421.7 | 5.3 | 0.0 | 24.0 | 0.0 |
| grouped | 500 | grouped | 1× | runtime | 3 | B04 | 427.4 | 4.0 | 0.0 | 40.0 | 0.0 |
| grouped | 1000 | folded-context | 1× | dnd-kit | 3 | B04 | 449.1 | 9.8 | 2.4 | 24.0 | 0.0 |
| grouped | 1000 | folded-context | 1× | runtime | 3 | B04 | 415.8 | 5.6 | 0.0 | 40.0 | 0.0 |
| grouped | 1000 | grouped | 1× | dnd-kit | 3 | B04 | 455.5 | 9.8 | 4.0 | 28.0 | 0.0 |
| grouped | 1000 | grouped | 1× | runtime | 3 | B04 | 418.6 | 6.1 | 0.0 | 40.0 | 0.0 |
| grouped | 2000 | folded-context | 1× | dnd-kit | 3 | B04 | 505.2 | 23.0 | 2.3 | 44.0 | 1.0 |
| grouped | 2000 | folded-context | 1× | runtime | 3 | B04 | 431.2 | 9.8 | 2.1 | 56.0 | 0.0 |
| grouped | 2000 | grouped | 1× | dnd-kit | 3 | B04 | 533.5 | 19.2 | 8.0 | — | 1.0 |
| grouped | 2000 | grouped | 1× | runtime | 3 | B04 | 433.2 | 13.1 | 4.3 | 64.0 | 0.0 |
| kanban | 800 | cross-column | 1× | dnd-kit | 3 | B01 | 233.4 | 0.7 | 1.6 | 16.0 | 0.0 |
| kanban | 800 | cross-column | 1× | runtime | 3 | B01 | 194.4 | 10.9 | 0.0 | 40.0 | 0.0 |
| kanban | 800 | multi-select | 1× | dnd-kit | 3 | B01 | 208.1 | 2.5 | 1.6 | 16.0 | 0.0 |
| kanban | 800 | multi-select | 1× | runtime | 3 | B01 | 173.2 | 4.3 | 0.0 | 16.0 | 0.0 |
| kanban | 800 | same-list | 1× | dnd-kit | 3 | B01 | 211.0 | 1.7 | 1.6 | 16.0 | 0.0 |
| kanban | 800 | same-list | 1× | runtime | 3 | B01 | 182.1 | 3.5 | 0.0 | 32.0 | 0.0 |
| canvas | 50 | canvas-node | 4× | dnd-kit | 3 | B03 | 185.2 | 1.4 | 0.0 | — | 0.0 |
| canvas | 50 | canvas-node | 4× | runtime | 3 | B03 | 171.7 | 5.7 | 0.0 | 24.0 | 0.0 |
| canvas | 2000 | canvas-node | 4× | dnd-kit | 3 | B03 | 531.8 | 1.1 | 3.3 | — | 1.0 |
| canvas | 2000 | canvas-node | 4× | runtime | 3 | B03 | 596.5 | 94.1 | 5.6 | 280.0 | 3.0 |
| flat | 50 | multi-select | 4× | dnd-kit | 3 | B03 | 254.5 | 7.3 | 0.0 | 16.0 | 0.0 |
| flat | 50 | multi-select | 4× | runtime | 3 | B03 | 345.4 | 6.1 | 1.3 | 32.0 | 0.0 |
| flat | 50 | same-list | 4× | dnd-kit | 3 | B03 | 200.3 | 4.3 | 0.0 | 16.0 | 0.0 |
| flat | 50 | same-list | 4× | runtime | 3 | B03 | 224.0 | 5.1 | 1.3 | 40.0 | 0.0 |
| flat | 2000 | multi-select | 4× | dnd-kit | 3 | B03 | 1310.2 | 51.0 | 44.4 | 144.0 | 11.0 |
| flat | 2000 | multi-select | 4× | runtime | 3 | B03 | 456.7 | 105.6 | 22.4 | 304.0 | 3.0 |
| flat | 2000 | same-list | 4× | dnd-kit | 3 | B03 | 874.2 | 28.8 | 10.9 | 116.0 | 4.0 |
| flat | 2000 | same-list | 4× | runtime | 3 | B03 | 818.3 | 94.5 | 8.3 | 568.0 | 6.0 |
| flat-thumbnails | 50 | multi-select | 4× | dnd-kit | 3 | B03 | 270.1 | 7.5 | 1.4 | 24.0 | 0.0 |
| flat-thumbnails | 50 | multi-select | 4× | runtime | 3 | B03 | 367.7 | 6.3 | 2.5 | 40.0 | 0.0 |
| flat-thumbnails | 50 | same-list | 4× | dnd-kit | 3 | B03 | 197.1 | 3.8 | 0.0 | 16.0 | 0.0 |
| flat-thumbnails | 50 | same-list | 4× | runtime | 3 | B03 | 187.9 | 5.4 | 0.0 | 40.0 | 0.0 |
| flat-thumbnails | 2000 | multi-select | 4× | dnd-kit | 3 | B03 | 1355.8 | 48.2 | 53.1 | 152.0 | 11.0 |
| flat-thumbnails | 2000 | multi-select | 4× | runtime | 3 | B03 | 526.0 | 86.6 | 19.6 | 272.0 | 4.0 |
| flat-thumbnails | 2000 | same-list | 4× | dnd-kit | 3 | B03 | 812.1 | 28.6 | 8.2 | 108.0 | 4.0 |
| flat-thumbnails | 2000 | same-list | 4× | runtime | 3 | B03 | 860.8 | 75.5 | 9.4 | 536.0 | 6.0 |
| grouped | 50 | folded-context | 4× | dnd-kit | 3 | B05 | 443.5 | 7.6 | 2.5 | 24.0 | 0.0 |
| grouped | 50 | folded-context | 4× | runtime | 3 | B05 | 414.0 | 4.4 | 0.0 | 40.0 | 0.0 |
| grouped | 50 | grouped | 4× | dnd-kit | 3 | B05 | 432.4 | 9.4 | 2.5 | 24.0 | 0.0 |
| grouped | 50 | grouped | 4× | runtime | 3 | B05 | 423.2 | 4.7 | 0.0 | 40.0 | 0.0 |
| grouped | 2000 | folded-context | 4× | dnd-kit | 3 | B05 | 1113.7 | 73.0 | 9.5 | — | 3.0 |
| grouped | 2000 | folded-context | 4× | runtime | 3 | B05 | 592.8 | 41.7 | 10.6 | 232.0 | 3.0 |
| grouped | 2000 | grouped | 4× | dnd-kit | 3 | B05 | 1111.4 | 75.2 | 9.5 | — | 3.0 |
| grouped | 2000 | grouped | 4× | runtime | 3 | B05 | 599.9 | 43.9 | 8.2 | 232.0 | 3.0 |
| kanban | 800 | cross-column | 4× | dnd-kit | 3 | B03 | 744.4 | 3.2 | 4.7 | 32.0 | 2.0 |
| kanban | 800 | cross-column | 4× | runtime | 3 | B03 | 360.9 | 33.2 | 2.6 | 88.0 | 1.0 |
| kanban | 800 | multi-select | 4× | dnd-kit | 3 | B03 | 766.3 | 12.0 | 12.9 | 56.0 | 1.0 |
| kanban | 800 | multi-select | 4× | runtime | 3 | B03 | 191.4 | 15.2 | 1.6 | 56.0 | 0.0 |
| kanban | 800 | same-list | 4× | dnd-kit | 3 | B03 | 444.0 | 6.1 | 2.7 | 40.0 | 1.0 |
| kanban | 800 | same-list | 4× | runtime | 3 | B03 | 333.7 | 12.4 | 2.9 | 64.0 | 0.0 |
| canvas | 50 | canvas-node | 6× | dnd-kit | 3 | B03 | 194.3 | 2.0 | 4.2 | — | 0.0 |
| canvas | 50 | canvas-node | 6× | runtime | 3 | B03 | 181.7 | 9.1 | 0.0 | 24.0 | 0.0 |
| canvas | 2000 | canvas-node | 6× | dnd-kit | 3 | B03 | 802.6 | 2.0 | 26.7 | — | 1.0 |
| canvas | 2000 | canvas-node | 6× | runtime | 3 | B03 | 780.2 | 128.3 | 49.0 | 352.0 | 5.0 |
| flat | 50 | multi-select | 6× | dnd-kit | 3 | B03 | 337.9 | 9.4 | 1.3 | 32.0 | 0.0 |
| flat | 50 | multi-select | 6× | runtime | 3 | B03 | 338.7 | 8.7 | 2.4 | 40.0 | 0.0 |
| flat | 50 | same-list | 6× | dnd-kit | 3 | B03 | 215.7 | 4.5 | 1.5 | 16.0 | 0.0 |
| flat | 50 | same-list | 6× | runtime | 3 | B03 | 195.1 | 7.4 | 1.3 | 48.0 | 0.0 |
| flat | 2000 | multi-select | 6× | dnd-kit | 3 | B03 | 1940.3 | 65.2 | 68.6 | 208.0 | 12.0 |
| flat | 2000 | multi-select | 6× | runtime | 3 | B03 | 604.9 | 157.2 | 36.7 | 440.0 | 4.0 |
| flat | 2000 | same-list | 6× | dnd-kit | 3 | B03 | 1275.6 | 38.9 | 33.3 | 128.0 | 5.0 |
| flat | 2000 | same-list | 6× | runtime | 3 | B03 | 1432.1 | 141.0 | 15.1 | 880.0 | 8.0 |
| flat-thumbnails | 50 | multi-select | 6× | dnd-kit | 3 | B03 | 293.8 | 9.3 | 1.4 | 32.0 | 0.0 |
| flat-thumbnails | 50 | multi-select | 6× | runtime | 3 | B03 | 606.9 | 12.1 | 9.5 | 56.0 | 0.0 |
| flat-thumbnails | 50 | same-list | 6× | dnd-kit | 3 | B03 | 298.9 | 9.1 | 1.5 | 32.0 | 1.0 |
| flat-thumbnails | 50 | same-list | 6× | runtime | 3 | B03 | 223.5 | 8.0 | 2.6 | 64.0 | 0.0 |
| flat-thumbnails | 2000 | multi-select | 6× | dnd-kit | 3 | B03 | 2077.7 | 68.9 | 72.7 | 232.0 | 12.0 |
| flat-thumbnails | 2000 | multi-select | 6× | runtime | 3 | B03 | 570.9 | 128.7 | 36.7 | 392.0 | 5.0 |
| flat-thumbnails | 2000 | same-list | 6× | dnd-kit | 3 | B03 | 1393.8 | 44.6 | 34.5 | — | 5.0 |
| flat-thumbnails | 2000 | same-list | 6× | runtime | 3 | B03 | 1357.2 | 120.9 | 14.5 | 992.0 | 7.0 |
| grouped | 50 | folded-context | 6× | dnd-kit | 3 | B05 | 483.1 | 12.7 | 2.3 | 32.0 | 1.0 |
| grouped | 50 | folded-context | 6× | runtime | 3 | B05 | 431.3 | 7.6 | 2.1 | 48.0 | 0.0 |
| grouped | 50 | grouped | 6× | dnd-kit | 3 | B05 | 489.6 | 13.1 | 3.8 | — | 1.0 |
| grouped | 50 | grouped | 6× | runtime | 3 | B05 | 430.5 | 9.2 | 2.1 | 48.0 | 0.0 |
| grouped | 2000 | folded-context | 6× | dnd-kit | 3 | B05 | 1562.1 | 112.1 | 23.8 | — | 4.0 |
| grouped | 2000 | folded-context | 6× | runtime | 3 | B05 | 744.9 | 63.2 | 12.2 | 336.0 | 5.0 |
| grouped | 2000 | grouped | 6× | dnd-kit | 3 | B05 | 1625.8 | 110.7 | 22.7 | — | 5.0 |
| grouped | 2000 | grouped | 6× | runtime | 3 | B05 | 780.3 | 63.9 | 12.1 | 344.0 | 5.0 |
| kanban | 800 | cross-column | 6× | dnd-kit | 3 | B03 | 1055.7 | 4.6 | 20.5 | — | 2.0 |
| kanban | 800 | cross-column | 6× | runtime | 3 | B03 | 419.5 | 61.9 | 6.9 | 168.0 | 3.0 |
| kanban | 800 | multi-select | 6× | dnd-kit | 3 | B03 | 947.1 | 17.5 | 35.6 | 80.0 | 1.0 |
| kanban | 800 | multi-select | 6× | runtime | 3 | B03 | 228.7 | 24.5 | 11.8 | 96.0 | 1.0 |
| kanban | 800 | same-list | 6× | dnd-kit | 3 | B03 | 664.4 | 12.9 | 6.2 | 64.0 | 2.0 |
| kanban | 800 | same-list | 6× | runtime | 3 | B03 | 389.7 | 19.8 | 5.1 | 112.0 | 2.0 |

实现汇总行数：148；不同场景条件数：76；纳入汇总的有效重复样本：444。每行至少 3 个有效重复样本。

## Runtime Layout FLIP telemetry

> Runtime 内部观测；dnd-kit 不提供该 telemetry，因此不作实现间比较。每个拖拽样本记录 telemetry 发布计数的增量，并展示最后一笔已发布事务的字段快照；事务数是本次样本新增的发布笔数，不将末笔字段误称为整次交互总量。无新增事务记为 —，字段值为 0 则保留为 0。以下是 headless 合成 fixture 数据；真实页面与 headed 数据须分开呈现。
> 这些计数用于解释参与者筛选和测量行为，不用于推导耗时优势。`grouped` 是未折叠基线，`folded-context` 才会折叠第 12 个月份，两者应在相同规模和节流条件下对照阅读。当前合成 fixture 未提供 `[data-scroll-viewport]`，因此 `offscreenSkipped=0` 不表示没有卡片被视口裁剪；视口裁剪路径未覆盖。
> `candidateCards` / `capturedCards` / `eligibleCards` 是卡片参与者计数；`rangeSkipped`、`offscreenSkipped` 是筛选计数。`parentInheritedCardEvents` 汇总参与者继承跳过与 Relative FLIP 父级位移继承事件，并非去重卡片数。`measuredCardVisits`、`animatedCardEntries` 是处理/动画计划条目数，不是去重 DOM 卡片数；分组与叶子处理可能重复计入。`tinyDeltaSkipped` 汇总卡片与组元素的跳过事件；`animatedGroups` 是组元素条目数。
> 本轮 9/9 对 grouped/folded-context 的末笔 telemetry 字段完全相同：折叠第 12 个月份作为背景存在，但在本 fixture/动作中没有改变被测的 FLIP 计数。

| 场景 | 项数 | 交互 | CPU× | n | 来源批次 | telemetry n | 缺测 n | 新增事务数（中位数） | candidateCards | capturedCards | eligibleCards | rangeSkipped | offscreenSkipped | parentInheritedCardEvents | captureReads | captureCacheHits | playReads | playCacheHits | measuredCardVisits | animatedCardEntries | animatedGroups | tinyDeltaSkipped |
|---|---:|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| canvas | 50 | canvas-node | 1× | 3 | B01 | 3 | 0 | 2.0 | 49.0 | 49.0 | 26.0 | 23.0 | 0.0 | 0.0 | 50.0 | 0.0 | 27.0 | 0.0 | 26.0 | 0.0 | 0.0 | 26.0 |
| canvas | 200 | canvas-node | 1× | 3 | B01 | 3 | 0 | 2.0 | 199.0 | 199.0 | 176.0 | 23.0 | 0.0 | 0.0 | 200.0 | 0.0 | 177.0 | 0.0 | 176.0 | 0.0 | 0.0 | 176.0 |
| canvas | 500 | canvas-node | 1× | 3 | B01 | 3 | 0 | 2.0 | 499.0 | 499.0 | 476.0 | 23.0 | 0.0 | 0.0 | 500.0 | 0.0 | 477.0 | 0.0 | 476.0 | 0.0 | 0.0 | 476.0 |
| canvas | 1000 | canvas-node | 1× | 3 | B01 | 3 | 0 | 2.0 | 999.0 | 999.0 | 976.0 | 23.0 | 0.0 | 0.0 | 1000.0 | 0.0 | 977.0 | 0.0 | 976.0 | 0.0 | 0.0 | 976.0 |
| canvas | 2000 | canvas-node | 1× | 3 | B01 | 3 | 0 | 2.0 | 1999.0 | 1999.0 | 1976.0 | 23.0 | 0.0 | 0.0 | 2000.0 | 0.0 | 1977.0 | 0.0 | 1976.0 | 0.0 | 0.0 | 1976.0 |
| flat | 50 | multi-select | 1× | 3 | B01 | 3 | 0 | 1.0 | 49.0 | 49.0 | 41.0 | 8.0 | 0.0 | 0.0 | 50.0 | 0.0 | 42.0 | 0.0 | 41.0 | 3.0 | 0.0 | 38.0 |
| flat | 50 | regrab | 1× | 3 | B02 | 3 | 0 | 4.0 | 49.0 | 49.0 | 41.0 | 8.0 | 0.0 | 0.0 | 50.0 | 0.0 | 42.0 | 0.0 | 41.0 | 41.0 | 0.0 | 0.0 |
| flat | 50 | same-list | 1× | 3 | B01 | 3 | 0 | 2.0 | 49.0 | 49.0 | 47.0 | 2.0 | 0.0 | 0.0 | 50.0 | 0.0 | 48.0 | 0.0 | 47.0 | 47.0 | 0.0 | 0.0 |
| flat | 200 | multi-select | 1× | 3 | B01 | 3 | 0 | 1.0 | 199.0 | 199.0 | 191.0 | 8.0 | 0.0 | 0.0 | 200.0 | 0.0 | 192.0 | 0.0 | 191.0 | 3.0 | 0.0 | 188.0 |
| flat | 200 | regrab | 1× | 3 | B02 | 3 | 0 | 4.0 | 199.0 | 199.0 | 191.0 | 8.0 | 0.0 | 0.0 | 200.0 | 0.0 | 192.0 | 0.0 | 191.0 | 191.0 | 0.0 | 0.0 |
| flat | 200 | same-list | 1× | 3 | B01 | 3 | 0 | 2.0 | 199.0 | 199.0 | 197.0 | 2.0 | 0.0 | 0.0 | 200.0 | 0.0 | 198.0 | 0.0 | 197.0 | 197.0 | 0.0 | 0.0 |
| flat | 500 | multi-select | 1× | 3 | B01 | 3 | 0 | 1.0 | 499.0 | 499.0 | 491.0 | 8.0 | 0.0 | 0.0 | 500.0 | 0.0 | 492.0 | 0.0 | 491.0 | 3.0 | 0.0 | 488.0 |
| flat | 500 | regrab | 1× | 3 | B02 | 3 | 0 | 4.0 | 499.0 | 499.0 | 491.0 | 8.0 | 0.0 | 0.0 | 500.0 | 0.0 | 492.0 | 0.0 | 491.0 | 491.0 | 0.0 | 0.0 |
| flat | 500 | same-list | 1× | 3 | B01 | 3 | 0 | 2.0 | 499.0 | 499.0 | 497.0 | 2.0 | 0.0 | 0.0 | 500.0 | 0.0 | 498.0 | 0.0 | 497.0 | 497.0 | 0.0 | 0.0 |
| flat | 1000 | multi-select | 1× | 3 | B01 | 3 | 0 | 1.0 | 999.0 | 999.0 | 991.0 | 8.0 | 0.0 | 0.0 | 1000.0 | 0.0 | 992.0 | 0.0 | 991.0 | 3.0 | 0.0 | 988.0 |
| flat | 1000 | regrab | 1× | 3 | B02 | 3 | 0 | 4.0 | 999.0 | 999.0 | 991.0 | 8.0 | 0.0 | 0.0 | 1000.0 | 0.0 | 992.0 | 0.0 | 991.0 | 991.0 | 0.0 | 0.0 |
| flat | 1000 | same-list | 1× | 3 | B01 | 3 | 0 | 2.0 | 999.0 | 999.0 | 997.0 | 2.0 | 0.0 | 0.0 | 1000.0 | 0.0 | 998.0 | 0.0 | 997.0 | 997.0 | 0.0 | 0.0 |
| flat | 2000 | multi-select | 1× | 3 | B01 | 3 | 0 | 1.0 | 1999.0 | 1999.0 | 1991.0 | 8.0 | 0.0 | 0.0 | 2000.0 | 0.0 | 1992.0 | 0.0 | 1991.0 | 3.0 | 0.0 | 1988.0 |
| flat | 2000 | same-list | 1× | 3 | B01 | 3 | 0 | 2.0 | 1999.0 | 1999.0 | 1997.0 | 2.0 | 0.0 | 0.0 | 2000.0 | 0.0 | 1998.0 | 0.0 | 1997.0 | 1997.0 | 0.0 | 0.0 |
| flat-thumbnails | 50 | multi-select | 1× | 3 | B01 | 3 | 0 | 1.0 | 49.0 | 49.0 | 41.0 | 8.0 | 0.0 | 0.0 | 50.0 | 0.0 | 42.0 | 0.0 | 41.0 | 3.0 | 0.0 | 38.0 |
| flat-thumbnails | 50 | same-list | 1× | 3 | B01 | 3 | 0 | 2.0 | 49.0 | 49.0 | 47.0 | 2.0 | 0.0 | 0.0 | 50.0 | 0.0 | 48.0 | 0.0 | 47.0 | 47.0 | 0.0 | 0.0 |
| flat-thumbnails | 200 | multi-select | 1× | 3 | B01 | 3 | 0 | 1.0 | 199.0 | 199.0 | 191.0 | 8.0 | 0.0 | 0.0 | 200.0 | 0.0 | 192.0 | 0.0 | 191.0 | 3.0 | 0.0 | 188.0 |
| flat-thumbnails | 200 | same-list | 1× | 3 | B01 | 3 | 0 | 2.0 | 199.0 | 199.0 | 197.0 | 2.0 | 0.0 | 0.0 | 200.0 | 0.0 | 198.0 | 0.0 | 197.0 | 197.0 | 0.0 | 0.0 |
| flat-thumbnails | 500 | multi-select | 1× | 3 | B01 | 3 | 0 | 1.0 | 499.0 | 499.0 | 491.0 | 8.0 | 0.0 | 0.0 | 500.0 | 0.0 | 492.0 | 0.0 | 491.0 | 3.0 | 0.0 | 488.0 |
| flat-thumbnails | 500 | same-list | 1× | 3 | B01 | 3 | 0 | 2.0 | 499.0 | 499.0 | 497.0 | 2.0 | 0.0 | 0.0 | 500.0 | 0.0 | 498.0 | 0.0 | 497.0 | 497.0 | 0.0 | 0.0 |
| flat-thumbnails | 1000 | multi-select | 1× | 3 | B01 | 3 | 0 | 1.0 | 999.0 | 999.0 | 991.0 | 8.0 | 0.0 | 0.0 | 1000.0 | 0.0 | 992.0 | 0.0 | 991.0 | 3.0 | 0.0 | 988.0 |
| flat-thumbnails | 1000 | same-list | 1× | 3 | B01 | 3 | 0 | 2.0 | 999.0 | 999.0 | 997.0 | 2.0 | 0.0 | 0.0 | 1000.0 | 0.0 | 998.0 | 0.0 | 997.0 | 997.0 | 0.0 | 0.0 |
| flat-thumbnails | 2000 | multi-select | 1× | 3 | B01 | 3 | 0 | 1.0 | 1999.0 | 1999.0 | 1991.0 | 8.0 | 0.0 | 0.0 | 2000.0 | 0.0 | 1992.0 | 0.0 | 1991.0 | 3.0 | 0.0 | 1988.0 |
| flat-thumbnails | 2000 | same-list | 1× | 3 | B01 | 3 | 0 | 2.0 | 1999.0 | 1999.0 | 1997.0 | 2.0 | 0.0 | 0.0 | 2000.0 | 0.0 | 1998.0 | 0.0 | 1997.0 | 1997.0 | 0.0 | 0.0 |
| grouped | 50 | folded-context | 1× | 3 | B04 | 3 | 0 | 2.0 | 49.0 | 49.0 | 49.0 | 0.0 | 0.0 | 96.0 | 103.0 | 199.0 | 102.0 | 49.0 | 98.0 | 2.0 | 14.0 | 134.0 |
| grouped | 50 | grouped | 1× | 3 | B04 | 3 | 0 | 2.0 | 49.0 | 49.0 | 49.0 | 0.0 | 0.0 | 96.0 | 103.0 | 199.0 | 102.0 | 49.0 | 98.0 | 2.0 | 14.0 | 134.0 |
| grouped | 200 | folded-context | 1× | 3 | B04 | 3 | 0 | 2.0 | 199.0 | 199.0 | 199.0 | 0.0 | 0.0 | 390.0 | 253.0 | 649.0 | 252.0 | 199.0 | 398.0 | 8.0 | 14.0 | 428.0 |
| grouped | 200 | grouped | 1× | 3 | B04 | 3 | 0 | 2.0 | 199.0 | 199.0 | 199.0 | 0.0 | 0.0 | 390.0 | 253.0 | 649.0 | 252.0 | 199.0 | 398.0 | 8.0 | 14.0 | 428.0 |
| grouped | 500 | folded-context | 1× | 3 | B04 | 3 | 0 | 2.0 | 499.0 | 499.0 | 499.0 | 0.0 | 0.0 | 978.0 | 553.0 | 1549.0 | 552.0 | 499.0 | 998.0 | 20.0 | 14.0 | 1016.0 |
| grouped | 500 | grouped | 1× | 3 | B04 | 3 | 0 | 2.0 | 499.0 | 499.0 | 499.0 | 0.0 | 0.0 | 978.0 | 553.0 | 1549.0 | 552.0 | 499.0 | 998.0 | 20.0 | 14.0 | 1016.0 |
| grouped | 1000 | folded-context | 1× | 3 | B04 | 3 | 0 | 2.0 | 999.0 | 999.0 | 999.0 | 0.0 | 0.0 | 1958.0 | 1053.0 | 3049.0 | 1052.0 | 999.0 | 1998.0 | 40.0 | 14.0 | 1996.0 |
| grouped | 1000 | grouped | 1× | 3 | B04 | 3 | 0 | 2.0 | 999.0 | 999.0 | 999.0 | 0.0 | 0.0 | 1958.0 | 1053.0 | 3049.0 | 1052.0 | 999.0 | 1998.0 | 40.0 | 14.0 | 1996.0 |
| grouped | 2000 | folded-context | 1× | 3 | B04 | 3 | 0 | 2.0 | 1999.0 | 1999.0 | 1999.0 | 0.0 | 0.0 | 3916.0 | 2053.0 | 6049.0 | 2052.0 | 1999.0 | 3998.0 | 82.0 | 14.0 | 3954.0 |
| grouped | 2000 | grouped | 1× | 3 | B04 | 3 | 0 | 2.0 | 1999.0 | 1999.0 | 1999.0 | 0.0 | 0.0 | 3916.0 | 2053.0 | 6049.0 | 2052.0 | 1999.0 | 3998.0 | 82.0 | 14.0 | 3954.0 |
| kanban | 800 | cross-column | 1× | 3 | B01 | 3 | 0 | 2.0 | 399.0 | 399.0 | 399.0 | 0.0 | 0.0 | 0.0 | 401.0 | 0.0 | 401.0 | 0.0 | 399.0 | 199.0 | 0.0 | 200.0 |
| kanban | 800 | multi-select | 1× | 3 | B01 | 3 | 0 | 1.0 | 199.0 | 199.0 | 191.0 | 8.0 | 0.0 | 0.0 | 200.0 | 0.0 | 192.0 | 0.0 | 191.0 | 3.0 | 0.0 | 188.0 |
| kanban | 800 | same-list | 1× | 3 | B01 | 3 | 0 | 2.0 | 199.0 | 199.0 | 197.0 | 2.0 | 0.0 | 0.0 | 200.0 | 0.0 | 198.0 | 0.0 | 197.0 | 197.0 | 0.0 | 0.0 |
| canvas | 50 | canvas-node | 4× | 3 | B03 | 3 | 0 | 2.0 | 49.0 | 49.0 | 26.0 | 23.0 | 0.0 | 0.0 | 50.0 | 0.0 | 27.0 | 0.0 | 26.0 | 0.0 | 0.0 | 26.0 |
| canvas | 2000 | canvas-node | 4× | 3 | B03 | 3 | 0 | 2.0 | 1999.0 | 1999.0 | 1976.0 | 23.0 | 0.0 | 0.0 | 2000.0 | 0.0 | 1977.0 | 0.0 | 1976.0 | 0.0 | 0.0 | 1976.0 |
| flat | 50 | multi-select | 4× | 3 | B03 | 3 | 0 | 1.0 | 49.0 | 49.0 | 41.0 | 8.0 | 0.0 | 0.0 | 50.0 | 0.0 | 42.0 | 0.0 | 41.0 | 3.0 | 0.0 | 38.0 |
| flat | 50 | same-list | 4× | 3 | B03 | 3 | 0 | 2.0 | 49.0 | 49.0 | 47.0 | 2.0 | 0.0 | 0.0 | 50.0 | 0.0 | 48.0 | 0.0 | 47.0 | 47.0 | 0.0 | 0.0 |
| flat | 2000 | multi-select | 4× | 3 | B03 | 3 | 0 | 1.0 | 1999.0 | 1999.0 | 1991.0 | 8.0 | 0.0 | 0.0 | 2000.0 | 0.0 | 1992.0 | 0.0 | 1991.0 | 3.0 | 0.0 | 1988.0 |
| flat | 2000 | same-list | 4× | 3 | B03 | 3 | 0 | 2.0 | 1999.0 | 1999.0 | 1997.0 | 2.0 | 0.0 | 0.0 | 2000.0 | 0.0 | 1998.0 | 0.0 | 1997.0 | 1997.0 | 0.0 | 0.0 |
| flat-thumbnails | 50 | multi-select | 4× | 3 | B03 | 3 | 0 | 1.0 | 49.0 | 49.0 | 41.0 | 8.0 | 0.0 | 0.0 | 50.0 | 0.0 | 42.0 | 0.0 | 41.0 | 3.0 | 0.0 | 38.0 |
| flat-thumbnails | 50 | same-list | 4× | 3 | B03 | 3 | 0 | 2.0 | 49.0 | 49.0 | 47.0 | 2.0 | 0.0 | 0.0 | 50.0 | 0.0 | 48.0 | 0.0 | 47.0 | 47.0 | 0.0 | 0.0 |
| flat-thumbnails | 2000 | multi-select | 4× | 3 | B03 | 3 | 0 | 1.0 | 1999.0 | 1999.0 | 1991.0 | 8.0 | 0.0 | 0.0 | 2000.0 | 0.0 | 1992.0 | 0.0 | 1991.0 | 3.0 | 0.0 | 1988.0 |
| flat-thumbnails | 2000 | same-list | 4× | 3 | B03 | 3 | 0 | 2.0 | 1999.0 | 1999.0 | 1997.0 | 2.0 | 0.0 | 0.0 | 2000.0 | 0.0 | 1998.0 | 0.0 | 1997.0 | 1997.0 | 0.0 | 0.0 |
| grouped | 50 | folded-context | 4× | 3 | B05 | 3 | 0 | 2.0 | 49.0 | 49.0 | 49.0 | 0.0 | 0.0 | 96.0 | 103.0 | 199.0 | 102.0 | 49.0 | 98.0 | 2.0 | 14.0 | 134.0 |
| grouped | 50 | grouped | 4× | 3 | B05 | 3 | 0 | 2.0 | 49.0 | 49.0 | 49.0 | 0.0 | 0.0 | 96.0 | 103.0 | 199.0 | 102.0 | 49.0 | 98.0 | 2.0 | 14.0 | 134.0 |
| grouped | 2000 | folded-context | 4× | 3 | B05 | 3 | 0 | 2.0 | 1999.0 | 1999.0 | 1999.0 | 0.0 | 0.0 | 3916.0 | 2053.0 | 6049.0 | 2052.0 | 1999.0 | 3998.0 | 82.0 | 14.0 | 3954.0 |
| grouped | 2000 | grouped | 4× | 3 | B05 | 3 | 0 | 2.0 | 1999.0 | 1999.0 | 1999.0 | 0.0 | 0.0 | 3916.0 | 2053.0 | 6049.0 | 2052.0 | 1999.0 | 3998.0 | 82.0 | 14.0 | 3954.0 |
| kanban | 800 | cross-column | 4× | 3 | B03 | 3 | 0 | 2.0 | 399.0 | 399.0 | 399.0 | 0.0 | 0.0 | 0.0 | 401.0 | 0.0 | 401.0 | 0.0 | 399.0 | 199.0 | 0.0 | 200.0 |
| kanban | 800 | multi-select | 4× | 3 | B03 | 3 | 0 | 1.0 | 199.0 | 199.0 | 191.0 | 8.0 | 0.0 | 0.0 | 200.0 | 0.0 | 192.0 | 0.0 | 191.0 | 3.0 | 0.0 | 188.0 |
| kanban | 800 | same-list | 4× | 3 | B03 | 3 | 0 | 2.0 | 199.0 | 199.0 | 197.0 | 2.0 | 0.0 | 0.0 | 200.0 | 0.0 | 198.0 | 0.0 | 197.0 | 197.0 | 0.0 | 0.0 |
| canvas | 50 | canvas-node | 6× | 3 | B03 | 3 | 0 | 2.0 | 49.0 | 49.0 | 26.0 | 23.0 | 0.0 | 0.0 | 50.0 | 0.0 | 27.0 | 0.0 | 26.0 | 0.0 | 0.0 | 26.0 |
| canvas | 2000 | canvas-node | 6× | 3 | B03 | 3 | 0 | 2.0 | 1999.0 | 1999.0 | 1976.0 | 23.0 | 0.0 | 0.0 | 2000.0 | 0.0 | 1977.0 | 0.0 | 1976.0 | 0.0 | 0.0 | 1976.0 |
| flat | 50 | multi-select | 6× | 3 | B03 | 3 | 0 | 1.0 | 49.0 | 49.0 | 41.0 | 8.0 | 0.0 | 0.0 | 50.0 | 0.0 | 42.0 | 0.0 | 41.0 | 3.0 | 0.0 | 38.0 |
| flat | 50 | same-list | 6× | 3 | B03 | 3 | 0 | 2.0 | 49.0 | 49.0 | 47.0 | 2.0 | 0.0 | 0.0 | 50.0 | 0.0 | 48.0 | 0.0 | 47.0 | 47.0 | 0.0 | 0.0 |
| flat | 2000 | multi-select | 6× | 3 | B03 | 3 | 0 | 1.0 | 1999.0 | 1999.0 | 1991.0 | 8.0 | 0.0 | 0.0 | 2000.0 | 0.0 | 1992.0 | 0.0 | 1991.0 | 3.0 | 0.0 | 1988.0 |
| flat | 2000 | same-list | 6× | 3 | B03 | 3 | 0 | 2.0 | 1999.0 | 1999.0 | 1997.0 | 2.0 | 0.0 | 0.0 | 2000.0 | 0.0 | 1998.0 | 0.0 | 1997.0 | 1997.0 | 0.0 | 0.0 |
| flat-thumbnails | 50 | multi-select | 6× | 3 | B03 | 3 | 0 | 1.0 | 49.0 | 49.0 | 41.0 | 8.0 | 0.0 | 0.0 | 50.0 | 0.0 | 42.0 | 0.0 | 41.0 | 3.0 | 0.0 | 38.0 |
| flat-thumbnails | 50 | same-list | 6× | 3 | B03 | 3 | 0 | 2.0 | 49.0 | 49.0 | 47.0 | 2.0 | 0.0 | 0.0 | 50.0 | 0.0 | 48.0 | 0.0 | 47.0 | 47.0 | 0.0 | 0.0 |
| flat-thumbnails | 2000 | multi-select | 6× | 3 | B03 | 3 | 0 | 1.0 | 1999.0 | 1999.0 | 1991.0 | 8.0 | 0.0 | 0.0 | 2000.0 | 0.0 | 1992.0 | 0.0 | 1991.0 | 3.0 | 0.0 | 1988.0 |
| flat-thumbnails | 2000 | same-list | 6× | 3 | B03 | 3 | 0 | 2.0 | 1999.0 | 1999.0 | 1997.0 | 2.0 | 0.0 | 0.0 | 2000.0 | 0.0 | 1998.0 | 0.0 | 1997.0 | 1997.0 | 0.0 | 0.0 |
| grouped | 50 | folded-context | 6× | 3 | B05 | 3 | 0 | 2.0 | 49.0 | 49.0 | 49.0 | 0.0 | 0.0 | 96.0 | 103.0 | 199.0 | 102.0 | 49.0 | 98.0 | 2.0 | 14.0 | 134.0 |
| grouped | 50 | grouped | 6× | 3 | B05 | 3 | 0 | 2.0 | 49.0 | 49.0 | 49.0 | 0.0 | 0.0 | 96.0 | 103.0 | 199.0 | 102.0 | 49.0 | 98.0 | 2.0 | 14.0 | 134.0 |
| grouped | 2000 | folded-context | 6× | 3 | B05 | 3 | 0 | 2.0 | 1999.0 | 1999.0 | 1999.0 | 0.0 | 0.0 | 3916.0 | 2053.0 | 6049.0 | 2052.0 | 1999.0 | 3998.0 | 82.0 | 14.0 | 3954.0 |
| grouped | 2000 | grouped | 6× | 3 | B05 | 3 | 0 | 2.0 | 1999.0 | 1999.0 | 1999.0 | 0.0 | 0.0 | 3916.0 | 2053.0 | 6049.0 | 2052.0 | 1999.0 | 3998.0 | 82.0 | 14.0 | 3954.0 |
| kanban | 800 | cross-column | 6× | 3 | B03 | 3 | 0 | 2.0 | 399.0 | 399.0 | 399.0 | 0.0 | 0.0 | 0.0 | 401.0 | 0.0 | 401.0 | 0.0 | 399.0 | 199.0 | 0.0 | 200.0 |
| kanban | 800 | multi-select | 6× | 3 | B03 | 3 | 0 | 1.0 | 199.0 | 199.0 | 191.0 | 8.0 | 0.0 | 0.0 | 200.0 | 0.0 | 192.0 | 0.0 | 191.0 | 3.0 | 0.0 | 188.0 |
| kanban | 800 | same-list | 6× | 3 | B03 | 3 | 0 | 2.0 | 199.0 | 199.0 | 197.0 | 2.0 | 0.0 | 0.0 | 200.0 | 0.0 | 198.0 | 0.0 | 197.0 | 197.0 | 0.0 | 0.0 |

### 两个可定位的成本读数

- canvas / 2000 / 6×：Runtime 的 commit 为 128.3 ms，dnd-kit 为 2.0 ms（仅列观测值，不作等功能胜负判断）。Runtime 末笔 FLIP telemetry 为 measuredCardVisits 1976.0、animatedCardEntries 0.0、tinyDeltaSkipped 1976.0；说明该样本测量了很多卡片，但没有卡片动画条目。
- flat / 2000 / same-list / 1×：eligibleCards 1997.0、animatedCardEntries 1997.0、rangeSkipped 2.0；该样本中参与者范围几乎覆盖全部 eligible 卡片。
