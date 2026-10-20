# Interaction Runtime 拖拽性能基准

> 合成基准与真实 Gugu-web 页面验证分开报告。Runtime 完整功能与 dnd-kit 的能力集合不同，表格只呈现观测值，不把差异归因于实现效率，也不宣称等功能公平胜负。

## 数据来源批次

> 主表与 telemetry 表每行的“来源批次”列指向下表。批次时间取自原始 trace 文件名；旧 trace 未记录 Git revision，不能据此证明旧批之间代码完全一致。新 runner 会记录 revision 和 worktree dirty 状态。汇总对同一条件/重复编号采用最新有效 trace，因此新 grouped 批次替换了旧 grouped 行；旧数值仍保留在 raw 文件中，但不参与当前汇总。

| 批次 | UTC 时间 | 纳入有效样本 | 条件数 | Git revision | dirty |
|---|---|---:|---:|---|---|
| B01 | 2026-10-20T09:43:01.307Z | 6 | 1 | a90d23a | true |
| B02 | 2026-10-20T10:19:41.542Z | 228 | 38 | 66ae66d | true |
| B03 | 2026-10-20T10:26:35.698Z | 12 | 4 | 66ae66d | true |
| B04 | 2026-10-20T10:26:58.416Z | 204 | 34 | 66ae66d | true |

### 已记录的失败尝试

| Run | 样本 | 结果 | revision / dirty | 错误与诊断 | Trace |
|---|---|---|---|---|---|
| 2026-10-20T08-30-08-108Z | flat-2000-regrab-runtime-cpu1-r1 | failed | 76dec47 / true | TimeoutError: page.waitForFunction: Timeout 60000ms exceeded.; {"status":"dragging","proxies":0,"samples":0,"actions":[]} | docs/reports/raw/flat-2000-regrab-runtime-cpu1-r1-2026-10-20T08-30-08-108Z.json.gz |
| 2026-10-20T09-42-03-422Z | flat-2000-same-list-dnd-kit-cpu6-r1 | failed | a90d23a / true | TimeoutError: page.goto: Timeout 30000ms exceeded. Call log: - navigating to "http://127.0.0.1:5197/benchmark?scenario=flat&count=2000&interaction=same-list&implementation=dnd-kit&run=flat-2000-same-list-dnd-kit-cpu6-r1", waiting until "load"; 无诊断 | — |

## 环境与方法

- 合成基准：Apple M2，8 核，16 GB；darwin/arm64；Node v22.23.2；Chromium 151.0.7922.34。默认由 Playwright Headless Chromium 运行。
- 场景：flat 扁平列表、flat-thumbnails 缩略图列表、kanban 看板、grouped 分组、canvas 画布；看板固定 800 张卡。
- 每个条件按 3 次以上有效样本的中位数汇总；Runtime 与 dnd-kit 交错执行。未完成提交、settle 超时、缺少帧采样或阶段时间的样本全部剔除，不插补。
- `inputMs` = pointerdown→pointerup；`commitMs` = pointerup→DOM commit-end。`inputMs` 是脚本输入段墙钟时间：拖动由 12 个 rAF-paced CDP 步骤驱动，会被主线程负载和帧调度放大，不等于 Event Timing 输入延迟。`settleMs` 是实现各自稳定检测 race 的返回值，受动画和检测窗口影响，不稳定且不可跨实现比较；本报告不把它作为对外结论，也不将阶段相加为总耗时。
- `>24ms 帧 %` = pointerdown 至视觉稳定期间 rAF 间隔超过 24ms 的比例；每个样本必须有帧数据才进入汇总。
- Drag Interaction P98 暂不进入对外汇总：本次 371 个有值原始样本中，354 个等于 Event Timing max，P98 不能代表重复交互分布。Event Timing 汇总行缺测：dnd-kit 19/73，runtime 0/77；原始样本缺测：dnd-kit 79/219，runtime 0/231。缺测记为 —，不代表 0。
- Long Tasks 是测量窗口内浏览器 Long Tasks 条目数；它不等价于卡顿次数，且不能单独代表交互质量。
- `regrab` 是 Runtime 特有的落位代理再抓取能力；dnd-kit 无对应操作，因此保留 flat 50/200/500/1000 @1× 的 Runtime 单边行但不作横向比较。2000 项目前没有成功样本：唯一保留的 2000-regrab 实跑失败并已列在“已记录的失败尝试”，不纳入有效样本。
- grouped/50/grouped/1× 的历史记录（raw run 2026-10-20T02-08-31-456Z）中位数为：dnd-kit 172.7 ms、Runtime 170.9 ms；本次汇总值为 dnd-kit 417.4 ms、Runtime 416.1 ms（来源 B02）。该历史 run 中目标月份处于折叠状态，而当前 grouped 夹具未折叠，因此两批的场景语义也不同；时间、源码状态和场景定义均不一致，只能说明输入段墙钟读数变化，不能据此归因于某项代码变更。旧 trace 保留在 raw 中，不参与当前统计。
- 三轮新增完整运行对应批次 B02–B04，manifest 记录 revision 66ae66d、dirty=true；历史批次 B01 的 revision 是 a90d23a，早于视口裁剪优化。manifest 仅记录 dirty 布尔值，没有记录工作树差异路径，因此无法证实 dirty 差异仅来自真实页面 smoke 产物；这里不推断具体来源。更早 raw trace 的 revision 信息不完整，不按文件修改时间推断逐样本源码边界。
- 合成 fixture 不等同于真实产品 DOM。完整 Runtime 含 dnd-kit 基线没有的代理、布局联动及 Surface 行为；没有 runtime-minus 消融对照前，不应将总耗时差解释为核心算法效率差异。CPU 节流是 CDP 模拟，不代表真实低配设备。

## 真实页面验证

