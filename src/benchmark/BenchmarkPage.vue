<template>
  <main class="benchmark-page" :data-benchmark-ready="ready">
    <header class="bench-controls">
      <h1>Interaction Runtime benchmark</h1>
      <label>场景 <select v-model="scenario"><option v-for="item in scenarios" :key="item.id" :value="item.id">{{ item.label }}</option></select></label>
      <label>实现 <select v-model="implementation"><option value="runtime">Runtime</option><option value="dnd-kit">dnd-kit Vue</option></select></label>
      <label>交互 <select v-model="interaction"><option v-for="item in interactions" :key="item.id" :value="item.id">{{ item.label }}</option></select></label>
      <label>卡片数 <select v-model.number="count"><option v-for="n in scales" :key="n" :value="n">{{ n }}</option><option v-if="scenario === 'kanban'" :value="800">800 (4×200)</option></select></label>
      <button data-benchmark-reset @click="reset">重置</button>
      <span>{{ count }} items · {{ groups.length }} groups · {{ implementation }}</span>
    </header>

    <DragDropProvider v-if="implementation === 'dnd-kit'" @dragMove="onDndKitMove" @dragEnd="onDndKitEnd">
      <div class="bench-workspace" :class="[`scenario-${scenario}`, { 'is-canvas': scenario === 'canvas' }]">
        <DndKitBenchSurface
          v-for="group in groups"
          :key="group.id"
          :id="group.id"
          :folded="folded.has(group.id)"
          :droppable="scenario !== 'grouped'"
        >
          <header v-if="scenario === 'kanban'" class="bench-group-title">{{ group.label }} <small>{{ group.ids.length }}</small></header>
          <div v-if="scenario === 'grouped'" class="bench-list-content bench-year-content">
            <section v-for="year in group.years" :key="year.id" class="bench-year" :class="{ 'is-folded': folded.has(year.id) }" :data-layout-group="year.id">
              <header class="bench-year-title" @click="toggleFold(year.id)">{{ year.label }} <small>{{ year.ids.length }}</small></header>
              <div class="bench-year-cards">
                <section v-for="month in year.months" :key="month.id" class="bench-month" :class="{ 'is-folded': folded.has(month.id) }" :data-layout-group="month.id">
                  <header class="bench-month-title" @click="toggleFold(month.id)">{{ month.label }} <small>{{ month.ids.length }}</small></header>
                  <div class="bench-month-content">
                    <DndKitBenchCard v-for="id in month.ids" :key="id" :id="id" :index="group.indexMap.get(id) ?? 0" :group-id="group.id" :label="`Card ${id}`" :selected="isSelected(id)" />
                  </div>
                </section>
              </div>
            </section>
          </div>
          <div v-else class="bench-list-content">
            <DndKitBenchCard
              v-for="(id, index) in group.ids"
              :key="id"
              :id="id"
              :index="index"
              :group-id="group.id"
              :label="`Card ${id}`"
              :selected="isSelected(id)"
              :thumbnail="scenario === 'flat-thumbnails' && index % 2 === 0"
              :canvas="scenario === 'canvas'"
              :x="canvasPositions[id]?.x ?? (index % 24) * 188"
              :y="canvasPositions[id]?.y ?? Math.floor(index / 24) * 108"
            />
          </div>
        </DndKitBenchSurface>
      </div>
    </DragDropProvider>

    <div v-else class="bench-workspace" :class="[`scenario-${scenario}`, { 'is-canvas': scenario === 'canvas' }]">
      <section
        v-for="group in groups"
        :key="group.id"
        :ref="el => bindRuntimeSurface(group.id, el)"
        class="bench-list"
        :class="{ 'is-folded': folded.has(group.id) }"
        :data-surface="group.id"
        data-layout-surface
        data-scroll-viewport
      >
        <header v-if="scenario === 'kanban'" class="bench-group-title">{{ group.label }} <small>{{ group.ids.length }}</small></header>
        <div v-if="scenario === 'grouped'" class="bench-list-content bench-year-content">
          <section v-for="year in group.years" :key="year.id" class="bench-year" :class="{ 'is-folded': folded.has(year.id) }" :data-layout-group="year.id">
            <header class="bench-year-title" @click="toggleFold(year.id)">{{ year.label }} <small>{{ year.ids.length }}</small></header>
            <div class="bench-year-cards">
              <section v-for="month in year.months" :key="month.id" class="bench-month" :class="{ 'is-folded': folded.has(month.id) }" :data-layout-group="month.id">
                <header class="bench-month-title" @click="toggleFold(month.id)">{{ month.label }} <small>{{ month.ids.length }}</small></header>
                <div class="bench-month-content">
                  <RuntimeBenchCard v-for="(id, index) in month.ids" :key="id" :id="id" :surface-id="group.id" :label="`Card ${id}`" :group-id="month.id" :selected="isSelected(id)" />
                </div>
              </section>
            </div>
          </section>
        </div>
        <div v-else class="bench-list-content">
          <RuntimeBenchCard
            v-for="(id, index) in group.ids"
            :key="id"
            :id="id"
            :surface-id="group.id"
            :label="`Card ${id}`"
            :selected="isSelected(id)"
            :thumbnail="scenario === 'flat-thumbnails' && index % 2 === 0"
            :canvas="scenario === 'canvas'"
            :x="canvasPositions[id]?.x ?? (index % 24) * 188"
            :y="canvasPositions[id]?.y ?? Math.floor(index / 24) * 108"
          />
        </div>
      </section>
    </div>
    <output class="bench-status" data-benchmark-status>{{ status }}</output>
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, provide, reactive, ref, watch } from 'vue'
import { DragDropProvider, type DragEndEvent, type DragMoveEvent } from '@dnd-kit/vue'
import { isSortable, isSortableOperation } from '@dnd-kit/vue/sortable'
import { Runtime } from '../Runtime'
import { runtimeInjectionKey } from '../vue/context'
import RuntimeBenchCard from './RuntimeBenchCard.vue'
import DndKitBenchCard from './DndKitBenchCard.vue'
import DndKitBenchSurface from './DndKitBenchSurface.vue'
import { PerformanceRecorder } from './PerformanceRecorder'
import type { BenchmarkImplementation, BenchmarkInteraction, BenchmarkOptions, BenchmarkSample, BenchmarkScenario } from './benchmarkTypes'

