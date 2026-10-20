import { readdir, readFile, writeFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const rawRoot = resolve(root, 'docs/reports/raw')
const reportRoot = resolve(root, 'docs/reports')
const files = (await readdir(rawRoot)).filter(file => file.endsWith('.json.gz')).sort()
const manifestFiles = (await readdir(reportRoot)).filter(file => /^run-.*\.json$/.test(file)).sort()
const runManifests = []
for (const file of manifestFiles) {
  try { runManifests.push(JSON.parse(await readFile(resolve(reportRoot, file), 'utf8'))) } catch { /* incomplete manifest is not treated as evidence */ }
}
const failedAttempts = []
for (const manifest of runManifests) {
  for (const attempt of (manifest.attempts ?? []).filter(item => item.status === 'failed')) {
    let diagnostics = null
    if (attempt.trace) {
      try {
        const trace = JSON.parse(gunzipSync(await readFile(resolve(root, attempt.trace))))
        diagnostics = trace.failure?.diagnostics ?? null
      } catch { /* keep the manifest failure even if its trace is unavailable */ }
    }
    failedAttempts.push({ runTag: manifest.runTag, sourceRevision: manifest.sourceRevision ?? '未记录', sourceDirty: manifest.sourceDirty ?? '未记录', sampleId: attempt.sampleId, error: attempt.error, diagnostics, trace: attempt.trace ?? null })
  }
}
let realPageSmoke = null
try { realPageSmoke = JSON.parse(await readFile(resolve(reportRoot, 'real-page-smoke.json'), 'utf8')) } catch { /* smoke result is optional */ }
const latest = new Map()
const historicalGrouped50Inputs = new Map()
const historicalBaselineTag = '2026-10-20T02-08-31-456Z'
const validInteractions = new Set(['same-list', 'cross-column', 'grouped', 'folded-context', 'regrab', 'canvas-node', 'multi-select'])
const sourceBatchTag = file => file.match(/-(20\d{2}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)\.json\.gz$/)?.[1] ?? 'unknown'

for (const file of files) {
  let trace
  try {
    trace = JSON.parse(gunzipSync(await readFile(resolve(rawRoot, file))))
  } catch {
    continue
  }
  const sample = trace.sample
  if (trace.failure || ![3, 4].includes(sample?.schemaVersion) || sample.settleTimedOut || !sample.commit?.committed || !validInteractions.has(trace.metadata?.interaction)) continue
  // regrab is Runtime-only; never infer a dnd-kit row from duplicate/legacy traces.
  if (trace.metadata?.interaction === 'regrab' && trace.metadata?.implementation === 'dnd-kit') continue
  if (!['inputMs', 'commitMs', 'settleMs'].every(phase => Number.isFinite(sample.phases?.[phase]))) continue
  if (!Number.isFinite(sample.frames?.count) || sample.frames.count < 1) continue
  const { scenario, count, interaction, implementation } = trace.metadata
  const throttle = trace.metadata.throttle ?? 1
  if (sourceBatchTag(file) === historicalBaselineTag && scenario === 'grouped' && Number(count) === 50 && interaction === 'grouped' && throttle === 1 && Number.isFinite(sample.phases.inputMs)) {
    const values = historicalGrouped50Inputs.get(implementation) ?? []
    values.push(sample.phases.inputMs)
    historicalGrouped50Inputs.set(implementation, values)
  }
  const repetition = Number(trace.metadata.sampleId.match(/-r(\d+)$/)?.[1] ?? 1)
  const key = [scenario, count, interaction, implementation, throttle, repetition].join('|')
  const current = latest.get(key)
  if (!current || file > current.file) latest.set(key, { file, trace })
}

const grouped = new Map()
for (const { file, trace } of latest.values()) {
  const { scenario, count, interaction, implementation, throttle = 1 } = trace.metadata
  const key = [scenario, count, interaction, implementation, throttle].join('|')
  if (!grouped.has(key)) grouped.set(key, [])
  grouped.get(key).push({ file, sample: trace.sample })
}

const batchSamples = new Map()
for (const { file, trace } of latest.values()) {
  const tag = sourceBatchTag(file)
  if (!batchSamples.has(tag)) batchSamples.set(tag, [])
  batchSamples.get(tag).push(trace)
}
const batchTags = [...batchSamples.keys()].sort()
const batchIds = new Map(batchTags.map((tag, index) => [tag, `B${String(index + 1).padStart(2, '0')}`]))
const batchSources = batchTags.map(tag => {
  const samples = batchSamples.get(tag)
  const conditions = new Set(samples.map(trace => [trace.metadata.scenario, trace.metadata.count, trace.metadata.interaction, trace.metadata.throttle].join('|')))
  const revisions = [...new Set(samples.map(trace => trace.metadata.sourceRevision).filter(Boolean))]
  const dirty = [...new Set(samples.map(trace => trace.metadata.sourceDirty).filter(value => typeof value === 'boolean'))]
  return { id: batchIds.get(tag), runTag: tag, timestampUtc: tag.replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, 'T$1:$2:$3.$4Z'), validSamples: samples.length, conditions: conditions.size, sourceRevision: revisions.length ? revisions.join(', ') : '未记录', sourceDirty: dirty.length ? dirty.join(', ') : '未记录' }
})
const sourceIdsFor = samples => [...new Set(samples.map(({ file }) => batchIds.get(sourceBatchTag(file)) ?? 'unknown'))].sort().join(', ')

