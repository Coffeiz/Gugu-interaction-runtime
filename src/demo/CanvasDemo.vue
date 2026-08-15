<template>
  <section class="canvas-demo">
    <header class="canvas-toolbar">
      <div><h2>自由画布</h2><p>使用 Runtime Core API 演示不同类型卡片、抽屉和 free landing。</p></div>
      <div class="canvas-controls">
        <span>{{ nodes.length }} 个节点 · {{ relations.length }} 条连接</span>
        <div class="motion-mode-switch"><span>运动</span><button :class="{ active: motionMode === 'normal' }" @click="setMotionMode('normal')">普通</button><button :class="{ active: motionMode === 'physical' }" @click="setMotionMode('physical')">物理</button></div>
        <button @click="drawerCollapsed = !drawerCollapsed">{{ drawerCollapsed ? '展开抽屉' : '收起抽屉' }}</button>
      </div>
    </header>

    <div class="canvas-workspace">
      <div ref="canvasSurfaceRef" class="canvas-viewport" data-layout-surface>
        <div class="canvas-world">
          <svg class="relation-layer" viewBox="0 0 1200 680" aria-hidden="true">
            <g v-for="relation in relations" :key="relation.id" class="relation-group" @pointerdown.stop @click.stop="removeRelation(relation)">
              <path :d="relationPath(relation)" class="relation-hit" />
              <path :d="relationPath(relation)" class="relation-line" />
            </g>
            <path v-if="connectionState" :d="connectionPreviewPath" class="relation-line relation-line-preview" />
          </svg>
          <CanvasCard v-for="node in nodes" :key="node.id" :node="node" surface-id="canvas:main" :strategy="props.strategy" @connect-start="beginConnection" />
        </div>
      </div>

      <CanvasDrawer ref="drawerRef" data-layout-surface data-surface-type="drawer" :collapsed="drawerCollapsed">
        <template #header="{ collapsed }">
          <Transition name="drawer-heading-fade">
            <div v-if="collapsed" key="compact" class="drawer-compact-heading">
              <button type="button" class="drawer-icon-button" aria-label="展开项目抽屉" @click="toggleDrawer">▤</button>
            </div>
            <div v-else key="full" class="drawer-heading">
              <div class="drawer-title"><span class="drawer-kicker">DRAWER</span><h3>项目抽屉</h3></div>
              <div class="drawer-heading-actions">
                <span>{{ drawerNodes.length }}</span>
                <button type="button" class="drawer-toggle" aria-label="收起项目抽屉" :aria-expanded="!collapsed" @click="toggleDrawer">⌃</button>
              </div>
            </div>
          </Transition>
        </template>
        <div class="drawer-drop-zone" data-canvas-drawer-drop data-layout-content :data-layout-open="!drawerCollapsed">
            <p>拖到这里收纳</p>
            <section v-for="group in drawerGroups" :key="group.id" class="drawer-group" data-layout-group>
              <div class="drawer-group-heading"><span>{{ group.title }}</span><span>{{ group.nodes.length }}</span></div>
              <CanvasCard v-for="node in group.nodes" :key="node.id" :node="node" surface-id="canvas:drawer" :strategy="props.strategy" in-drawer @connect-start="beginConnection" />
            </section>
            <span v-if="drawerNodes.length === 0" class="drawer-empty">抽屉还是空的</span>
          </div>
      </CanvasDrawer>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { runtime } from '../Runtime'
import { useObject, useRuntimeAction, useSurface } from '../vue'
import { resolveFreeLandingPoint } from '../motion/FreeLandingMotion'
import type { NodeConnectionState, NodePortSide } from '../node/Node'
import CanvasCard, { type CanvasNodeModel } from './CanvasCard.vue'
import CanvasDrawer from './CanvasDrawer.vue'