const parameters = new URLSearchParams(location.search)
const runtime = new Runtime()
provide(runtimeInjectionKey, runtime)
runtime.registerObjectType('bench', { defaultVisualMode: 'detach', motion: { enabled: true } })
runtime.registerObjectType('bench-node', { defaultVisualMode: 'detach', motion: { enabled: true } })
const scenarios: Array<{ id: BenchmarkScenario; label: string }> = [
  { id: 'flat', label: 'A 扁平列表（无缩略图）' },
  { id: 'flat-thumbnails', label: 'B 扁平列表（50% 缩略图）' },
  { id: 'kanban', label: 'C 看板（4×200）' },
  { id: 'grouped', label: 'D 年/月分组' },
  { id: 'canvas', label: 'E 自由画布（端口）' },
]
const interactions: Array<{ id: BenchmarkInteraction; label: string }> = [
  { id: 'same-list', label: '同列排序' },
  { id: 'cross-column', label: '跨列移动' },
  { id: 'grouped', label: '分组内排序' },
  { id: 'folded-context', label: '折叠月上下文排序' },
  { id: 'regrab', label: 'regrab' },
  { id: 'canvas-node', label: '画布节点拖拽' },
  { id: 'multi-select', label: '多选拖拽' },
]
const scales = [50, 200, 500, 1000, 2000]
const scenario = ref<BenchmarkScenario>((parameters.get('scenario') as BenchmarkScenario) || 'flat')
const implementation = ref<BenchmarkImplementation>((parameters.get('implementation') as BenchmarkImplementation) || 'runtime')
const interaction = ref<BenchmarkInteraction>((parameters.get('interaction') as BenchmarkInteraction) || 'same-list')
const count = ref(Number(parameters.get('count')) || 50)
const runId = parameters.get('run') || `${Date.now()}`
const ready = ref(false)
const status = ref('ready')
const folded = ref(new Set<string>())
const baseGroups = computed(() => {
  const total = scenario.value === 'kanban' ? 800 : count.value
  const columnCount = scenario.value === 'kanban' ? 4 : 1
  const ids = Array.from({ length: total }, (_, index) => `item-${index + 1}`)
  return Array.from({ length: columnCount }, (_, index) => {
    const start = Math.floor(index * total / columnCount)
    const end = Math.floor((index + 1) * total / columnCount)
    const groupIds = ids.slice(start, end)
    const years = scenario.value === 'grouped'
      ? Array.from({ length: 4 }, (_, yearIndex) => {
        const year = 2026 - yearIndex
        const yearIds = groupIds.filter((_, cardIndex) => Math.floor((cardIndex % 48) / 12) === yearIndex)
        const months = Array.from({ length: 12 }, (_, monthIndex) => {
          // 卡片在 groupIds 中的序号即其年月归属：cardIndex % 48 决定年，(cardIndex % 48) % 12 决定月
          const monthIds = groupIds.filter((_, cardIndex) => cardIndex % 12 === monthIndex && Math.floor((cardIndex % 48) / 12) === yearIndex)
          return { id: `year-${year}-month-${monthIndex + 1}`, label: `${year}年 ${String(monthIndex + 1).padStart(2, '0')}月`, ids: monthIds }
        })
        return { id: `year-${year}`, label: `${year}年`, ids: yearIds, months }
      })
      : []
    return { id: `surface-${index + 1}`, label: scenario.value === 'grouped' ? `完成记录` : `Column ${index + 1}`, ids: groupIds, years }
  })
})
const groupOrder = reactive<Record<string, string[]>>({})
const canvasPositions = reactive<Record<string, { x: number; y: number }>>({})
const buildIndexMap = (ids: string[]): Map<string, number> => new Map(ids.map((id, index) => [id, index] as [string, number]))
const groups = computed(() => baseGroups.value.map(group => {
  const ids = groupOrder[group.id] ?? group.ids
  return {
    ...group,
    ids,
    // 预先建立 id -> index 映射，避免模板里 group.ids.indexOf(id) 的 O(N^2) 查找
    indexMap: buildIndexMap(ids),
    years: group.years.map(year => ({
      ...year,
      months: year.months.map(month => ({ ...month, ids: groupOrder[month.id] ?? month.ids })),
    })),
  }
}))
let activeRecorder: PerformanceRecorder | null = null
let activeOptions: BenchmarkOptions | null = null
let landingSettled: Promise<void> = Promise.resolve()
let settleLanding: (() => void) | null = null
let landingSessionId: string | null = null
let runtimeSessionId: string | null = null
let runtimeSettled = false
let multiStartPoint: { x: number; y: number } | null = null
let commitStarted = false
let canvasGrabOffset: { x: number; y: number } | null = null