真实 Gugu-web 看板页面 smoke：通过；80 张卡片；Chromium 151.0.7922.34 (headless)；源码 66ae66d；生成于 2026-10-20T10:19:36.532Z。使用真实 Vue 卡片和样式，API 由浏览器测试 mock，避免写入业务数据。该项验证交互/DOM 集成，不与合成基准计时混算。见 real-page-smoke.json。

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
| canvas | 50 | canvas-node | 1× | dnd-kit | 3 | B02 | 415.5 | 1.0 | 0.0 | — | 0.0 |
| canvas | 50 | canvas-node | 1× | runtime | 3 | B02 | 421.8 | 1.5 | 0.0 | 24.0 | 0.0 |
| canvas | 200 | canvas-node | 1× | dnd-kit | 3 | B02 | 409.2 | 0.5 | 0.0 | — | 0.0 |
| canvas | 200 | canvas-node | 1× | runtime | 3 | B02 | 422.2 | 1.8 | 0.0 | 24.0 | 0.0 |
| canvas | 500 | canvas-node | 1× | dnd-kit | 3 | B02 | 413.8 | 0.6 | 0.0 | — | 0.0 |
| canvas | 500 | canvas-node | 1× | runtime | 3 | B02 | 412.6 | 3.4 | 0.0 | 24.0 | 0.0 |
| canvas | 1000 | canvas-node | 1× | dnd-kit | 3 | B02 | 430.6 | 0.8 | 0.0 | — | 0.0 |
| canvas | 1000 | canvas-node | 1× | runtime | 3 | B02 | 418.2 | 5.3 | 0.0 | 32.0 | 0.0 |
| canvas | 2000 | canvas-node | 1× | dnd-kit | 3 | B02 | 466.2 | 4.0 | 4.2 | — | 1.0 |
| canvas | 2000 | canvas-node | 1× | runtime | 3 | B02 | 419.7 | 9.8 | 0.0 | 40.0 | 0.0 |
| flat | 50 | multi-select | 1× | dnd-kit | 3 | B02 | 415.2 | 2.3 | 0.0 | 24.0 | 0.0 |
| flat | 50 | multi-select | 1× | runtime | 3 | B02 | 437.6 | 1.6 | 0.0 | 40.0 | 0.0 |
| flat | 50 | regrab | 1× | runtime | 3 | B03 | 649.7 | 2.5 | 0.0 | 24.0 | 0.0 |
| flat | 50 | same-list | 1× | dnd-kit | 3 | B02 | 423.7 | 1.5 | 0.0 | 16.0 | 0.0 |
| flat | 50 | same-list | 1× | runtime | 3 | B02 | 421.1 | 1.3 | 0.0 | 24.0 | 0.0 |
| flat | 200 | multi-select | 1× | dnd-kit | 3 | B02 | 412.4 | 2.8 | 0.0 | 32.0 | 0.0 |
| flat | 200 | multi-select | 1× | runtime | 3 | B02 | 437.7 | 2.8 | 0.0 | 40.0 | 0.0 |
| flat | 200 | regrab | 1× | runtime | 3 | B03 | 656.7 | 3.0 | 0.0 | 32.0 | 0.0 |
| flat | 200 | same-list | 1× | dnd-kit | 3 | B02 | 413.3 | 2.3 | 0.0 | 16.0 | 0.0 |
| flat | 200 | same-list | 1× | runtime | 3 | B02 | 414.1 | 2.3 | 0.0 | 24.0 | 0.0 |
| flat | 500 | multi-select | 1× | dnd-kit | 3 | B02 | 436.0 | 4.8 | 0.0 | 32.0 | 0.0 |
| flat | 500 | multi-select | 1× | runtime | 3 | B02 | 448.9 | 5.0 | 0.0 | 64.0 | 0.0 |
| flat | 500 | regrab | 1× | runtime | 3 | B03 | 673.4 | 4.4 | 0.0 | 32.0 | 0.0 |
| flat | 500 | same-list | 1× | dnd-kit | 3 | B02 | 416.7 | 4.1 | 0.0 | 24.0 | 0.0 |
| flat | 500 | same-list | 1× | runtime | 3 | B02 | 416.2 | 3.9 | 0.0 | 24.0 | 0.0 |
| flat | 1000 | multi-select | 1× | dnd-kit | 3 | B02 | 448.2 | 7.1 | 2.4 | 40.0 | 0.0 |
| flat | 1000 | multi-select | 1× | runtime | 3 | B02 | 459.4 | 8.4 | 1.8 | 64.0 | 0.0 |
| flat | 1000 | regrab | 1× | runtime | 3 | B03 | 670.9 | 7.5 | 0.0 | 32.0 | 0.0 |
| flat | 1000 | same-list | 1× | dnd-kit | 3 | B02 | 453.4 | 6.5 | 2.4 | 24.0 | 0.0 |
| flat | 1000 | same-list | 1× | runtime | 3 | B02 | 415.0 | 7.3 | 0.0 | 40.0 | 0.0 |
| flat | 2000 | multi-select | 1× | dnd-kit | 3 | B02 | 569.3 | 12.8 | 2.1 | 32.0 | 1.0 |
| flat | 2000 | multi-select | 1× | runtime | 3 | B02 | 421.2 | 14.2 | 1.9 | 64.0 | 0.0 |
| flat | 2000 | same-list | 1× | dnd-kit | 3 | B02 | 527.1 | 8.6 | 2.4 | 24.0 | 1.0 |
| flat | 2000 | same-list | 1× | runtime | 3 | B02 | 415.9 | 12.6 | 2.2 | 56.0 | 0.0 |
| flat-thumbnails | 50 | multi-select | 1× | dnd-kit | 3 | B02 | 422.0 | 2.0 | 0.0 | 24.0 | 0.0 |
| flat-thumbnails | 50 | multi-select | 1× | runtime | 3 | B02 | 437.0 | 1.6 | 0.0 | 40.0 | 0.0 |
| flat-thumbnails | 50 | same-list | 1× | dnd-kit | 3 | B02 | 418.2 | 2.1 | 0.0 | 24.0 | 0.0 |
| flat-thumbnails | 50 | same-list | 1× | runtime | 3 | B02 | 414.8 | 1.4 | 0.0 | 24.0 | 0.0 |
| flat-thumbnails | 200 | multi-select | 1× | dnd-kit | 3 | B02 | 419.2 | 2.8 | 0.0 | 32.0 | 0.0 |
| flat-thumbnails | 200 | multi-select | 1× | runtime | 3 | B02 | 427.0 | 3.0 | 0.0 | 40.0 | 0.0 |
| flat-thumbnails | 200 | same-list | 1× | dnd-kit | 3 | B02 | 411.8 | 2.4 | 0.0 | 16.0 | 0.0 |
| flat-thumbnails | 200 | same-list | 1× | runtime | 3 | B02 | 412.1 | 2.5 | 0.0 | 24.0 | 0.0 |
| flat-thumbnails | 500 | multi-select | 1× | dnd-kit | 3 | B02 | 438.3 | 5.7 | 0.0 | 32.0 | 0.0 |
| flat-thumbnails | 500 | multi-select | 1× | runtime | 3 | B02 | 439.0 | 4.9 | 0.0 | 40.0 | 0.0 |
| flat-thumbnails | 500 | same-list | 1× | dnd-kit | 3 | B02 | 423.1 | 3.2 | 0.0 | 24.0 | 0.0 |
| flat-thumbnails | 500 | same-list | 1× | runtime | 3 | B02 | 417.7 | 4.2 | 0.0 | 24.0 | 0.0 |
| flat-thumbnails | 1000 | multi-select | 1× | dnd-kit | 3 | B02 | 465.5 | 8.0 | 2.3 | 32.0 | 0.0 |
| flat-thumbnails | 1000 | multi-select | 1× | runtime | 3 | B02 | 428.9 | 8.2 | 0.0 | 64.0 | 0.0 |
| flat-thumbnails | 1000 | same-list | 1× | dnd-kit | 3 | B02 | 433.9 | 5.1 | 2.4 | 24.0 | 0.0 |
| flat-thumbnails | 1000 | same-list | 1× | runtime | 3 | B02 | 409.1 | 7.1 | 0.0 | 40.0 | 0.0 |
| flat-thumbnails | 2000 | multi-select | 1× | dnd-kit | 3 | B02 | 601.6 | 13.0 | 2.2 | 40.0 | 1.0 |
| flat-thumbnails | 2000 | multi-select | 1× | runtime | 3 | B02 | 425.5 | 14.5 | 1.8 | 64.0 | 0.0 |
| flat-thumbnails | 2000 | same-list | 1× | dnd-kit | 3 | B02 | 513.7 | 10.7 | 2.3 | 32.0 | 1.0 |
| flat-thumbnails | 2000 | same-list | 1× | runtime | 3 | B02 | 410.5 | 13.0 | 2.2 | 56.0 | 0.0 |
| grouped | 50 | folded-context | 1× | dnd-kit | 3 | B02 | 416.8 | 2.8 | 0.0 | 24.0 | 0.0 |
| grouped | 50 | folded-context | 1× | runtime | 3 | B02 | 416.7 | 1.5 | 0.0 | 24.0 | 0.0 |
| grouped | 50 | grouped | 1× | dnd-kit | 3 | B02 | 417.4 | 3.4 | 0.0 | 24.0 | 0.0 |
| grouped | 50 | grouped | 1× | runtime | 3 | B02 | 416.1 | 1.4 | 0.0 | 24.0 | 0.0 |
| grouped | 200 | folded-context | 1× | dnd-kit | 3 | B02 | 416.7 | 3.1 | 0.0 | 24.0 | 0.0 |
| grouped | 200 | folded-context | 1× | runtime | 3 | B02 | 416.4 | 2.3 | 0.0 | 24.0 | 0.0 |
| grouped | 200 | grouped | 1× | dnd-kit | 3 | B02 | 423.6 | 3.0 | 0.0 | 24.0 | 0.0 |
| grouped | 200 | grouped | 1× | runtime | 3 | B02 | 410.4 | 2.5 | 0.0 | 24.0 | 0.0 |
| grouped | 500 | folded-context | 1× | dnd-kit | 3 | B02 | 418.3 | 4.8 | 0.0 | 24.0 | 0.0 |
| grouped | 500 | folded-context | 1× | runtime | 3 | B02 | 414.1 | 3.8 | 0.0 | 40.0 | 0.0 |
| grouped | 500 | grouped | 1× | dnd-kit | 3 | B02 | 430.2 | 5.5 | 0.0 | 24.0 | 0.0 |
| grouped | 500 | grouped | 1× | runtime | 3 | B02 | 421.5 | 3.9 | 0.0 | 40.0 | 0.0 |
| grouped | 1000 | folded-context | 1× | dnd-kit | 3 | B02 | 466.1 | 14.2 | 2.4 | 32.0 | 0.0 |
| grouped | 1000 | folded-context | 1× | runtime | 3 | B02 | 416.1 | 6.1 | 0.0 | 40.0 | 0.0 |
| grouped | 1000 | grouped | 1× | dnd-kit | 3 | B02 | 455.2 | 13.3 | 4.0 | — | 0.0 |
| grouped | 1000 | grouped | 1× | runtime | 3 | B02 | 410.0 | 6.4 | 0.0 | 40.0 | 0.0 |
| grouped | 2000 | folded-context | 1× | dnd-kit | 3 | B02 | 522.1 | 22.2 | 3.7 | 48.0 | 1.0 |
| grouped | 2000 | folded-context | 1× | runtime | 3 | B02 | 432.5 | 12.9 | 2.1 | 56.0 | 0.0 |
| grouped | 2000 | grouped | 1× | dnd-kit | 3 | B02 | 503.8 | 23.3 | 3.8 | 48.0 | 1.0 |
| grouped | 2000 | grouped | 1× | runtime | 3 | B02 | 430.9 | 13.4 | 4.3 | 56.0 | 0.0 |
| kanban | 800 | cross-column | 1× | dnd-kit | 3 | B02 | 450.4 | 1.0 | 2.4 | 24.0 | 0.0 |
| kanban | 800 | cross-column | 1× | runtime | 3 | B02 | 414.1 | 11.1 | 0.0 | 24.0 | 0.0 |
| kanban | 800 | multi-select | 1× | dnd-kit | 3 | B02 | 444.6 | 3.6 | 2.4 | 40.0 | 0.0 |
| kanban | 800 | multi-select | 1× | runtime | 3 | B02 | 414.6 | 4.5 | 0.0 | 24.0 | 0.0 |
| kanban | 800 | same-list | 1× | dnd-kit | 3 | B02 | 433.8 | 2.2 | 0.0 | 16.0 | 0.0 |
| kanban | 800 | same-list | 1× | runtime | 3 | B02 | 420.3 | 4.0 | 0.0 | 24.0 | 0.0 |
| canvas | 50 | canvas-node | 4× | dnd-kit | 3 | B04 | 412.5 | 1.8 | 0.0 | — | 0.0 |
| canvas | 50 | canvas-node | 4× | runtime | 3 | B04 | 407.6 | 4.1 | 0.0 | 24.0 | 0.0 |
| canvas | 2000 | canvas-node | 4× | dnd-kit | 3 | B04 | 754.9 | 1.5 | 6.7 | — | 1.0 |
| canvas | 2000 | canvas-node | 4× | runtime | 3 | B04 | 652.9 | 33.2 | 10.0 | 120.0 | 2.0 |
| flat | 50 | multi-select | 4× | dnd-kit | 3 | B04 | 431.9 | 8.2 | 0.0 | 32.0 | 0.0 |
| flat | 50 | multi-select | 4× | runtime | 3 | B04 | 447.5 | 6.9 | 1.8 | 56.0 | 0.0 |
| flat | 50 | same-list | 4× | dnd-kit | 3 | B04 | 424.3 | 4.2 | 0.0 | 24.0 | 0.0 |
| flat | 50 | same-list | 4× | runtime | 3 | B04 | 417.4 | 5.4 | 0.0 | 40.0 | 0.0 |
| flat | 2000 | multi-select | 4× | dnd-kit | 3 | B04 | 1576.4 | 49.3 | 24.2 | 144.0 | 11.0 |
| flat | 2000 | multi-select | 4× | runtime | 3 | B04 | 495.7 | 60.9 | 31.8 | 256.0 | 4.0 |
| flat | 2000 | same-list | 4× | dnd-kit | 3 | B04 | 1041.9 | 30.8 | 5.0 | — | 3.0 |
| flat | 2000 | same-list | 4× | runtime | 3 | B04 | 539.1 | 46.6 | 8.3 | 232.0 | 3.0 |
| flat-thumbnails | 50 | multi-select | 4× | dnd-kit | 3 | B04 | 439.1 | 7.5 | 0.0 | 32.0 | 0.0 |
| flat-thumbnails | 50 | multi-select | 4× | runtime | 3 | B04 | 449.5 | 6.8 | 0.0 | 56.0 | 0.0 |
| flat-thumbnails | 50 | same-list | 4× | dnd-kit | 3 | B04 | 424.8 | 5.1 | 0.0 | 24.0 | 0.0 |
| flat-thumbnails | 50 | same-list | 4× | runtime | 3 | B04 | 416.7 | 5.6 | 0.0 | 40.0 | 0.0 |
| flat-thumbnails | 2000 | multi-select | 4× | dnd-kit | 3 | B04 | 1646.4 | 51.3 | 30.5 | 168.0 | 12.0 |
| flat-thumbnails | 2000 | multi-select | 4× | runtime | 3 | B04 | 508.4 | 62.3 | 28.3 | 240.0 | 3.0 |
| flat-thumbnails | 2000 | same-list | 4× | dnd-kit | 3 | B04 | 1045.0 | 31.6 | 5.1 | — | 3.0 |
| flat-thumbnails | 2000 | same-list | 4× | runtime | 3 | B04 | 575.0 | 48.6 | 8.2 | 224.0 | 3.0 |
| grouped | 50 | folded-context | 4× | dnd-kit | 3 | B04 | 427.7 | 8.0 | 2.5 | 24.0 | 0.0 |
| grouped | 50 | folded-context | 4× | runtime | 3 | B04 | 415.2 | 5.4 | 0.0 | 40.0 | 0.0 |
| grouped | 50 | grouped | 4× | dnd-kit | 3 | B04 | 451.4 | 9.2 | 3.8 | 32.0 | 0.0 |
| grouped | 50 | grouped | 4× | runtime | 3 | B04 | 420.0 | 7.1 | 0.0 | 40.0 | 0.0 |
| grouped | 2000 | folded-context | 4× | dnd-kit | 3 | B04 | 1086.0 | 75.1 | 9.8 | — | 3.0 |
| grouped | 2000 | folded-context | 4× | runtime | 3 | B04 | 562.8 | 42.2 | 8.2 | 216.0 | 3.0 |
| grouped | 2000 | grouped | 4× | dnd-kit | 3 | B04 | 1066.7 | 71.0 | 10.3 | — | 3.0 |
| grouped | 2000 | grouped | 4× | runtime | 3 | B04 | 614.1 | 46.5 | 10.2 | 216.0 | 3.0 |
| kanban | 800 | cross-column | 4× | dnd-kit | 3 | B04 | 767.5 | 3.9 | 6.0 | 32.0 | 2.0 |
| kanban | 800 | cross-column | 4× | runtime | 3 | B04 | 426.7 | 41.8 | 2.1 | 80.0 | 1.0 |
| kanban | 800 | multi-select | 4× | dnd-kit | 3 | B04 | 710.5 | 11.2 | 3.9 | 40.0 | 1.0 |
| kanban | 800 | multi-select | 4× | runtime | 3 | B04 | 419.4 | 17.1 | 1.9 | 56.0 | 0.0 |
| kanban | 800 | same-list | 4× | dnd-kit | 3 | B04 | 606.7 | 7.5 | 2.3 | 48.0 | 1.0 |
| kanban | 800 | same-list | 4× | runtime | 3 | B04 | 422.8 | 14.0 | 0.0 | 48.0 | 0.0 |
| canvas | 50 | canvas-node | 6× | dnd-kit | 3 | B04 | 425.3 | 3.1 | 4.2 | — | 0.0 |
| canvas | 50 | canvas-node | 6× | runtime | 3 | B04 | 414.4 | 7.1 | 0.0 | 32.0 | 0.0 |
| canvas | 2000 | canvas-node | 6× | dnd-kit | 3 | B04 | 928.0 | 2.7 | 6.5 | — | 2.0 |
| canvas | 2000 | canvas-node | 6× | runtime | 3 | B04 | 905.9 | 48.0 | 43.5 | 192.0 | 5.0 |
| flat | 50 | multi-select | 6× | dnd-kit | 3 | B04 | 478.3 | 10.5 | 2.3 | 32.0 | 0.0 |
| flat | 50 | multi-select | 6× | runtime | 3 | B04 | 432.1 | 10.6 | 0.0 | 56.0 | 0.0 |
| flat | 50 | same-list | 6× | dnd-kit | 3 | B04 | 460.7 | 5.8 | 2.3 | 24.0 | 0.0 |
| flat | 50 | same-list | 6× | runtime | 3 | B04 | 424.3 | 8.3 | 0.0 | 48.0 | 0.0 |
| flat | 500 | same-list | 6× | dnd-kit | 3 | B01 | 792.0 | 21.5 | 9.3 | 64.0 | 2.0 |
| flat | 500 | same-list | 6× | runtime | 3 | B01 | 754.7 | 26.1 | 16.7 | 240.0 | 5.0 |
| flat | 2000 | multi-select | 6× | dnd-kit | 3 | B04 | 2135.5 | 76.4 | 77.8 | 240.0 | 12.0 |
| flat | 2000 | multi-select | 6× | runtime | 3 | B04 | 575.7 | 92.5 | 37.8 | 360.0 | 4.0 |
| flat | 2000 | same-list | 6× | dnd-kit | 3 | B04 | 1568.8 | 42.3 | 16.7 | — | 4.0 |
| flat | 2000 | same-list | 6× | runtime | 3 | B04 | 617.3 | 67.8 | 8.9 | 336.0 | 3.0 |
| flat-thumbnails | 50 | multi-select | 6× | dnd-kit | 3 | B04 | 501.7 | 11.6 | 4.5 | 32.0 | 0.0 |
| flat-thumbnails | 50 | multi-select | 6× | runtime | 3 | B04 | 422.7 | 12.5 | 0.0 | 56.0 | 0.0 |
| flat-thumbnails | 50 | same-list | 6× | dnd-kit | 3 | B04 | 464.9 | 7.0 | 2.4 | 24.0 | 0.0 |
| flat-thumbnails | 50 | same-list | 6× | runtime | 3 | B04 | 418.9 | 8.5 | 0.0 | 48.0 | 0.0 |
| flat-thumbnails | 2000 | multi-select | 6× | dnd-kit | 3 | B04 | 2536.3 | 79.5 | 73.0 | 256.0 | 16.0 |
| flat-thumbnails | 2000 | multi-select | 6× | runtime | 3 | B04 | 681.9 | 96.7 | 30.8 | 360.0 | 5.0 |
| flat-thumbnails | 2000 | same-list | 6× | dnd-kit | 3 | B04 | 1536.4 | 52.8 | 18.2 | — | 4.0 |
| flat-thumbnails | 2000 | same-list | 6× | runtime | 3 | B04 | 684.1 | 72.4 | 9.6 | 352.0 | 5.0 |
| grouped | 50 | folded-context | 6× | dnd-kit | 3 | B04 | 465.6 | 12.4 | 3.8 | 24.0 | 1.0 |
| grouped | 50 | folded-context | 6× | runtime | 3 | B04 | 448.2 | 9.9 | 2.1 | 56.0 | 0.0 |
| grouped | 50 | grouped | 6× | dnd-kit | 3 | B04 | 504.6 | 13.0 | 3.6 | 36.0 | 1.0 |
| grouped | 50 | grouped | 6× | runtime | 3 | B04 | 451.8 | 9.8 | 4.2 | 56.0 | 0.0 |
| grouped | 2000 | folded-context | 6× | dnd-kit | 3 | B04 | 1378.0 | 104.5 | 12.2 | — | 4.0 |
| grouped | 2000 | folded-context | 6× | runtime | 3 | B04 | 678.6 | 59.8 | 10.9 | 296.0 | 5.0 |
| grouped | 2000 | grouped | 6× | dnd-kit | 3 | B04 | 1545.0 | 114.5 | 20.5 | — | 4.0 |
| grouped | 2000 | grouped | 6× | runtime | 3 | B04 | 747.5 | 65.1 | 7.7 | 328.0 | 5.0 |
| kanban | 800 | cross-column | 6× | dnd-kit | 3 | B04 | 1129.9 | 3.7 | 9.3 | — | 3.0 |
| kanban | 800 | cross-column | 6× | runtime | 3 | B04 | 451.0 | 57.0 | 4.2 | 112.0 | 1.0 |
| kanban | 800 | multi-select | 6× | dnd-kit | 3 | B04 | 1174.3 | 20.0 | 20.6 | 88.0 | 4.0 |
| kanban | 800 | multi-select | 6× | runtime | 3 | B04 | 435.6 | 25.5 | 7.4 | 88.0 | 0.0 |
| kanban | 800 | same-list | 6× | dnd-kit | 3 | B04 | 729.5 | 12.2 | 8.3 | 64.0 | 1.0 |
| kanban | 800 | same-list | 6× | runtime | 3 | B04 | 455.7 | 21.6 | 4.3 | 72.0 | 0.0 |