const median = values => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b)
  if (!sorted.length) return null
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}
const rows = []
const telemetryRows = []
for (const [key, samples] of grouped) {
  if (samples.length < 3) continue
  const [scenario, count, interaction, implementation, throttle] = key.split('|')
  const metrics = field => samples.map(({ sample }) => field(sample)).filter(Number.isFinite)
  rows.push({
    scenario, count: Number(count), interaction, implementation, throttle: Number(throttle), repetitions: samples.length, sourceBatches: sourceIdsFor(samples),
    inputMs: median(metrics(sample => sample.phases.inputMs)),
    commitMs: median(metrics(sample => sample.phases.commitMs)),
    frameOver24Pct: median(metrics(sample => sample.frames.over24ms / sample.frames.count * 100)),
    eventTimingMaxMs: median(metrics(sample => sample.eventTimingMaxMs)),
    longTaskCount: median(metrics(sample => sample.longTasks.length)),
  })
  if (implementation === 'runtime') {
    const captured = samples.filter(({ sample }) => sample.layoutFlipTelemetry?.status === 'captured')
    const telemetryMetric = field => captured.map(({ sample }) => field(sample.layoutFlipTelemetry.values)).filter(Number.isFinite)
    telemetryRows.push({
      scenario, count: Number(count), interaction, throttle: Number(throttle), repetitions: samples.length, sourceBatches: sourceIdsFor(samples),
      telemetrySamples: captured.length,
      missingTelemetrySamples: samples.filter(({ sample }) => sample.layoutFlipTelemetry?.status !== 'captured').length,
      transactionCount: median(captured.map(({ sample }) => sample.layoutFlipTelemetry.transactionCount)),
      candidateCards: median(telemetryMetric(value => value.candidateCards)),
      capturedCards: median(telemetryMetric(value => value.capturedCards)),
      eligibleCards: median(telemetryMetric(value => value.eligibleCards)),
      captureReads: median(telemetryMetric(value => value.captureReads)),
      captureCacheHits: median(telemetryMetric(value => value.captureCacheHits)),
      playReads: median(telemetryMetric(value => value.playReads)),
      playCacheHits: median(telemetryMetric(value => value.playCacheHits)),
      rangeSkipped: median(telemetryMetric(value => value.rangeSkipped)),
      offscreenSkipped: median(telemetryMetric(value => value.offscreenSkipped)),
      parentInheritedCardEvents: median(telemetryMetric(value => value.parentOwnedSkipped)),
      measuredCardVisits: median(telemetryMetric(value => value.measuredCards)),
      animatedCardEntries: median(telemetryMetric(value => value.animatedCards)),
      animatedGroups: median(telemetryMetric(value => value.animatedGroups)),
      tinyDeltaSkipped: median(telemetryMetric(value => value.tinyDeltaSkipped)),
    })
  }
}
rows.sort((a, b) => a.throttle - b.throttle || a.scenario.localeCompare(b.scenario) || a.count - b.count || a.interaction.localeCompare(b.interaction) || a.implementation.localeCompare(b.implementation))
telemetryRows.sort((a, b) => a.throttle - b.throttle || a.scenario.localeCompare(b.scenario) || a.count - b.count || a.interaction.localeCompare(b.interaction))
const groupedTelemetryRows = telemetryRows.filter(row => row.scenario === 'grouped')
const groupedTelemetryPairs = groupedTelemetryRows.filter(row => row.interaction === 'grouped').flatMap(row => {
  const folded = groupedTelemetryRows.find(candidate => candidate.count === row.count && candidate.throttle === row.throttle && candidate.interaction === 'folded-context')
  if (!folded) return []
  const { interaction: _groupedInteraction, ...groupedValues } = row
  const { interaction: _foldedInteraction, ...foldedValues } = folded
  return [{ grouped: groupedValues, folded: foldedValues, exactMatch: JSON.stringify(groupedValues) === JSON.stringify(foldedValues) }]
})
const exactGroupedTelemetryPairs = groupedTelemetryPairs.filter(pair => pair.exactMatch).length
const includedSamples = rows.reduce((sum, row) => sum + row.repetitions, 0)
const preChangeBatchRows = rows.filter(row => row.sourceBatches.split(', ').some(batch => ['B01', 'B02', 'B03'].includes(batch)))
const postChangeGroupedRows = rows.filter(row => row.scenario === 'grouped' && row.sourceBatches.split(', ').some(batch => ['B04', 'B05'].includes(batch)))
const newGrouped50 = rows.filter(row => row.scenario === 'grouped' && row.count === 50 && row.interaction === 'grouped' && row.throttle === 1 && row.sourceBatches === 'B04')
const inputFor = (collection, implementation) => collection.find(row => row.implementation === implementation)?.inputMs
const oldGrouped50InputFor = implementation => median(historicalGrouped50Inputs.get(implementation) ?? [])
const eventTimingCoverage = { 'dnd-kit': { rows: 0, missingRows: 0, samples: 0, missingSamples: 0 }, runtime: { rows: 0, missingRows: 0, samples: 0, missingSamples: 0 } }
for (const row of rows) {
  const stats = eventTimingCoverage[row.implementation]
  stats.rows += 1
  if (row.eventTimingMaxMs == null) stats.missingRows += 1
}
for (const { trace } of latest.values()) {
  const stats = eventTimingCoverage[trace.metadata.implementation]
  stats.samples += 1
  if (!Number.isFinite(trace.sample.eventTimingMaxMs)) stats.missingSamples += 1
}
const interactionP98 = { values: 0, equalToEventTimingMax: 0 }
for (const { trace } of latest.values()) {
  const value = trace.sample.dragInteractionP98?.duration
  if (!Number.isFinite(value)) continue
  interactionP98.values += 1
  if (value === trace.sample.eventTimingMaxMs) interactionP98.equalToEventTimingMax += 1
}

