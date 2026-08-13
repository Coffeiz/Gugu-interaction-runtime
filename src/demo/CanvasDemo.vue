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
      <div ref="viewportRef" class="canvas-viewport" data-layout-surface @pointerdown="onViewportPointerDown">
        <div ref="worldRef" class="canvas-world">
          <svg class="relation-layer" viewBox="0 0 1200 680" aria-hidden="true">
            <path v-for="relation in relations" :key="relation.id" :d="relationPath(relation)" class="relation-line" />
          </svg>
          <CanvasCard v-for="node in nodes" :key="node.id" :node="node" surface-id="canvas:main" @select="selectNode" />
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
        <div ref="drawerContentRef" class="drawer-drop-zone" data-canvas-drawer-drop data-layout-content :data-layout-open="!drawerCollapsed">
            <p>拖到这里收纳</p>
            <section v-for="group in drawerGroups" :key="group.id" class="drawer-group" data-layout-group>
              <div class="drawer-group-heading"><span>{{ group.title }}</span><span>{{ group.nodes.length }}</span></div>
              <CanvasCard v-for="node in group.nodes" :key="node.id" :node="node" surface-id="canvas:drawer" in-drawer @select="selectNode" />
            </section>
            <span v-if="drawerNodes.length === 0" class="drawer-empty">抽屉还是空的</span>
          </div>
      </CanvasDrawer>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { runtime } from '../Runtime'
import { useObject, useRuntimeAction, useSurface } from '../vue'
import { resolveFreeLandingPoint } from '../motion/FreeLandingMotion'
import CanvasCard, { type CanvasNodeModel } from './CanvasCard.vue'
import CanvasDrawer from './CanvasDrawer.vue'

const props = defineProps<{ strategy?: 'detach' | 'clone' }>()
const motionMode = ref<'normal' | 'physical'>('physical')
const drawerCollapsed = ref(false)
const viewportRef = ref<HTMLElement | null>(null)
const worldRef = ref<HTMLElement | null>(null)
const drawerRef = ref<InstanceType<typeof CanvasDrawer> | null>(null)
const drawerContentRef = ref<HTMLElement | null>(null)
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
const relations = ref([{ id: 'relation-1', from: 'canvas:idea', to: 'canvas:reference' }, { id: 'relation-2', from: 'canvas:reference', to: 'canvas:brief' }])
const drawerGroups = computed(() => [{ id: 'projects', title: '项目' }, { id: 'files', title: '文件' }, { id: 'ideas', title: '灵感' }].map(group => ({ ...group, nodes: drawerNodes.value.filter(node => node.group === group.id) })).filter(group => group.nodes.length))

const { elementRef: canvasSurfaceRef } = useSurface({
  id: 'canvas:main', type: 'canvas', layout: 'free', accepts: ['canvas-sticker'],
  camera: { scale: 1, origin: () => ({ left: 0, top: 0 }) },
})
const { elementRef: drawerSurfaceRef } = useSurface({
  id: 'canvas:drawer',
  type: 'drawer',
  layout: 'grid',
  accepts: ['canvas-sticker'],
  floating: {
    open: () => !drawerCollapsed.value,
    scrollKey: 'projects',
    maxHeight: 420,
  },
})

function registerCanvasType(): void {
  runtime.registerObjectType('canvas-sticker', {
    defaultVisualMode: props.strategy ?? 'detach',
    camera: { enabled: true },
    releaseMode: motionMode.value,
    resolveMoveHit: ({ x, y }) => {
      const drawer = drawerRef.value?.element
      const viewport = viewportRef.value
      if (drawer && !drawerCollapsed.value) {
        const rect = drawer.getBoundingClientRect()
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return { columnId: 'canvas:drawer', index: 0 }
      }
      if (viewport) {
        const rect = viewport.getBoundingClientRect()
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return { columnId: 'canvas:main', index: nodes.value.length }
      }
      return null
    },
    resolveFreeLandingRect: ({ destination }) => {
      const point = (destination as { point?: { x: number; y: number } }).point
      const releaseVelocity = (destination as { releaseVelocity?: { x: number; y: number } }).releaseVelocity
      const columnId = (destination as { columnId?: string }).columnId
      const viewport = viewportRef.value?.getBoundingClientRect()
      if (!point || !viewport) return null
      const landingPoint = columnId === 'canvas:main'
        ? resolveFreeLandingPoint(point, releaseVelocity, motionMode.value, runtime.getMotionProfile()?.freeLanding)
        : point
      return { left: landingPoint.x - 92, top: landingPoint.y - 43, width: 184, height: 86 }
    },
  })
}
registerCanvasType()