watch([scenario, implementation, count], async () => {
  resetData()
  await nextTick()
  resetRuntime()
  ready.value = true
}, { flush: 'post' })
onMounted(async () => {
  resetData()
  resetRuntime()
  await nextTick()
  ready.value = true
})

function bindRuntimeSurface(id: string, element: unknown): void {
  const node = element instanceof HTMLElement ? element : null
  const current = runtime.surfaces.get(id)
  if (current) runtime.surfaces.setElement(id, node)
  else runtime.surfaces.register({ id, type: 'benchmark-list', layout: scenario.value === 'canvas' ? 'free' : 'grid', accepts: ['bench-card', 'bench-node'], element: node })
}

function resetRuntime(): void {
  for (const group of groups.value) {
    const existing = runtime.surfaces.get(group.id)
    if (existing) runtime.surfaces.setElement(group.id, document.querySelector(`[data-surface="${group.id}"]`))
    else runtime.surfaces.register({ id: group.id, type: 'benchmark-list', layout: scenario.value === 'canvas' ? 'free' : 'grid', accepts: ['bench-card', 'bench-node'], element: document.querySelector(`[data-surface="${group.id}"]`) })
  }
  folded.value = new Set()
}

function resetData(): void {
  canvasGrabOffset = null
  for (const id of Object.keys(canvasPositions)) delete canvasPositions[id]
  for (const group of baseGroups.value) {
    groupOrder[group.id] = [...group.ids]
    for (const year of group.years) {
      groupOrder[year.id] = [...year.ids]
      for (const month of year.months) groupOrder[month.id] = [...month.ids]
    }
  }
}