const props = defineProps<{ strategy?: 'detach' | 'clone' }>()
const motionMode = ref<'normal' | 'physical'>('physical')
const drawerCollapsed = ref(false)
const relationRevision = ref(0)
let relationFrameRaf = 0
const visualRects = new Map<string, { x: number; y: number; width: number; height: number }>()
let stopRuntimeEvents: (() => void) | null = null
const drawerRef = ref<InstanceType<typeof CanvasDrawer> | null>(null)
const nodes = ref<CanvasNodeModel[]>([
  { id: 'canvas:idea', title: '产品构想', meta: '笔记 · 2 分钟前', kind: 'note', x: 120, y: 110 },
  { id: 'canvas:reference', title: '参考图片', meta: '图片 · 4 项', kind: 'image', x: 390, y: 250 },
  { id: 'canvas:brief', title: '项目简报.pdf', meta: '文件 · 3.6 MB', kind: 'file', x: 690, y: 100 },
  { id: 'canvas:task', title: '接入 Runtime', meta: '任务 · 进行中', kind: 'task', x: 790, y: 390 },
])
const drawerNodes = ref<CanvasNodeModel[]>([
  { id: 'drawer:project', title: 'Runtime 接入', meta: '项目 · 进行中', kind: 'task', x: 0, y: 0, group: 'projects' },
  { id: 'drawer:file', title: '接口说明.pdf', meta: '文件 · 2.1 MB', kind: 'file', x: 0, y: 0, group: 'files' },
  { id: 'drawer:idea', title: '抽屉分组设计', meta: '笔记 · 昨天', kind: 'note', x: 0, y: 0, group: 'ideas' },
])
type DemoRelation = { id: string; from: string; fromPort: NodePortSide; to: string; toPort: NodePortSide }
const relations = ref<DemoRelation[]>([
  { id: 'relation-1', from: 'canvas:idea', fromPort: 'right', to: 'canvas:reference', toPort: 'left' },
  { id: 'relation-2', from: 'canvas:reference', fromPort: 'right', to: 'canvas:brief', toPort: 'left' },
])
const connectionState = ref<NodeConnectionState | null>(null)
const connectionPoint = ref<{ x: number; y: number } | null>(null)
const connectionTargetSide = ref<NodePortSide | null>(null)
const drawerGroups = computed(() => [{ id: 'projects', title: '项目' }, { id: 'files', title: '文件' }, { id: 'ideas', title: '灵感' }].map(group => ({ ...group, nodes: drawerNodes.value.filter(node => node.group === group.id) })).filter(group => group.nodes.length))

const { elementRef: canvasSurfaceRef } = useSurface({
  id: 'canvas:main', type: 'canvas', layout: 'free', accepts: ['canvas-sticker'],
})
const { elementRef: drawerSurfaceRef } = useSurface({
  id: 'canvas:drawer',
  type: 'drawer',
  layout: 'grid',
  // 收起后保留 Surface 用于抽屉自身的布局事务，但不再参与拖放命中。
  // 空 accepts 代表“不限类型”，因此这里使用一个不会注册的类型作为关闭态哨兵。
  accepts: () => drawerCollapsed.value ? ['canvas-drawer-closed'] : ['canvas-sticker'],
  floating: {
    open: () => !drawerCollapsed.value,
    scrollKey: 'projects',
    maxHeight: 420,
  },
})

function registerCanvasType(): void {
  runtime.registerObjectType('canvas-sticker', {
    defaultVisualMode: props.strategy ?? 'detach',
    releaseMode: motionMode.value,
    resolveFreeLandingRect: ({ destination }) => {
      const point = resolveDemoLandingPoint(destination)
      if (!point) return null
      return { left: point.x - 92, top: point.y - 43, width: 184, height: 86 }
    },
    resolveMoveLandingTarget: ({ objectId, destination }) => {
      if (drawerCollapsed.value) return null
      const targetSurface = destination && typeof destination === 'object'
        ? (destination as { toSurfaceId?: unknown; columnId?: unknown }).toSurfaceId
          ?? (destination as { toSurfaceId?: unknown; columnId?: unknown }).columnId
        : null
      if (targetSurface !== 'canvas:drawer') return null
      return document.querySelector<HTMLElement>(`.drawer-drop-zone [data-card="${objectId}"]`)
    },
  })
}
registerCanvasType()