实现汇总行数：150；不同场景条件数：77；纳入汇总的有效重复样本：450。每行至少 3 个有效重复样本。

## Runtime Layout FLIP telemetry

> Runtime 内部观测；dnd-kit 不提供该 telemetry，因此不作实现间比较。每个拖拽样本记录 telemetry 发布计数的增量，并展示最后一笔已发布事务的字段快照；事务数是本次样本新增的发布笔数，不将末笔字段误称为整次交互总量。无新增事务记为 —，字段值为 0 则保留为 0。以下是 headless 合成 fixture 数据；真实页面与 headed 数据须分开呈现。
> 这些计数用于解释参与者筛选和测量行为，不用于推导耗时优势。`grouped` 是未折叠基线，`folded-context` 才会折叠第 12 个月份，两者应在相同规模和节流条件下对照阅读。当前合成 fixture 未提供 `[data-scroll-viewport]`，因此 `offscreenSkipped=0` 不表示没有卡片被视口裁剪；视口裁剪路径未覆盖。
> `candidateCards` / `capturedCards` / `eligibleCards` 是卡片参与者计数；`rangeSkipped`、`offscreenSkipped` 是筛选计数。`parentInheritedCardEvents` 汇总参与者继承跳过与 Relative FLIP 父级位移继承事件，并非去重卡片数。`measuredCardVisits`、`animatedCardEntries` 是处理/动画计划条目数，不是去重 DOM 卡片数；分组与叶子处理可能重复计入。`tinyDeltaSkipped` 汇总卡片与组元素的跳过事件；`animatedGroups` 是组元素条目数。
> 本轮 6/9 对 grouped/folded-context 的末笔 telemetry 字段完全相同；其中 50 项档有 3/3 对存在细微差异，200 项及以上档位有 6/6 对完全相同。