const firstTrace = latest.values().next().value?.trace
const host = firstTrace?.metadata?.host
const browserVersion = firstTrace?.metadata?.browserVersion ?? 'unknown'
const fmt = value => value == null ? '—' : value.toFixed(1)
const lines = [
  '# Interaction Runtime 拖拽性能基准', '',
  '> 合成基准与真实 Gugu-web 页面验证分开报告。Runtime 完整功能与 dnd-kit 的能力集合不同，表格只呈现观测值，不把差异归因于实现效率，也不宣称等功能公平胜负。', '',
  '## 数据来源批次', '',
  '> 主表与 telemetry 表每行的“来源批次”列指向下表。批次时间取自原始 trace 文件名；旧 trace 未记录 Git revision，不能据此证明旧批之间代码完全一致。新 runner 会记录 revision 和 worktree dirty 状态。汇总对同一条件/重复编号采用最新有效 trace，因此新 grouped 批次替换了旧 grouped 行；旧数值仍保留在 raw 文件中，但不参与当前汇总。', '',
  '| 批次 | UTC 时间 | 纳入有效样本 | 条件数 | Git revision | dirty |',
  '|---|---|---:|---:|---|---|',
  ...batchSources.map(batch => `| ${batch.id} | ${batch.timestampUtc} | ${batch.validSamples} | ${batch.conditions} | ${batch.sourceRevision} | ${batch.sourceDirty} |`),
  '',
  '### 已记录的失败尝试', '',
  ...(failedAttempts.length ? [
    '| Run | 样本 | 结果 | revision / dirty | 错误与诊断 | Trace |',
    '|---|---|---|---|---|---|',
    ...failedAttempts.map(attempt => `| ${attempt.runTag} | ${attempt.sampleId} | failed | ${attempt.sourceRevision} / ${attempt.sourceDirty} | ${attempt.error}; ${attempt.diagnostics ? JSON.stringify(attempt.diagnostics) : '无诊断'} | ${attempt.trace ?? '—'} |`),
  ] : ['当前保留的 run manifest 中没有失败尝试。']),
  '',
  '## 环境与方法', '',
  `- 合成基准：${host ? `${host.cpu}，${host.cores} 核，${host.memoryGb} GB；${host.platform}/${host.arch}` : '未发现有效样本环境'}；Node ${firstTrace?.metadata?.node ?? 'unknown'}；Chromium ${browserVersion}。默认由 Playwright Headless Chromium 运行。`,
  '- 场景：flat 扁平列表、flat-thumbnails 缩略图列表、kanban 看板、grouped 分组、canvas 画布；看板固定 800 张卡。',
  '- 每个条件按 3 次以上有效样本的中位数汇总；Runtime 与 dnd-kit 交错执行。未完成提交、settle 超时、缺少帧采样或阶段时间的样本全部剔除，不插补。',
  '- `inputMs` = pointerdown→pointerup；`commitMs` = pointerup→DOM commit-end。`inputMs` 是脚本输入段墙钟时间：拖动由 12 个 rAF-paced CDP 步骤驱动，会被主线程负载和帧调度放大，不等于 Event Timing 输入延迟。`settleMs` 是实现各自稳定检测 race 的返回值，受动画和检测窗口影响，不稳定且不可跨实现比较；本报告不把它作为对外结论，也不将阶段相加为总耗时。',
  '- `>24ms 帧 %` = pointerdown 至视觉稳定期间 rAF 间隔超过 24ms 的比例；每个样本必须有帧数据才进入汇总。',
  `- Drag Interaction P98 暂不进入对外汇总：本次 ${interactionP98.values} 个有值原始样本中，${interactionP98.equalToEventTimingMax} 个等于 Event Timing max，P98 不能代表重复交互分布。Event Timing 汇总行缺测：dnd-kit ${eventTimingCoverage['dnd-kit'].missingRows}/${eventTimingCoverage['dnd-kit'].rows}，runtime ${eventTimingCoverage.runtime.missingRows}/${eventTimingCoverage.runtime.rows}；原始样本缺测：dnd-kit ${eventTimingCoverage['dnd-kit'].missingSamples}/${eventTimingCoverage['dnd-kit'].samples}，runtime ${eventTimingCoverage.runtime.missingSamples}/${eventTimingCoverage.runtime.samples}。缺测记为 —，不代表 0。`,
  '- Long Tasks 是测量窗口内浏览器 Long Tasks 条目数；它不等价于卡顿次数，且不能单独代表交互质量。',
  `- \`regrab\` 是 Runtime 特有的落位代理再抓取能力；dnd-kit 无对应操作，因此保留 flat 50/200/500/1000 @1× 的 Runtime 单边行但不作横向比较。2000 项目前没有成功样本：唯一保留的 2000-regrab 实跑失败并已列在“已记录的失败尝试”，不纳入有效样本。`,
  `- grouped 的 inputMs 在新批次普遍升高。grouped/50/grouped/1×：dnd-kit 从 B01 旧批 ${fmt(oldGrouped50InputFor('dnd-kit'))} ms 变为表内 B04 ${fmt(inputFor(newGrouped50, 'dnd-kit'))} ms；Runtime 从 B01 ${fmt(oldGrouped50InputFor('runtime'))} ms 变为 B04 ${fmt(inputFor(newGrouped50, 'runtime'))} ms。B01 旧行已被同 key 的最新有效 trace 替换，旧 raw trace 仍保留；旧批数值按 B01 raw 单独重算，不参与当前汇总。`,
  `- 版本边界：B01–B03 在本机时间 10:08–10:15 运行；\`src/dom/GroupLayout.ts\` 与 \`src/benchmark/PerformanceRecorder.ts\` 的工作树修改时间分别为 10:33:07、10:33:30；B04–B05 在 15:02–15:04 运行。因此主表中 ${preChangeBatchRows.length} 行来自这两处修改之前，${postChangeGroupedRows.length} 行 grouped 数据来自修改之后。flat 与 grouped 等跨边界数据不能作横向性能比较；旧 raw 未记录 Git revision，修改时间用于界定批次，不等同于逐样本源码哈希。`,
  '- 两批 grouped inputMs 的整体抬升同时发生在 dnd-kit 与 Runtime，并且跨多个规模；这提示存在运行批次/帧调度层面的墙钟差异，但现有证据无法确认唯一原因，也不能排除代码变化影响。',
  '- 合成 fixture 不等同于真实产品 DOM。完整 Runtime 含 dnd-kit 基线没有的代理、布局联动及 Surface 行为；没有 runtime-minus 消融对照前，不应将总耗时差解释为核心算法效率差异。CPU 节流是 CDP 模拟，不代表真实低配设备。', '',
  '## 真实页面验证', '',
  realPageSmoke
    ? `真实 Gugu-web 看板页面 smoke：${realPageSmoke.passed ? '通过' : '失败'}；${realPageSmoke.fixture?.projects ?? '—'} 张卡片；${realPageSmoke.browser ?? '浏览器未记录'}；源码 ${realPageSmoke.sourceRevision ?? 'revision 未记录'}${realPageSmoke.sourceDirty ? '（dirty worktree）' : ''}；生成于 ${realPageSmoke.generatedAt}。使用真实 Vue 卡片和样式，API 由浏览器测试 mock，避免写入业务数据。该项验证交互/DOM 集成，不与合成基准计时混算。见 real-page-smoke.json。`
    : '实际 Gugu-web 看板页面使用真实 Vue 卡片组件和样式，API 由浏览器测试 mock，避免写入业务数据。该项验证交互/DOM 集成，不与合成基准的计时表混算；详细结果见 `real-page-smoke.json`。', '',
  '## 复跑', '',
  '仓库根目录执行 `npm ci` 后：', '',
  '```sh',
  'npx playwright install chromium',
  'npm run benchmark -- --repetitions 3 --throttle 1 --interaction same-list,multi-select,cross-column,grouped,folded-context,canvas-node',
  'npm run benchmark -- --scenario flat --count 50,200,500,1000 --repetitions 3 --throttle 1 --interaction regrab',
  'npm run benchmark -- --count 50,2000 --repetitions 3 --throttle 4,6 --interaction same-list,cross-column,multi-select,grouped,folded-context,canvas-node',
  '```', '',
  '每次基准会在 `docs/reports/raw/` 写入 trace，并在 `docs/reports/run-*.json` 留下运行清单；清单不再被 gitignore 排除。`npm run benchmark:report` 从 trace 生成汇总。请在报告定稿和审阅完成前保留这些来源记录；本报告依赖原始 trace 做批次追溯。headed 与 headless 结果必须分开执行、分开汇总。真实页面 smoke 可通过 `GUGU_WEB_ROOT=/path/to/Gugu-web npm run benchmark:real-page` 复跑。', '',
  '## 汇总数据', '',
  '| 场景 | 项数 | 交互 | CPU× | 实现 | n | 来源批次 | 输入 ms | 提交 ms | >24ms 帧 % | Event Timing max ms | Long Tasks 数 |',
  '|---|---:|---|---:|---|---:|---|---:|---:|---:|---:|---:|',
]
for (const row of rows) lines.push(`| ${row.scenario} | ${row.count} | ${row.interaction} | ${row.throttle}× | ${row.implementation} | ${row.repetitions} | ${row.sourceBatches} | ${fmt(row.inputMs)} | ${fmt(row.commitMs)} | ${fmt(row.frameOver24Pct)} | ${fmt(row.eventTimingMaxMs)} | ${fmt(row.longTaskCount)} |`)
const pairedConditions = new Set(rows.map(row => [row.scenario, row.count, row.interaction, row.throttle].join('|'))).size
lines.push('', `实现汇总行数：${rows.length}；不同场景条件数：${pairedConditions}；纳入汇总的有效重复样本：${includedSamples}。每行至少 3 个有效重复样本。`, '')