function resolveDemoLandingPoint(destination: unknown): { x: number; y: number } | null {
  if (!destination || typeof destination !== 'object') return null
  const landing = destination as {
    point?: { x?: unknown; y?: unknown }
    releaseVelocity?: { x?: unknown; y?: unknown }
  }
  if (typeof landing.point?.x !== 'number' || typeof landing.point.y !== 'number') return null
  const velocity = typeof landing.releaseVelocity?.x === 'number'
    && typeof landing.releaseVelocity.y === 'number'
    ? { x: landing.releaseVelocity.x, y: landing.releaseVelocity.y }
    : undefined
  const point = { x: landing.point.x, y: landing.point.y }
  return resolveFreeLandingPoint(
    point,
    velocity,
    motionMode.value,
    runtime.getMotionProfile()?.freeLanding,
  )
}

onMounted(() => {
  const drawerElement = drawerRef.value?.element ?? null
  drawerSurfaceRef.value = drawerElement
  for (const relation of relations.value) {
    runtime.registerNodeConnection({
      sourceObjectId: relation.from,
      sourcePortId: relation.fromPort,
      targetObjectId: relation.to,
      targetPortId: relation.toPort,
    })
  }
  relationRevision.value += 1
  stopRuntimeEvents = runtime.subscribe(event => {
    if (event.type === 'move-visual-update') {
      visualRects.set(event.objectId, event.rect)
      scheduleRelationFrame()
    } else if (event.type === 'move-visual-end') {
      visualRects.delete(event.objectId)
      scheduleRelationFrame()
    }
  })
  window.addEventListener('pointermove', scheduleRelationFrame, { passive: true })
})

function scheduleRelationFrame(): void {
  if (relationFrameRaf) return
  relationFrameRaf = requestAnimationFrame(() => {
    relationFrameRaf = 0
    relationRevision.value += 1
  })
}

function beginConnection(objectId: string, portId: NodePortSide): void {
  const state = runtime.beginNodeConnection(objectId, portId)
  if (!state) return
  connectionState.value = state
  connectionPoint.value = { ...state.currentPoint }
  connectionTargetSide.value = null
  connSpringTarget = { ...state.currentPoint }
  connSpringVel = { x: 0, y: 0 }
  connSpringLastT = null
  connSpringRaf = requestAnimationFrame(connSpringFrame)
  window.addEventListener('pointermove', updateConnection)
  window.addEventListener('pointerup', finishConnection, { once: true })
}

let connSpringTarget = { x: 0, y: 0 }
let connSpringVel = { x: 0, y: 0 }
let connSpringRaf = 0
let connSpringLastT: number | null = null
const CONN_SPRING = 900
const CONN_DAMP = 2 * 0.7 * Math.sqrt(CONN_SPRING)

function connSpringFrame(now: number): void {
  if (!connectionPoint.value || !connectionState.value) return
  let dt = connSpringLastT === null ? 1 / 60 : (now - connSpringLastT) / 1000
  connSpringLastT = now
  if (dt > 1 / 20) dt = 1 / 20
  let remaining = dt
  while (remaining > 1e-4) {
    const step = Math.min(remaining, 1 / 120)
    remaining -= step
    const ax = CONN_SPRING * (connSpringTarget.x - connectionPoint.value.x) - CONN_DAMP * connSpringVel.x
    const ay = CONN_SPRING * (connSpringTarget.y - connectionPoint.value.y) - CONN_DAMP * connSpringVel.y
    connSpringVel.x += ax * step
    connSpringVel.y += ay * step
    connectionPoint.value = { x: connectionPoint.value.x + connSpringVel.x * step, y: connectionPoint.value.y + connSpringVel.y * step }
  }
  relationRevision.value += 1
  if (connectionState.value) connSpringRaf = requestAnimationFrame(connSpringFrame)
}

function drawerGroupFor(node: CanvasNodeModel): NonNullable<CanvasNodeModel['group']> {
  if (node.group) return node.group
  if (node.kind === 'task') return 'projects'
  if (node.kind === 'note') return 'ideas'
  return 'files'
}

