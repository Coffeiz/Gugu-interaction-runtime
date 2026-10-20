# grouped 2000 卡 O(N^2) 修复隔离实验报告（i7-6700 部署机）

> 独立于主报告 `benchmark-report.md`。本报告只回答一个问题：**基准 harness 里 dnd-kit 分支的 O(N^2) `indexOf` 查找，在 2000 卡规模上到底吃掉了多少成本。**
> 本机数据**不与主报告的 Mac mini 基线横向比较**（不同机器、不同 CPU 核数），只做同机 A/B。

- 生成时间：2026-10-20
- 运行环境：i7-6700 / 4 核 / Linux x64（Linux 部署机 192.168.110.51）
- Node：v22.23.3
- 浏览器：Chromium 156.0.8078.4（Playwright chromium v1248, headless）
- 视口：1440x1000, deviceScaleFactor 1
- 场景 / 规模 / 交互：grouped / 2000 / grouped
- 样本量：每个「实现 × 节流档」修复前后各 n=6（2 轮批次 × 3 重复）
- 原始 trace：同目录 `raw/`（55 个样本）

## 1. 结论

**dnd-kit 分支 harness 的 O(N^2) 查找是 grouped 2000 上「runtime 反超 dnd-kit」的主因，量级精确对得上。**

同机 A/B（i7-6700）：

| 实现 | 节流 | 修复前 commit 中位 | 修复后 commit 中位 | 变化 | >24ms 帧 修复前→后 | Long Task 修复前→后 |
|---|---|---:|---:|---:|---|---|
| dnd-kit | 1× | 57.5ms | **24.2ms** | **-58%** | 12.5% → 14.7% | 3 → 2 |
| dnd-kit | 6× | 298.9ms | **138.1ms** | **-54%** | 98.1% → 98.1% | 16.5 → 16 |
| runtime（对照，代码未改） | 1× | 39.9ms | 39.7ms | -1% | 13.1% → 14.8% | 3 → 4 |
| runtime（对照，代码未改） | 6× | 196.9ms | 212.4ms | +8% | 57.3% → 61.8% | 16 → 14.5 |

对照侧（runtime，代码未动）在 ±8% 内波动，即本机噪声带约 ±8~10%；dnd-kit 的 -54%/-58% 远超噪声带。

## 2. 省下的时间定位到了具体操作

在页面内直接测「2000 张卡各查一次 2000 长度数组」这一操作本身的成本：

| CPU 节流 | O(N²) `indexOf` × 2000 | `Map.get` × 2000 | 节省 |
|---|---:|---:|---:|
| 1× | 18.8ms | 0.10ms | **18.7ms** |
| 6× | 144.4ms | 0.00ms | **144.4ms** |

对照 A/B 实测差值：1× 少 33.3ms（理论 18.7ms），6× 少 160.8ms（理论 144.4ms）。6× 档吻合度很高；1× 档实测差值略大于单次操作成本，余量来自 Vue 组件 diff 与 index 变更触发的 sortable 重算。

**旁证**：修复前 grouped 2000 的页面在 Playwright 默认 30s 导航超时内**无法完成首屏渲染**（`page.goto` 超时），放宽到 180s 才跑得动。这本身就是 O(N²) 在 2000 卡上的直接体现。

## 3. trace 层核对：库级开销一条没少

同一条件（dnd-kit / grouped 2000 / 6× / r1）修复前后 trace 对比：

| 指标 | 修复前 | 修复后 |
|---|---:|---:|
| FunctionCall 次数 | 2247 | 2247 |
| v8.callFunction 次数 | 2251 | 2251 |
| RunTask 次数 | 4988 | 4962 |
| Layout 次数 / 耗时 | 13 / 554.0ms | 13 / 618.9ms |
| FireAnimationFrame 次数 | 57 | 56 |
| `PositionObserver.IntersectionObserver.threshold.threshold` 触发 | **2000** | **2000** |
| `IntersectionObserverController::computeIntersections` | 61 次 / 656.0ms | 60 次 / 815.9ms |