lines.push('## Runtime Layout FLIP telemetry', '',
  '> Runtime 内部观测；dnd-kit 不提供该 telemetry，因此不作实现间比较。每个拖拽样本记录 telemetry 发布计数的增量，并展示最后一笔已发布事务的字段快照；事务数是本次样本新增的发布笔数，不将末笔字段误称为整次交互总量。无新增事务记为 —，字段值为 0 则保留为 0。以下是 headless 合成 fixture 数据；真实页面与 headed 数据须分开呈现。',
  '> 这些计数用于解释参与者筛选和测量行为，不用于推导耗时优势。`grouped` 是未折叠基线，`folded-context` 才会折叠第 12 个月份，两者应在相同规模和节流条件下对照阅读。当前合成 fixture 未提供 `[data-scroll-viewport]`，因此 `offscreenSkipped=0` 不表示没有卡片被视口裁剪；视口裁剪路径未覆盖。',
  `> \`candidateCards\` / \`capturedCards\` / \`eligibleCards\` 是卡片参与者计数；\`rangeSkipped\`、\`offscreenSkipped\` 是筛选计数。\`parentInheritedCardEvents\` 汇总参与者继承跳过与 Relative FLIP 父级位移继承事件，并非去重卡片数。\`measuredCardVisits\`、\`animatedCardEntries\` 是处理/动画计划条目数，不是去重 DOM 卡片数；分组与叶子处理可能重复计入。\`tinyDeltaSkipped\` 汇总卡片与组元素的跳过事件；\`animatedGroups\` 是组元素条目数。`,
  `> 本轮 ${exactGroupedTelemetryPairs}/${groupedTelemetryPairs.length} 对 grouped/folded-context 的末笔 telemetry 字段完全相同：折叠第 12 个月份作为背景存在，但在本 fixture/动作中没有改变被测的 FLIP 计数。`, '',
  '| 场景 | 项数 | 交互 | CPU× | n | 来源批次 | telemetry n | 缺测 n | 新增事务数（中位数） | candidateCards | capturedCards | eligibleCards | rangeSkipped | offscreenSkipped | parentInheritedCardEvents | captureReads | captureCacheHits | playReads | playCacheHits | measuredCardVisits | animatedCardEntries | animatedGroups | tinyDeltaSkipped |',
  '|---|---:|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|')