function updateConnection(event: PointerEvent): void {
  const state = runtime.updateNodeConnection({ x: event.clientX, y: event.clientY })
  if (!state) return
  connectionState.value = state
  const target = runtime.hitNodePort(
    { x: event.clientX, y: event.clientY },
    { objectType: 'canvas-sticker', snapToObject: true },
  )
  const isSelf = target?.objectId === state.sourceObjectId
  connectionTargetSide.value = target && !isSelf ? target.side : null
  connSpringTarget = target && !isSelf ? { ...target.point } : { ...state.currentPoint }
  relationRevision.value += 1
}

function finishConnection(event: PointerEvent): void {
  window.removeEventListener('pointermove', updateConnection)
  const target = runtime.hitNodePort(
    { x: event.clientX, y: event.clientY },
    { objectType: 'canvas-sticker', snapToObject: true },
  )
  if (target) runtime.finishNodeConnection(target.objectId, target.id)
  else runtime.cancelNodeConnection()
  cancelAnimationFrame(connSpringRaf)
  connSpringRaf = 0
  connectionPoint.value = null
  connectionTargetSide.value = null
  connSpringLastT = null
  connectionState.value = null
  relationRevision.value += 1
}

useRuntimeAction(action => {
  if (action.type === 'connection-create') {
    const relation: DemoRelation = {
      id: `relation-${action.timestamp}`,
      from: action.sourceObjectId,
      fromPort: action.sourcePortId as NodePortSide,
      to: action.targetObjectId,
      toPort: action.targetPortId as NodePortSide,
    }
    if (!relations.value.some(current => current.from === relation.from && current.fromPort === relation.fromPort && current.to === relation.to && current.toPort === relation.toPort)) {
      relations.value.push(relation)
    }
    relationRevision.value += 1
    return
  }
  if (action.type !== 'move') return
  const source = nodes.value.find(node => node.id === action.objectId) ?? drawerNodes.value.find(node => node.id === action.objectId)
  if (!source) return
  if (action.toSurfaceId === 'canvas:drawer') {
    if (drawerCollapsed.value) return
    nodes.value = nodes.value.filter(node => node.id !== source.id)
    source.group = drawerGroupFor(source)
    if (!drawerNodes.value.some(node => node.id === source.id)) drawerNodes.value.push(source)
    return
  }
  if (action.toSurfaceId === 'canvas:main') {
    drawerNodes.value = drawerNodes.value.filter(node => node.id !== source.id)
    if (!nodes.value.some(node => node.id === source.id)) nodes.value.push(source)
    const rect = canvasSurfaceRef.value?.getBoundingClientRect()
    if (action.point && rect) {
      const landingPoint = resolveDemoLandingPoint(action)
      if (!landingPoint) return
      source.x = landingPoint.x - rect.left - 92
      source.y = landingPoint.y - rect.top - 43
      void nextTick(() => {
        relationRevision.value += 1
      })
    }
  }
})

function setMotionMode(mode: 'normal' | 'physical'): void { motionMode.value = mode; registerCanvasType() }
function toggleDrawer(): void { drawerCollapsed.value = !drawerCollapsed.value }
function removeRelation(relation: DemoRelation): void {
  const connectionId = `${relation.from}:${relation.fromPort}->${relation.to}:${relation.toPort}`
  runtime.deleteNodeConnection(connectionId)
  relations.value = relations.value.filter(current => current.id !== relation.id)
  relationRevision.value += 1
}
function relationPath(relation: DemoRelation): string {
  relationRevision.value
  const layer = document.querySelector<SVGSVGElement>('.relation-layer')
  const startPoint = demoPortPoint(relation.from, relation.fromPort)
  const endPoint = demoPortPoint(relation.to, relation.toPort)
  if (!layer || !startPoint || !endPoint) return ''
  const start = screenToLayerPoint(layer, startPoint)
  const end = screenToLayerPoint(layer, endPoint)
  if (!start || !end) return ''
  return sidePath(start, relation.fromPort, end, relation.toPort)
}