onMounted(async () => {
  await nextTick()
  canvasSurfaceRef.value = viewportRef.value
  const drawerElement = drawerRef.value?.element ?? null
  drawerSurfaceRef.value = drawerElement
})

useRuntimeAction(action => {
  if (action.type !== 'move') return
  const source = nodes.value.find(node => node.id === action.objectId) ?? drawerNodes.value.find(node => node.id === action.objectId)
  if (!source) return
  if (action.toSurfaceId === 'canvas:drawer') {
    nodes.value = nodes.value.filter(node => node.id !== source.id)
    if (!drawerNodes.value.some(node => node.id === source.id)) drawerNodes.value.push(source)
    return
  }
  if (action.toSurfaceId === 'canvas:main') {
    drawerNodes.value = drawerNodes.value.filter(node => node.id !== source.id)
    if (!nodes.value.some(node => node.id === source.id)) nodes.value.push(source)
    const rect = viewportRef.value?.getBoundingClientRect()
    if (action.point && rect) {
      const landingPoint = action.toSurfaceId === 'canvas:main'
        ? resolveFreeLandingPoint(action.point, action.releaseVelocity, motionMode.value, runtime.getMotionProfile()?.freeLanding)
        : action.point
      source.x = landingPoint.x - rect.left - 92
      source.y = landingPoint.y - rect.top - 43
    }
  }
})

function setMotionMode(mode: 'normal' | 'physical'): void { motionMode.value = mode; registerCanvasType() }
function toggleDrawer(): void { drawerCollapsed.value = !drawerCollapsed.value }
function onViewportPointerDown(event: PointerEvent): void { if (!(event.target as HTMLElement).closest('[data-card]')) event.currentTarget instanceof HTMLElement && event.currentTarget.setPointerCapture(event.pointerId) }
function selectNode(id: string): void { if (!relations.value.some(relation => relation.from === id)) relations.value.push({ id: `relation-${Date.now()}`, from: id, to: nodes.value[0]?.id ?? id }) }
function relationPath(relation: { from: string; to: string }): string { const from = nodes.value.find(node => node.id === relation.from); const to = nodes.value.find(node => node.id === relation.to); if (!from || !to) return ''; return `M ${from.x + 184} ${from.y + 43} C ${from.x + 260} ${from.y + 43}, ${to.x - 76} ${to.y + 43}, ${to.x} ${to.y + 43}` }
</script>

<style scoped>
.canvas-demo { display: flex; min-height: 0; flex: 1; flex-direction: column; color: #30364d; }
.canvas-toolbar { display: flex; flex: 0 0 auto; align-items: center; justify-content: space-between; gap: 20px; padding: 18px 0 14px; }
.canvas-toolbar h2 { margin: 0; font-size: 18px; }.canvas-toolbar p { margin: 5px 0 0; color: #8991a8; font-size: 12px; }
.canvas-controls { display: flex; align-items: center; gap: 8px; color: #8991a8; font-size: 12px; }.canvas-controls button,.motion-mode-switch button { border: 1px solid #dce1ec; border-radius: 8px; padding: 7px 10px; background: #fff; color: #66708b; cursor: pointer; }.canvas-controls button.active,.motion-mode-switch button.active { border-color: #7781d6; background: #7781d6; color: #fff; }
.motion-mode-switch { display: inline-flex; align-items: center; gap: 3px; padding: 3px; border: 1px solid #dce1ec; border-radius: 9px; background: rgba(255,255,255,.72); }.motion-mode-switch span { padding: 0 4px; }
.canvas-workspace { display: flex; min-height: 0; flex: 1; gap: 14px; overflow: hidden; }.canvas-viewport { position: relative; min-width: 0; flex: 1; overflow: hidden; border: 1px solid #dfe3ef; border-radius: 16px; background-color: #f8f9fd; background-image: radial-gradient(#dce1f0 1px, transparent 1px); background-size: 18px 18px; cursor: grab; }.canvas-world { position: absolute; inset: 0; }.relation-layer { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; }.relation-line { fill: none; stroke: #8b94c8; stroke-width: 2; stroke-dasharray: 5 5; opacity: .75; }
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