function moveItems(ids: string[], destinationGroupId: string, destinationIndex: number, sourceGroupId?: string): void {
  const moving = new Set(ids)
  const source = (sourceGroupId ? groupOrder[sourceGroupId] : undefined)
    ?? Object.values(groupOrder).find(items => ids.some(id => items.includes(id)))
  const destination = groupOrder[destinationGroupId]
  if (!source || !destination) return
  const ordered = source.filter(id => moving.has(id))
  for (const id of ordered) source.splice(source.indexOf(id), 1)
  const targetIndex = Math.max(0, Math.min(destinationIndex, destination.length))
  destination.splice(targetIndex, 0, ...ordered)
}

function toggleFold(id: string): void {
  const next = new Set(folded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  folded.value = next
}

function isSelected(id: string): boolean {
  const parts = id.split('-')
  return interaction.value === 'multi-select' && Number(parts[parts.length - 1]) <= 4
}

function reset(): void {
  activeRecorder = null
  status.value = 'ready'
  folded.value = new Set()
  resetData()
  window.__benchmark?.reset()
}

function onDndKitEnd(event: DragEndEvent): void {
  const recorder = activeRecorder
  if (!recorder) return
  const point = event.operation.position.current
  const hitCard = document.elementFromPoint(point.x, point.y)?.closest<HTMLElement>('.bench-card')
  window.__benchmark?.actions.push(`dnd-end:${JSON.stringify({ canceled: event.canceled, source: event.operation.source?.id, target: event.operation.target?.id, position: event.operation.position, hitCard: hitCard?.dataset.card, hitSurface: hitCard?.closest<HTMLElement>('[data-surface]')?.dataset.surface, sourceSortable: isSortable(event.operation.source), targetSortable: isSortable(event.operation.target), sourceIndex: isSortable(event.operation.source) ? event.operation.source.index : undefined, targetIndex: isSortable(event.operation.target) ? event.operation.target.index : undefined })}`)
  void (async () => {
    status.value = 'committing'
    if (!event.canceled && isSortable(event.operation.source)) {
      const source = event.operation.source
      const sortableTarget = isSortable(event.operation.target) ? event.operation.target : null
      const surfaceTarget = groups.value.find(group => group.id === String(event.operation.target?.id ?? ''))
      if (sortableTarget || hitCard || surfaceTarget) {
        const destinationSurface = hitCard?.closest<HTMLElement>('[data-surface]')
          ?? (surfaceTarget ? document.querySelector<HTMLElement>(`[data-surface="${surfaceTarget.id}"]`) : null)
        const destinationGroupId = sortableTarget
          ? String(sortableTarget.group ?? source.group)
          : hitCard?.closest<HTMLElement>('[data-surface]')?.dataset.surface ?? surfaceTarget?.id ?? String(source.group ?? '')
        const destinationIndex = sortableTarget
          ? sortableTarget.index
          : hitCard
            ? Array.from(destinationSurface?.querySelectorAll<HTMLElement>('.bench-card') ?? []).indexOf(hitCard)
            : destinationSurface?.querySelectorAll<HTMLElement>('.bench-card').length ?? 0
        const ids = interaction.value === 'multi-select'
          ? Array.from(new Set(Array.from(document.querySelectorAll<HTMLElement>('.bench-card.is-selected')).map(element => element.dataset.card ?? '').filter(Boolean))).sort((left, right) => Number(left.slice(left.lastIndexOf('-') + 1)) - Number(right.slice(right.lastIndexOf('-') + 1)))
          : [String(source.id)]
        recorder.setCommit({ objectIds: ids, committed: true, sourceGroupId: String(source.group ?? ''), destinationGroupId, index: destinationIndex })
        moveItems(ids, destinationGroupId, destinationIndex, String(source.group ?? ''))
      }
    } else if (!event.canceled && scenario.value === 'canvas' && event.operation.target) {
      recorder.setCommit({ objectIds: [String(event.operation.source?.id ?? '')].filter(Boolean), committed: true, destinationGroupId: String(event.operation.target.id) })
    }
    if (event.canceled) recorder.setCommit({ objectIds: [], committed: false })
    document.querySelectorAll<HTMLElement>('.bench-card.is-selected').forEach(element => { element.style.translate = '' })
    await nextTick()
    recorder.mark('commit-end')
    if (!await waitForLayoutAnimations()) {
      activeRecorder = null
      status.value = 'settle-timeout'
      return
    }
    recorder.mark('settle-end')
    const sample = await recorder.finish()
    publishSample(sample)
    activeRecorder = null
  })()
}

function onDndKitMove(event: DragMoveEvent): void {
  if (interaction.value !== 'multi-select' || !multiStartPoint || !event.to) return
  const dx = event.to.x - multiStartPoint.x
  const dy = event.to.y - multiStartPoint.y
  document.querySelectorAll<HTMLElement>('.bench-card.is-selected').forEach(element => {
    if (!element.matches('[data-dnd-kit-dragging="true"]')) element.style.translate = `${dx}px ${dy}px`
  })
}

async function waitForLayoutAnimations(timeoutMs = 500): Promise<boolean> {
  const deadline = performance.now() + timeoutMs
  while (performance.now() < deadline) {
    await nextTick()
    const animations = Array.from(document.querySelectorAll<HTMLElement>('.bench-card'))
      .flatMap(element => element.getAnimations({ subtree: true }))
    if (animations.every(animation => animation.playState === 'finished' || animation.playState === 'idle')) return true
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  }
  return false
}

function beginMeasurement(): void {
  const options: BenchmarkOptions = { scenario: scenario.value, implementation: implementation.value, interaction: interaction.value, count: scenario.value === 'kanban' ? 800 : count.value, runId }
  activeOptions = options
  activeRecorder = new PerformanceRecorder(options)
  commitStarted = false
  landingSettled = new Promise(resolve => { settleLanding = resolve })
  landingSessionId = null
  runtimeSessionId = null
  runtimeSettled = false
  activeRecorder.mark('pointerdown')
  status.value = 'dragging'
}

function publishSample(sample: BenchmarkSample): void {
  window.__benchmark?.record(sample)
  status.value = 'complete'
  window.dispatchEvent(new CustomEvent('benchmark-sample', { detail: sample }))
}

async function waitForRuntimeSettle(timeoutMs: number, allowStableLayoutFallback = false): Promise<boolean> {
  const deadline = performance.now() + timeoutMs
  let lastGeometry = ''
  let stableFrames = 0
  while (!runtimeSettled && performance.now() < deadline) {
    if (allowStableLayoutFallback) {
      const cards = Array.from(document.querySelectorAll<HTMLElement>('.bench-card'))
      const geometry = cards.map(element => {
        const rect = element.getBoundingClientRect()
        return `${rect.x.toFixed(1)},${rect.y.toFixed(1)},${rect.width.toFixed(1)},${rect.height.toFixed(1)}`
      }).join(';')
      const animationsRunning = cards.flatMap(element => element.getAnimations({ subtree: true }))
        .some(animation => animation.playState === 'running')
      stableFrames = geometry === lastGeometry && !animationsRunning ? stableFrames + 1 : 0
      lastGeometry = geometry
      if (stableFrames >= 3) return true
    }
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  }
  return runtimeSettled
}

runtime.onAction(action => {
  window.__benchmark?.actions.push(`${action.type}:${action.objectId}`)
  if ((action.type !== 'move' && action.type !== 'move-group') || !activeRecorder || !activeOptions || commitStarted) return
  commitStarted = true
  status.value = 'committing'
  const recorder = activeRecorder
  void (async () => {
    const ids = action.type === 'move-group' ? [...action.objectIds] : [action.objectId]
    recorder.setCommit({ objectIds: ids, committed: true, sourceGroupId: action.fromSurfaceId, destinationGroupId: action.toSurfaceId, index: action.toIndex })
    if (scenario.value === 'canvas') {
      if (action.type === 'move' && action.point) {
        const content = document.querySelector<HTMLElement>('[data-surface] .bench-list-content')
        if (content) {
          const contentRect = content.getBoundingClientRect()
          const offset = canvasGrabOffset ?? { x: 88, y: 39 }
          canvasPositions[ids[0]] = {
            x: Math.max(0, action.point.x - contentRect.left - offset.x),
            y: Math.max(0, action.point.y - contentRect.top - offset.y),
          }
        }
      }
    } else {
      moveItems(ids, action.toSurfaceId, action.toIndex ?? 0, action.fromSurfaceId)
    }
    await nextTick()
    recorder.mark('commit-end')
    if (runtimeSettled) {
      recorder.mark('settle-end')
      settleLanding?.()
    }
    // A quick landing can emit its settle event while the commit callback is awaiting the
    // framework flush, so wait on the explicit settled flag rather than a replaceable promise.
    const settled = await waitForRuntimeSettle(3000, action.type === 'move-group')
    if (!settled) {
      activeRecorder = null
      status.value = 'settle-timeout'
      return
    }
    // GroupDragSession may not emit the single-object visual-settled lifecycle
    // event. Its fallback boundary is observed geometry stability, never a delay.
    if (!runtimeSettled) recorder.mark('settle-end')
    publishSample(await recorder.finish())
    activeRecorder = null
  })()
})

document.addEventListener('pointerdown', event => {
  if (!(event.target instanceof Element)) return
  if (activeRecorder && event.target.closest('[data-runtime-proxy="true"]')) {
    landingSettled = new Promise(resolve => { settleLanding = resolve })
    landingSessionId = null
    runtimeSessionId = null
    runtimeSettled = false
  }
  if (!event.target.closest('.bench-card')) return
  const card = event.target.closest<HTMLElement>('.bench-card')
  if (scenario.value === 'canvas' && card) {
    const rect = card.getBoundingClientRect()
    canvasGrabOffset = { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }
  if (implementation.value === 'dnd-kit' && interaction.value === 'multi-select' && card?.classList.contains('is-selected')) {
    multiStartPoint = { x: (event as PointerEvent).clientX, y: (event as PointerEvent).clientY }
  }
  if (activeRecorder) return
  beginMeasurement()
}, true)
document.addEventListener('pointerup', () => { multiStartPoint = null }, true)
document.addEventListener('pointerup', () => activeRecorder?.mark('pointerup'), true)
runtime.subscribe(event => {
  if (event.type === 'move-visual-update' && activeRecorder) {
    runtimeSessionId = event.sessionId
    if (event.phase === 'landing' && event.sessionId !== landingSessionId) {
      landingSessionId = event.sessionId
      landingSettled = new Promise(resolve => { settleLanding = resolve })
    }
  }
  if (event.type === 'move-visual-settled') {
    if (runtimeSessionId && event.sessionId !== runtimeSessionId) return
    runtimeSettled = true
    if (commitStarted) {
      activeRecorder?.mark('settle-end')
      settleLanding?.()
    }
  }
})
declare global {
  interface Window {
    __benchmark?: { reset: () => void; record: (sample: BenchmarkSample) => void; samples: BenchmarkSample[]; actions: string[] }
  }
}
window.__benchmark = {
  samples: [],
  actions: [],
  reset: () => { window.__benchmark!.samples.length = 0; window.__benchmark!.actions.length = 0 },
  record: sample => { window.__benchmark!.samples.push(sample) },
}
</script>

<style>
html, body, #app { width: 100%; height: 100%; margin: 0; }
.benchmark-page { display: flex; width: 100%; height: 100%; flex-direction: column; overflow: hidden; font: 13px system-ui,sans-serif; color: #1f2937; background: #f6f7fb; }
.bench-controls { display: flex; min-height: 64px; align-items: center; gap: 12px; padding: 8px 16px; background: white; border-bottom: 1px solid #dbe1ea; }
.bench-controls h1 { margin-right: auto; font-size: 17px; }
.bench-controls label { display: flex; align-items: center; gap: 4px; }
.bench-controls select, .bench-controls button { padding: 6px; border: 1px solid #cbd5e1; border-radius: 5px; background: white; }
.bench-workspace { display: flex; flex: 1; min-height: 0; align-items: stretch; gap: 10px; padding: 12px; overflow: auto; }
.bench-list { display: flex; min-width: 240px; min-height: 100%; flex: 1 0 240px; flex-direction: column; gap: 6px; padding: 8px; overflow: auto; border: 1px solid #dbe1ea; border-radius: 8px; background: #eef1f6; }
.bench-list-content { display: flex; min-height: 0; flex-direction: column; gap: 5px; }
.bench-group-title { position: sticky; top: 0; z-index: 2; padding: 7px; background: #e5e9f0; cursor: pointer; }
.bench-year-content { display: flex; flex-direction: column; gap: 8px; }
.bench-year { display: flex; flex-direction: column; gap: 4px; }
.bench-year-title { padding: 6px 8px; background: #dfe5ee; cursor: pointer; }
.bench-year-title small { float: right; }
.bench-year-cards { display: flex; flex-direction: column; gap: 8px; }
.bench-year.is-folded .bench-year-cards { height: 0; overflow: hidden; }
.bench-month { display: flex; flex-direction: column; gap: 4px; }
.bench-month-title { padding: 5px 7px; background: #e8ecf3; cursor: pointer; }
.bench-month-title small { float: right; }
.bench-month-content { display: flex; flex-direction: column; gap: 5px; overflow: visible; }
.bench-month.is-folded .bench-month-content { height: 0; overflow: hidden; }
.bench-group-title small { float: right; }
.bench-card { position: relative; display: flex; min-height: 40px; align-items: center; gap: 8px; padding: 6px 9px; border: 1px solid #d8dee9; border-radius: 6px; background: white; font: 13px system-ui,sans-serif; user-select: none; touch-action: none; }
.bench-card.is-selected { outline: 2px solid #7781d6; }
.bench-thumbnail { width: 32px; height: 24px; flex: 0 0 auto; border-radius: 3px; background: linear-gradient(135deg,#bdd3f2,#f2c9d3); }
.scenario-canvas .bench-workspace, .bench-workspace.is-canvas { min-height: 2400px; }
.is-canvas .bench-list { position: relative; flex: 0 0 100%; width: 100%; min-width: 2000px; min-height: 2400px; overflow: auto; background-color: #f0f3f9; background-image: radial-gradient(#c5cddd 1px,transparent 1px); background-size: 20px 20px; }
.is-canvas .bench-list-content { position: relative; min-height: 2400px; }
.is-canvas .bench-card { position: absolute; width: 176px; min-height: 78px; }
.bench-port { position: absolute; top: 50%; width: 8px; height: 8px; border-radius: 50%; background: #5968c9; transform: translateY(-50%); }
.bench-port-left { left: -4px; }.bench-port-right { right: -4px; }
.bench-status { position: absolute; right: 12px; bottom: 10px; padding: 4px 8px; border-radius: 4px; background: #111827; color: white; }
</style>