function demoPortPoint(objectId: string, side: NodePortSide): { x: number; y: number } | null {
  const proxyPoint = visualProxyPortPoint(objectId, side)
  if (proxyPoint) return proxyPoint
  const visualRect = visualRects.get(objectId)
  if (visualRect) {
    return {
      x: side === 'right' ? visualRect.x + visualRect.width : visualRect.x,
      y: visualRect.y + visualRect.height / 2,
    }
  }
  return runtime.getNodePorts(objectId).find(port => port.id === side)?.point ?? null
}

function visualProxyPortPoint(objectId: string, side: NodePortSide): { x: number; y: number } | null {
  const proxy = [...document.querySelectorAll<HTMLElement>('[data-runtime-proxy="true"]')].find(candidate => {
    const content = candidate.querySelector<HTMLElement>('[data-runtime-proxy-content]')
    return content?.dataset.card === objectId
  })
  const port = proxy?.querySelector<HTMLElement>(`.canvas-card-port-${side}`)
  if (!port || !port.isConnected) return null
  const rect = port.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}

const MIN_EXTEND = 40
const MAX_EXTEND = 140

function sidePath(from: { x: number; y: number }, fromSide: NodePortSide, to: { x: number; y: number }, toSide: NodePortSide): string {
  const distance = Math.min(Math.max(Math.hypot(to.x - from.x, to.y - from.y) * 0.5, MIN_EXTEND), MAX_EXTEND)
  const start = extend(from, fromSide, distance)
  const end = extend(to, toSide, distance)
  return `M ${from.x} ${from.y} C ${start.x} ${start.y}, ${end.x} ${end.y}, ${to.x} ${to.y}`
}

function extend(point: { x: number; y: number }, side: NodePortSide, distance: number): { x: number; y: number } {
  return { x: point.x + (side === 'right' ? distance : -distance), y: point.y }
}

function screenToLayerPoint(layer: SVGSVGElement, point: { x: number; y: number }): { x: number; y: number } | null {
  const matrix = layer.getScreenCTM?.()
  if (matrix) {
    const local = new DOMPoint(point.x, point.y).matrixTransform(matrix.inverse())
    return { x: local.x, y: local.y }
  }
  const rect = layer.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  return { x: (point.x - rect.left) * 1200 / rect.width, y: (point.y - rect.top) * 680 / rect.height }
}

const connectionPreviewPath = computed(() => {
  relationRevision.value
  const state = connectionState.value
  const layer = document.querySelector<SVGSVGElement>('.relation-layer')
  if (!state || !layer) return ''
  const startPoint = demoPortPoint(state.sourceObjectId, state.sourcePortId as NodePortSide) ?? state.source.point
  const start = screenToLayerPoint(layer, startPoint)
  const end = connectionPoint.value ? screenToLayerPoint(layer, connectionPoint.value) : null
  if (!start || !end) return ''
  const targetSide = connectionTargetSide.value ?? (state.sourcePortId === 'left' ? 'right' : 'left')
  return sidePath(start, state.sourcePortId as NodePortSide, end, targetSide)
})

onBeforeUnmount(() => {
  stopRuntimeEvents?.()
  stopRuntimeEvents = null
  window.removeEventListener('pointermove', scheduleRelationFrame)
  window.removeEventListener('pointermove', updateConnection)
  window.removeEventListener('pointerup', finishConnection)
  cancelAnimationFrame(relationFrameRaf)
  cancelAnimationFrame(connSpringRaf)
  if (connectionState.value) runtime.cancelNodeConnection()
})
</script>