for (const row of telemetryRows) {
  lines.push(`| ${row.scenario} | ${row.count} | ${row.interaction} | ${row.throttle}× | ${row.repetitions} | ${row.sourceBatches} | ${row.telemetrySamples} | ${row.missingTelemetrySamples} | ${fmt(row.transactionCount)} | ${fmt(row.candidateCards)} | ${fmt(row.capturedCards)} | ${fmt(row.eligibleCards)} | ${fmt(row.rangeSkipped)} | ${fmt(row.offscreenSkipped)} | ${fmt(row.parentInheritedCardEvents)} | ${fmt(row.captureReads)} | ${fmt(row.captureCacheHits)} | ${fmt(row.playReads)} | ${fmt(row.playCacheHits)} | ${fmt(row.measuredCardVisits)} | ${fmt(row.animatedCardEntries)} | ${fmt(row.animatedGroups)} | ${fmt(row.tinyDeltaSkipped)} |`)
}
const canvasRuntime = rows.find(row => row.scenario === 'canvas' && row.count === 2000 && row.interaction === 'canvas-node' && row.throttle === 6 && row.implementation === 'runtime')
const canvasDnd = rows.find(row => row.scenario === 'canvas' && row.count === 2000 && row.interaction === 'canvas-node' && row.throttle === 6 && row.implementation === 'dnd-kit')
const canvasTelemetry = telemetryRows.find(row => row.scenario === 'canvas' && row.count === 2000 && row.interaction === 'canvas-node' && row.throttle === 6)
const flatTelemetry = telemetryRows.find(row => row.scenario === 'flat' && row.count === 2000 && row.interaction === 'same-list' && row.throttle === 1)
lines.push('', '### 两个可定位的成本读数', '')
if (canvasRuntime && canvasDnd && canvasTelemetry) lines.push(`- canvas / 2000 / 6×：Runtime 的 commit 为 ${fmt(canvasRuntime.commitMs)} ms，dnd-kit 为 ${fmt(canvasDnd.commitMs)} ms（仅列观测值，不作等功能胜负判断）。Runtime 末笔 FLIP telemetry 为 measuredCardVisits ${fmt(canvasTelemetry.measuredCardVisits)}、animatedCardEntries ${fmt(canvasTelemetry.animatedCardEntries)}、tinyDeltaSkipped ${fmt(canvasTelemetry.tinyDeltaSkipped)}；说明该样本测量了很多卡片，但没有卡片动画条目。`)
if (flatTelemetry) lines.push(`- flat / 2000 / same-list / 1×：eligibleCards ${fmt(flatTelemetry.eligibleCards)}、animatedCardEntries ${fmt(flatTelemetry.animatedCardEntries)}、rangeSkipped ${fmt(flatTelemetry.rangeSkipped)}；该样本中参与者范围几乎覆盖全部 eligible 卡片。`)
lines.push('')