| 场景 | 项数 | 交互 | CPU× | n | 来源批次 | telemetry n | 缺测 n | 新增事务数（中位数） | candidateCards | capturedCards | eligibleCards | rangeSkipped | offscreenSkipped | parentInheritedCardEvents | captureReads | captureCacheHits | playReads | playCacheHits | measuredCardVisits | animatedCardEntries | animatedGroups | tinyDeltaSkipped |
|---|---:|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| canvas | 50 | canvas-node | 1× | 3 | B02 | 3 | 0 | 2.0 | 49.0 | 0.0 | 0.0 | 49.0 | 0.0 | 0.0 | 1.0 | 1.0 | 1.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| canvas | 200 | canvas-node | 1× | 3 | B02 | 3 | 0 | 2.0 | 199.0 | 0.0 | 0.0 | 199.0 | 0.0 | 0.0 | 1.0 | 1.0 | 1.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| canvas | 500 | canvas-node | 1× | 3 | B02 | 3 | 0 | 2.0 | 499.0 | 0.0 | 0.0 | 499.0 | 0.0 | 0.0 | 1.0 | 1.0 | 1.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| canvas | 1000 | canvas-node | 1× | 3 | B02 | 3 | 0 | 2.0 | 999.0 | 0.0 | 0.0 | 999.0 | 0.0 | 0.0 | 1.0 | 1.0 | 1.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| canvas | 2000 | canvas-node | 1× | 3 | B02 | 3 | 0 | 2.0 | 1999.0 | 0.0 | 0.0 | 1999.0 | 0.0 | 0.0 | 1.0 | 1.0 | 1.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| flat | 50 | multi-select | 1× | 3 | B02 | 3 | 0 | 1.0 | 49.0 | 49.0 | 22.0 | 8.0 | 19.0 | 0.0 | 50.0 | 1.0 | 23.0 | 0.0 | 22.0 | 3.0 | 0.0 | 19.0 |
| flat | 50 | regrab | 1× | 3 | B03 | 3 | 0 | 3.0 | 49.0 | 31.0 | 31.0 | 18.0 | 0.0 | 0.0 | 34.0 | 10.0 | 32.0 | 0.0 | 31.0 | 0.0 | 0.0 | 31.0 |
| flat | 50 | same-list | 1× | 3 | B02 | 3 | 0 | 2.0 | 49.0 | 49.0 | 29.0 | 2.0 | 18.0 | 0.0 | 50.0 | 1.0 | 30.0 | 0.0 | 29.0 | 29.0 | 0.0 | 0.0 |
| flat | 200 | multi-select | 1× | 3 | B02 | 3 | 0 | 1.0 | 199.0 | 199.0 | 22.0 | 8.0 | 169.0 | 0.0 | 200.0 | 1.0 | 23.0 | 0.0 | 22.0 | 3.0 | 0.0 | 19.0 |
| flat | 200 | regrab | 1× | 3 | B03 | 3 | 0 | 3.0 | 199.0 | 31.0 | 31.0 | 168.0 | 0.0 | 0.0 | 36.0 | 12.0 | 32.0 | 0.0 | 31.0 | 0.0 | 0.0 | 31.0 |
| flat | 200 | same-list | 1× | 3 | B02 | 3 | 0 | 2.0 | 199.0 | 199.0 | 29.0 | 2.0 | 168.0 | 0.0 | 200.0 | 1.0 | 30.0 | 0.0 | 29.0 | 29.0 | 0.0 | 0.0 |
| flat | 500 | multi-select | 1× | 3 | B02 | 3 | 0 | 1.0 | 499.0 | 499.0 | 22.0 | 8.0 | 469.0 | 0.0 | 500.0 | 1.0 | 23.0 | 0.0 | 22.0 | 3.0 | 0.0 | 19.0 |
| flat | 500 | regrab | 1× | 3 | B03 | 3 | 0 | 3.0 | 499.0 | 31.0 | 31.0 | 468.0 | 0.0 | 0.0 | 36.0 | 15.0 | 32.0 | 0.0 | 31.0 | 31.0 | 0.0 | 0.0 |
| flat | 500 | same-list | 1× | 3 | B02 | 3 | 0 | 2.0 | 499.0 | 499.0 | 29.0 | 2.0 | 468.0 | 0.0 | 500.0 | 1.0 | 30.0 | 0.0 | 29.0 | 29.0 | 0.0 | 0.0 |
| flat | 1000 | multi-select | 1× | 3 | B02 | 3 | 0 | 1.0 | 999.0 | 999.0 | 22.0 | 8.0 | 969.0 | 0.0 | 1000.0 | 1.0 | 23.0 | 0.0 | 22.0 | 3.0 | 0.0 | 19.0 |
| flat | 1000 | regrab | 1× | 3 | B03 | 3 | 0 | 3.0 | 999.0 | 31.0 | 31.0 | 968.0 | 0.0 | 0.0 | 37.0 | 16.0 | 32.0 | 0.0 | 31.0 | 31.0 | 0.0 | 0.0 |
| flat | 1000 | same-list | 1× | 3 | B02 | 3 | 0 | 2.0 | 999.0 | 999.0 | 29.0 | 2.0 | 968.0 | 0.0 | 1000.0 | 1.0 | 30.0 | 0.0 | 29.0 | 29.0 | 0.0 | 0.0 |
| flat | 2000 | multi-select | 1× | 3 | B02 | 3 | 0 | 1.0 | 1999.0 | 1999.0 | 22.0 | 8.0 | 1969.0 | 0.0 | 2000.0 | 1.0 | 23.0 | 0.0 | 22.0 | 3.0 | 0.0 | 19.0 |
| flat | 2000 | same-list | 1× | 3 | B02 | 3 | 0 | 2.0 | 1999.0 | 1999.0 | 29.0 | 2.0 | 1968.0 | 0.0 | 2000.0 | 1.0 | 30.0 | 0.0 | 29.0 | 29.0 | 0.0 | 0.0 |
| flat-thumbnails | 50 | multi-select | 1× | 3 | B02 | 3 | 0 | 1.0 | 49.0 | 49.0 | 22.0 | 8.0 | 19.0 | 0.0 | 50.0 | 1.0 | 23.0 | 0.0 | 22.0 | 3.0 | 0.0 | 19.0 |
| flat-thumbnails | 50 | same-list | 1× | 3 | B02 | 3 | 0 | 2.0 | 49.0 | 49.0 | 29.0 | 2.0 | 18.0 | 0.0 | 50.0 | 1.0 | 30.0 | 0.0 | 29.0 | 29.0 | 0.0 | 0.0 |
| flat-thumbnails | 200 | multi-select | 1× | 3 | B02 | 3 | 0 | 1.0 | 199.0 | 199.0 | 22.0 | 8.0 | 169.0 | 0.0 | 200.0 | 1.0 | 23.0 | 0.0 | 22.0 | 3.0 | 0.0 | 19.0 |
| flat-thumbnails | 200 | same-list | 1× | 3 | B02 | 3 | 0 | 2.0 | 199.0 | 199.0 | 29.0 | 2.0 | 168.0 | 0.0 | 200.0 | 1.0 | 30.0 | 0.0 | 29.0 | 29.0 | 0.0 | 0.0 |
| flat-thumbnails | 500 | multi-select | 1× | 3 | B02 | 3 | 0 | 1.0 | 499.0 | 499.0 | 22.0 | 8.0 | 469.0 | 0.0 | 500.0 | 1.0 | 23.0 | 0.0 | 22.0 | 3.0 | 0.0 | 19.0 |
| flat-thumbnails | 500 | same-list | 1× | 3 | B02 | 3 | 0 | 2.0 | 499.0 | 499.0 | 29.0 | 2.0 | 468.0 | 0.0 | 500.0 | 1.0 | 30.0 | 0.0 | 29.0 | 29.0 | 0.0 | 0.0 |
| flat-thumbnails | 1000 | multi-select | 1× | 3 | B02 | 3 | 0 | 1.0 | 999.0 | 999.0 | 22.0 | 8.0 | 969.0 | 0.0 | 1000.0 | 1.0 | 23.0 | 0.0 | 22.0 | 3.0 | 0.0 | 19.0 |
| flat-thumbnails | 1000 | same-list | 1× | 3 | B02 | 3 | 0 | 2.0 | 999.0 | 999.0 | 29.0 | 2.0 | 968.0 | 0.0 | 1000.0 | 1.0 | 30.0 | 0.0 | 29.0 | 29.0 | 0.0 | 0.0 |
| flat-thumbnails | 2000 | multi-select | 1× | 3 | B02 | 3 | 0 | 1.0 | 1999.0 | 1999.0 | 22.0 | 8.0 | 1969.0 | 0.0 | 2000.0 | 1.0 | 23.0 | 0.0 | 22.0 | 3.0 | 0.0 | 19.0 |
| flat-thumbnails | 2000 | same-list | 1× | 3 | B02 | 3 | 0 | 2.0 | 1999.0 | 1999.0 | 29.0 | 2.0 | 1968.0 | 0.0 | 2000.0 | 1.0 | 30.0 | 0.0 | 29.0 | 29.0 | 0.0 | 0.0 |
| grouped | 50 | folded-context | 1× | 3 | B02 | 3 | 0 | 2.0 | 49.0 | 49.0 | 20.0 | 0.0 | 29.0 | 38.0 | 103.0 | 200.0 | 73.0 | 20.0 | 40.0 | 2.0 | 14.0 | 76.0 |
| grouped | 50 | grouped | 1× | 3 | B02 | 3 | 0 | 2.0 | 49.0 | 49.0 | 19.0 | 0.0 | 30.0 | 36.0 | 103.0 | 200.0 | 72.0 | 19.0 | 38.0 | 2.0 | 14.0 | 74.0 |
| grouped | 200 | folded-context | 1× | 3 | B02 | 3 | 0 | 2.0 | 199.0 | 199.0 | 27.0 | 0.0 | 172.0 | 46.0 | 253.0 | 650.0 | 80.0 | 27.0 | 54.0 | 8.0 | 14.0 | 84.0 |
| grouped | 200 | grouped | 1× | 3 | B02 | 3 | 0 | 2.0 | 199.0 | 199.0 | 27.0 | 0.0 | 172.0 | 46.0 | 253.0 | 650.0 | 80.0 | 27.0 | 54.0 | 8.0 | 14.0 | 84.0 |
| grouped | 500 | folded-context | 1× | 3 | B02 | 3 | 0 | 2.0 | 499.0 | 499.0 | 29.0 | 0.0 | 470.0 | 38.0 | 553.0 | 1550.0 | 82.0 | 29.0 | 58.0 | 20.0 | 14.0 | 76.0 |
| grouped | 500 | grouped | 1× | 3 | B02 | 3 | 0 | 2.0 | 499.0 | 499.0 | 29.0 | 0.0 | 470.0 | 38.0 | 553.0 | 1550.0 | 82.0 | 29.0 | 58.0 | 20.0 | 14.0 | 76.0 |
| grouped | 1000 | folded-context | 1× | 3 | B02 | 3 | 0 | 2.0 | 999.0 | 999.0 | 30.0 | 0.0 | 969.0 | 20.0 | 1053.0 | 3050.0 | 83.0 | 30.0 | 60.0 | 40.0 | 14.0 | 58.0 |
| grouped | 1000 | grouped | 1× | 3 | B02 | 3 | 0 | 2.0 | 999.0 | 999.0 | 30.0 | 0.0 | 969.0 | 20.0 | 1053.0 | 3050.0 | 83.0 | 30.0 | 60.0 | 40.0 | 14.0 | 58.0 |
| grouped | 2000 | folded-context | 1× | 3 | B02 | 3 | 0 | 2.0 | 1999.0 | 1999.0 | 30.0 | 0.0 | 1969.0 | 0.0 | 2053.0 | 6050.0 | 83.0 | 30.0 | 60.0 | 60.0 | 14.0 | 38.0 |
| grouped | 2000 | grouped | 1× | 3 | B02 | 3 | 0 | 2.0 | 1999.0 | 1999.0 | 30.0 | 0.0 | 1969.0 | 0.0 | 2053.0 | 6050.0 | 83.0 | 30.0 | 60.0 | 60.0 | 14.0 | 38.0 |
| kanban | 800 | cross-column | 1× | 3 | B02 | 3 | 0 | 2.0 | 399.0 | 399.0 | 62.0 | 0.0 | 337.0 | 0.0 | 401.0 | 2.0 | 64.0 | 0.0 | 62.0 | 30.0 | 0.0 | 32.0 |
| kanban | 800 | multi-select | 1× | 3 | B02 | 3 | 0 | 1.0 | 199.0 | 199.0 | 22.0 | 8.0 | 169.0 | 0.0 | 200.0 | 1.0 | 23.0 | 0.0 | 22.0 | 3.0 | 0.0 | 19.0 |
| kanban | 800 | same-list | 1× | 3 | B02 | 3 | 0 | 2.0 | 199.0 | 199.0 | 29.0 | 2.0 | 168.0 | 0.0 | 200.0 | 1.0 | 30.0 | 0.0 | 29.0 | 29.0 | 0.0 | 0.0 |
| canvas | 50 | canvas-node | 4× | 3 | B04 | 3 | 0 | 2.0 | 49.0 | 0.0 | 0.0 | 49.0 | 0.0 | 0.0 | 1.0 | 1.0 | 1.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| canvas | 2000 | canvas-node | 4× | 3 | B04 | 3 | 0 | 2.0 | 1999.0 | 0.0 | 0.0 | 1999.0 | 0.0 | 0.0 | 1.0 | 1.0 | 1.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| flat | 50 | multi-select | 4× | 3 | B04 | 3 | 0 | 1.0 | 49.0 | 49.0 | 22.0 | 8.0 | 19.0 | 0.0 | 50.0 | 1.0 | 23.0 | 0.0 | 22.0 | 3.0 | 0.0 | 19.0 |
| flat | 50 | same-list | 4× | 3 | B04 | 3 | 0 | 2.0 | 49.0 | 49.0 | 29.0 | 2.0 | 18.0 | 0.0 | 50.0 | 1.0 | 30.0 | 0.0 | 29.0 | 29.0 | 0.0 | 0.0 |
| flat | 2000 | multi-select | 4× | 3 | B04 | 3 | 0 | 1.0 | 1999.0 | 1999.0 | 22.0 | 8.0 | 1969.0 | 0.0 | 2000.0 | 1.0 | 23.0 | 0.0 | 22.0 | 3.0 | 0.0 | 19.0 |
| flat | 2000 | same-list | 4× | 3 | B04 | 3 | 0 | 2.0 | 1999.0 | 1999.0 | 29.0 | 2.0 | 1968.0 | 0.0 | 2000.0 | 1.0 | 30.0 | 0.0 | 29.0 | 29.0 | 0.0 | 0.0 |
| flat-thumbnails | 50 | multi-select | 4× | 3 | B04 | 3 | 0 | 1.0 | 49.0 | 49.0 | 22.0 | 8.0 | 19.0 | 0.0 | 50.0 | 1.0 | 23.0 | 0.0 | 22.0 | 3.0 | 0.0 | 19.0 |
| flat-thumbnails | 50 | same-list | 4× | 3 | B04 | 3 | 0 | 2.0 | 49.0 | 49.0 | 29.0 | 2.0 | 18.0 | 0.0 | 50.0 | 1.0 | 30.0 | 0.0 | 29.0 | 29.0 | 0.0 | 0.0 |
| flat-thumbnails | 2000 | multi-select | 4× | 3 | B04 | 3 | 0 | 1.0 | 1999.0 | 1999.0 | 22.0 | 8.0 | 1969.0 | 0.0 | 2000.0 | 1.0 | 23.0 | 0.0 | 22.0 | 3.0 | 0.0 | 19.0 |
| flat-thumbnails | 2000 | same-list | 4× | 3 | B04 | 3 | 0 | 2.0 | 1999.0 | 1999.0 | 29.0 | 2.0 | 1968.0 | 0.0 | 2000.0 | 1.0 | 30.0 | 0.0 | 29.0 | 29.0 | 0.0 | 0.0 |
| grouped | 50 | folded-context | 4× | 3 | B04 | 3 | 0 | 2.0 | 49.0 | 49.0 | 20.0 | 0.0 | 29.0 | 38.0 | 103.0 | 200.0 | 73.0 | 20.0 | 40.0 | 2.0 | 14.0 | 76.0 |
| grouped | 50 | grouped | 4× | 3 | B04 | 3 | 0 | 2.0 | 49.0 | 49.0 | 19.0 | 0.0 | 30.0 | 36.0 | 103.0 | 200.0 | 72.0 | 19.0 | 38.0 | 2.0 | 14.0 | 74.0 |
| grouped | 2000 | folded-context | 4× | 3 | B04 | 3 | 0 | 2.0 | 1999.0 | 1999.0 | 30.0 | 0.0 | 1969.0 | 0.0 | 2053.0 | 6050.0 | 83.0 | 30.0 | 60.0 | 60.0 | 14.0 | 38.0 |
| grouped | 2000 | grouped | 4× | 3 | B04 | 3 | 0 | 2.0 | 1999.0 | 1999.0 | 30.0 | 0.0 | 1969.0 | 0.0 | 2053.0 | 6050.0 | 83.0 | 30.0 | 60.0 | 60.0 | 14.0 | 38.0 |
| kanban | 800 | cross-column | 4× | 3 | B04 | 3 | 0 | 2.0 | 399.0 | 399.0 | 62.0 | 0.0 | 337.0 | 0.0 | 401.0 | 2.0 | 64.0 | 0.0 | 62.0 | 30.0 | 0.0 | 32.0 |
| kanban | 800 | multi-select | 4× | 3 | B04 | 3 | 0 | 1.0 | 199.0 | 199.0 | 22.0 | 8.0 | 169.0 | 0.0 | 200.0 | 1.0 | 23.0 | 0.0 | 22.0 | 3.0 | 0.0 | 19.0 |
| kanban | 800 | same-list | 4× | 3 | B04 | 3 | 0 | 2.0 | 199.0 | 199.0 | 29.0 | 2.0 | 168.0 | 0.0 | 200.0 | 1.0 | 30.0 | 0.0 | 29.0 | 29.0 | 0.0 | 0.0 |
| canvas | 50 | canvas-node | 6× | 3 | B04 | 3 | 0 | 2.0 | 49.0 | 0.0 | 0.0 | 49.0 | 0.0 | 0.0 | 1.0 | 1.0 | 1.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| canvas | 2000 | canvas-node | 6× | 3 | B04 | 3 | 0 | 2.0 | 1999.0 | 0.0 | 0.0 | 1999.0 | 0.0 | 0.0 | 1.0 | 1.0 | 1.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| flat | 50 | multi-select | 6× | 3 | B04 | 3 | 0 | 1.0 | 49.0 | 49.0 | 22.0 | 8.0 | 19.0 | 0.0 | 50.0 | 1.0 | 23.0 | 0.0 | 22.0 | 3.0 | 0.0 | 19.0 |
| flat | 50 | same-list | 6× | 3 | B04 | 3 | 0 | 2.0 | 49.0 | 49.0 | 29.0 | 2.0 | 18.0 | 0.0 | 50.0 | 1.0 | 30.0 | 0.0 | 29.0 | 29.0 | 0.0 | 0.0 |
| flat | 500 | same-list | 6× | 3 | B01 | 3 | 0 | 2.0 | 499.0 | 499.0 | 497.0 | 2.0 | 0.0 | 0.0 | 500.0 | 0.0 | 498.0 | 0.0 | 497.0 | 497.0 | 0.0 | 0.0 |
| flat | 2000 | multi-select | 6× | 3 | B04 | 3 | 0 | 1.0 | 1999.0 | 1999.0 | 22.0 | 8.0 | 1969.0 | 0.0 | 2000.0 | 1.0 | 23.0 | 0.0 | 22.0 | 3.0 | 0.0 | 19.0 |
| flat | 2000 | same-list | 6× | 3 | B04 | 3 | 0 | 2.0 | 1999.0 | 1999.0 | 29.0 | 2.0 | 1968.0 | 0.0 | 2000.0 | 1.0 | 30.0 | 0.0 | 29.0 | 29.0 | 0.0 | 0.0 |
| flat-thumbnails | 50 | multi-select | 6× | 3 | B04 | 3 | 0 | 1.0 | 49.0 | 49.0 | 22.0 | 8.0 | 19.0 | 0.0 | 50.0 | 1.0 | 23.0 | 0.0 | 22.0 | 3.0 | 0.0 | 19.0 |
| flat-thumbnails | 50 | same-list | 6× | 3 | B04 | 3 | 0 | 2.0 | 49.0 | 49.0 | 29.0 | 2.0 | 18.0 | 0.0 | 50.0 | 1.0 | 30.0 | 0.0 | 29.0 | 29.0 | 0.0 | 0.0 |
| flat-thumbnails | 2000 | multi-select | 6× | 3 | B04 | 3 | 0 | 1.0 | 1999.0 | 1999.0 | 22.0 | 8.0 | 1969.0 | 0.0 | 2000.0 | 1.0 | 23.0 | 0.0 | 22.0 | 3.0 | 0.0 | 19.0 |
| flat-thumbnails | 2000 | same-list | 6× | 3 | B04 | 3 | 0 | 2.0 | 1999.0 | 1999.0 | 29.0 | 2.0 | 1968.0 | 0.0 | 2000.0 | 1.0 | 30.0 | 0.0 | 29.0 | 29.0 | 0.0 | 0.0 |
| grouped | 50 | folded-context | 6× | 3 | B04 | 3 | 0 | 2.0 | 49.0 | 49.0 | 20.0 | 0.0 | 29.0 | 38.0 | 103.0 | 200.0 | 73.0 | 20.0 | 40.0 | 2.0 | 14.0 | 76.0 |
| grouped | 50 | grouped | 6× | 3 | B04 | 3 | 0 | 2.0 | 49.0 | 49.0 | 19.0 | 0.0 | 30.0 | 36.0 | 103.0 | 200.0 | 72.0 | 19.0 | 38.0 | 2.0 | 14.0 | 74.0 |
| grouped | 2000 | folded-context | 6× | 3 | B04 | 3 | 0 | 2.0 | 1999.0 | 1999.0 | 30.0 | 0.0 | 1969.0 | 0.0 | 2053.0 | 6050.0 | 83.0 | 30.0 | 60.0 | 60.0 | 14.0 | 38.0 |
| grouped | 2000 | grouped | 6× | 3 | B04 | 3 | 0 | 2.0 | 1999.0 | 1999.0 | 30.0 | 0.0 | 1969.0 | 0.0 | 2053.0 | 6050.0 | 83.0 | 30.0 | 60.0 | 60.0 | 14.0 | 38.0 |
| kanban | 800 | cross-column | 6× | 3 | B04 | 3 | 0 | 2.0 | 399.0 | 399.0 | 62.0 | 0.0 | 337.0 | 0.0 | 401.0 | 2.0 | 64.0 | 0.0 | 62.0 | 30.0 | 0.0 | 32.0 |
| kanban | 800 | multi-select | 6× | 3 | B04 | 3 | 0 | 1.0 | 199.0 | 199.0 | 22.0 | 8.0 | 169.0 | 0.0 | 200.0 | 1.0 | 23.0 | 0.0 | 22.0 | 3.0 | 0.0 | 19.0 |
| kanban | 800 | same-list | 6× | 3 | B04 | 3 | 0 | 2.0 | 199.0 | 199.0 | 29.0 | 2.0 | 168.0 | 0.0 | 200.0 | 1.0 | 30.0 | 0.0 | 29.0 | 29.0 | 0.0 | 0.0 |

### 两个可定位的成本读数

- canvas / 2000 / 6×：Runtime 的 commit 为 48.0 ms，dnd-kit 为 2.7 ms（仅列观测值，不作等功能胜负判断）。Runtime 末笔 FLIP telemetry 显示 candidateCards 1999.0、rangeSkipped 1999.0、measuredCardVisits 0.0、animatedCardEntries 0.0；即候选卡片全部被 range 跳过，测量 0、动画 0。
- flat / 2000 / same-list / 1×：eligibleCards 29.0、animatedCardEntries 29.0、rangeSkipped 2.0；该样本中参与者范围几乎覆盖全部 eligible 卡片。
- 批次口径提示：B01（revision a90d23a）早于视口裁剪优化 `bc7862f`；其 flat/500/same-list/6× telemetry 的 offscreenSkipped 为 0.0、eligibleCards 为 497.0。B02（revision 66ae66d）的 flat/500/same-list/1× 对应值为 468.0 与 29.0。两行源码版本与节流条件均不同，不作为同条件前后对照。