事件数与库级观察器开销前后基本一致，说明省下的是**单次 Vue render 内的同步计算**，不体现为事件数变化；dnd-kit 每卡一套观察器的固有成本完全未变。

## 4. 改动内容

`src/benchmark/BenchmarkPage.vue` 三处：

1. **模板**：`:index="group.ids.indexOf(id)"` → `:index="group.indexMap.get(id) ?? 0"`
2. **`groups` computed**：为每个 group 预先建立 `Map<string, number>`（`buildIndexMap`）
3. **`baseGroups` 数据构造**：`yearIds.filter(id => groupIds.indexOf(id) ...)` → 直接由卡片序号推导年月归属（`cardIndex % 12 === monthIndex && floor((cardIndex % 48) / 12) === yearIndex`）

另改 `scripts/run-benchmark.mjs`：导航与就绪等待超时 30s → 180s（大列表首屏渲染需要）。

**等价性验证**：旧新两种数据构造算法在 50 / 200 / 500 / 1000 / 2000 五种规模下输出逐字节相同。

## 5. 归因边界

- **本报告数据只在本机内部有效**，不与主报告 Mac mini 基线横向比较。
- **库级机制不受本次修复影响**：每卡 PositionObserver/IntersectionObserver（2000 个观察器、100 级 threshold）、drop 时 `OptimisticSortingPlugin` 全量重写 index 触发逐卡 `refreshShape()` —— 这两条 trace 证据前后一致，仍然成立。2000 卡下 dnd-kit 成本仍随总卡数线性增长，只是常数项里我们不再多背一个不该背的 O(N²)。
- **主报告现有的 grouped 2000 dnd-kit 数字（Mac 上 114.5ms）同样带这个 O(N²)**。该数字若要对外引用，需先在 Mac 上重跑修复后的 grouped，才能得到可比口径。
- `commitMs` 口径 = pointerup → DOM commit-end，**不含落地动画**。

## 6. 样本明细

```
PRE  dnd-kit 1x  n=6  commits=45.5,47.2,56.2,58.8,65.4,66.1   input中位=913.1  LoAF中位=216.3
POST dnd-kit 1x  n=6  commits=17.5,22.7,24.2,24.2,26.9,31.1   input中位=850.6  LoAF中位=221.3
PRE  dnd-kit 6x  n=6  commits=275.4,276.4,283.6,314.2,318.9,400.2  input中位=4107.7  LoAF中位=2298.2
POST dnd-kit 6x  n=6  commits=124.1,133.0,138.0,138.2,164.6,173.8  input中位=4192.6  LoAF中位=2333.6
PRE  runtime 1x  n=6  commits=23.8,24.8,33.8,46.0,46.5,58.1   input中位=578.2   LoAF中位=136.5
POST runtime 1x  n=6  commits=26.9,29.0,33.8,45.6,57.6,72.7   input中位=665.5   LoAF中位=185.3
PRE  runtime 6x  n=6  commits=159.3,177.3,195.2,198.7,211.7,225.8  input中位=1911.2  LoAF中位=1079.2
POST runtime 6x  n=6  commits=175.9,193.8,208.0,216.9,228.3,308.1  input中位=1976.4  LoAF中位=1570.0
```

单位：commit / input / LoAF 为毫秒；LoAF 为 Long Animation Frame 的 blockingDuration 合计。

## 7. 批次清单

| 批次 | 内容 | 说明 |
|---|---|---|
| `14-00-08-456Z` | 修复前，部分失败 | 默认 30s 导航超时导致中断，仅得 7 个有效样本，未纳入 A/B |
| `14-04-48-341Z` | 修复前，完整 | A/B 第 1 轮 |
| `14-09-54-480Z` | 修复后，完整 | A/B 第 1 轮 |
| `13-06-01-096Z` / `13-14-10-440Z` | 环境准备失败 | vite 因缺 linux 原生绑定无法启动 |

原始样本与运行 manifest 均在本目录，与主报告 `docs/reports/raw/` 物理隔离，避免摘要脚本按「最新文件优先」覆盖 Mac 基线。