await writeFile(resolve(root, 'docs/reports/benchmark-summary.json'), JSON.stringify({
  schemaVersion: 4,
  generatedAt: new Date().toISOString(),
  validSamples: includedSamples,
  sourceBatches: batchSources,
  sourceVersionBoundary: { preChangeTableRows: preChangeBatchRows.length, postChangeGroupedTableRows: postChangeGroupedRows.length, modifiedFiles: [{ path: 'src/dom/GroupLayout.ts', localMtime: '2026-10-20 10:33:07' }, { path: 'src/benchmark/PerformanceRecorder.ts', localMtime: '2026-10-20 10:33:30' }] },
  grouped50InputMsBatchComparison: { scenario: 'grouped', count: 50, interaction: 'grouped', throttle: 1, oldBatch: 'B01', newBatch: 'B04', oldDndKit: oldGrouped50InputFor('dnd-kit'), newDndKit: inputFor(newGrouped50, 'dnd-kit'), oldRuntime: oldGrouped50InputFor('runtime'), newRuntime: inputFor(newGrouped50, 'runtime') },
  runManifests: runManifests.map(({ runTag, status, sourceRevision, sourceDirty, startedAt, finishedAt, attempts, excluded }) => ({ runTag, status, sourceRevision, sourceDirty, startedAt, finishedAt, attempts, excluded })),
  failedAttempts,
  realPageSmoke,
  rows,
  eventTimingCoverage,
  dragInteractionP98: interactionP98,
  layoutFlipTelemetry: { aggregation: 'last-published-transaction-per-sample; transactionCount is the sample counter delta', groupedFoldedExactMatchPairs: exactGroupedTelemetryPairs, groupedFoldedPairCount: groupedTelemetryPairs.length, rows: telemetryRows },
}, null, 2))
await writeFile(resolve(root, 'docs/reports/benchmark-report.md'), lines.join('\n'))
console.log(`Summarized ${rows.length} conditions from ${latest.size} valid repetitions.`)