<style scoped>
.canvas-demo { display: flex; min-height: 0; flex: 1; flex-direction: column; color: #30364d; }
.canvas-toolbar { display: flex; flex: 0 0 auto; align-items: center; justify-content: space-between; gap: 20px; padding: 18px 0 14px; }
.canvas-toolbar h2 { margin: 0; font-size: 18px; }.canvas-toolbar p { margin: 5px 0 0; color: #8991a8; font-size: 12px; }
.canvas-controls { display: flex; align-items: center; gap: 8px; color: #8991a8; font-size: 12px; }.canvas-controls button,.motion-mode-switch button { border: 1px solid #dce1ec; border-radius: 8px; padding: 7px 10px; background: #fff; color: #66708b; cursor: pointer; }.canvas-controls button.active,.motion-mode-switch button.active { border-color: #7781d6; background: #7781d6; color: #fff; }
.motion-mode-switch { display: inline-flex; align-items: center; gap: 3px; padding: 3px; border: 1px solid #dce1ec; border-radius: 9px; background: rgba(255,255,255,.72); }.motion-mode-switch span { padding: 0 4px; }
.canvas-workspace { display: flex; min-height: 0; flex: 1; gap: 14px; overflow: hidden; }.canvas-viewport { position: relative; min-width: 0; flex: 1; overflow: hidden; border: 1px solid #dfe3ef; border-radius: 16px; background-color: #f8f9fd; background-image: radial-gradient(#dce1f0 1px, transparent 1px); background-size: 18px 18px; cursor: grab; }.canvas-world { position: absolute; inset: 0; }.relation-layer { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; }.relation-group { pointer-events: auto; cursor: pointer; }.relation-hit { fill: none; stroke: transparent; stroke-width: 21.6; }.relation-line { fill: none; stroke: rgba(104,111,164,.35); stroke-width: 1.6; opacity: 1; pointer-events: none; transition: stroke .18s ease, stroke-width .18s ease; }.relation-group:hover .relation-line { stroke: rgba(200,90,90,.8); stroke-width: 2.4; }.relation-line-preview { stroke: rgba(123,127,178,.85); stroke-width: 2.2; stroke-dasharray: 4 5; }
.drawer-heading { display: flex; min-height: 52px; flex: 0 0 52px; align-items: center; justify-content: space-between; padding: 0 16px; border-bottom: 1px solid #e7e9f1; }
.drawer-compact-heading { display: grid; min-height: 50px; flex: 0 0 50px; place-items: center; }
.drawer-heading-fade-enter-active, .drawer-heading-fade-leave-active { transition: opacity .18s cubic-bezier(.22,1,.36,1), filter .18s cubic-bezier(.22,1,.36,1); }
.drawer-heading-fade-enter-from, .drawer-heading-fade-leave-to { opacity: 0; filter: blur(3px); }
.drawer-heading-fade-leave-active { position: absolute; top: 0; left: 0; right: 0; }
.drawer-icon-button { display: grid; width: 36px; height: 36px; place-items: center; border: 0; border-radius: 50%; background: transparent; color: #747eaa; cursor: pointer; font-size: 18px; line-height: 1; transition: background .18s ease, color .18s ease; }
.drawer-icon-button:hover { background: rgba(123,127,178,.11); color: #6874c3; }
.drawer-title { min-width: 0; }
.drawer-heading h3 { margin: 4px 0 0; font-size: 15px; }
.drawer-heading-actions { display: flex; align-items: center; gap: 7px; color: #858db0; font-size: 12px; }
.drawer-toggle { display: grid; width: 28px; height: 28px; place-items: center; border: 0; border-radius: 7px; background: transparent; color: #747eaa; cursor: pointer; font-size: 16px; line-height: 1; }
.drawer-toggle:hover { background: #eef0fb; }
.drawer-kicker { color: #9aa2bd; font-size: 9px; letter-spacing: .12em; }
.drawer-drop-zone { display: flex; flex-direction: column; gap: 12px; padding: 14px; }
.drawer-drop-zone > p { margin: 0 0 2px; color: #a0a7ba; font-size: 11px; }
.drawer-group { display: flex; flex-direction: column; gap: 8px; }
.drawer-group-heading { display: flex; align-items: center; justify-content: space-between; padding: 2px 2px 0; color: #747d9d; font-size: 11px; font-weight: 650; }
.drawer-group-heading span:last-child { color: #a0a7ba; font-weight: 500; }
.drawer-empty { display: grid; min-height: 120px; place-items: center; border: 1px dashed #d8ddea; border-radius: 12px; color: #a7aec0; font-size: 12px; }
</style>
