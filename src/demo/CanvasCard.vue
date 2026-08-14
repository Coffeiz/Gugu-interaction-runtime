<template>
  <div
    class="canvas-card-position"
    :class="{ 'is-drawer-card': inDrawer }"
    :style="inDrawer ? undefined : { left: `${node.x}px`, top: `${node.y}px` }"
  >
    <article
    ref="elementRef"
    class="canvas-card"
    :class="[`is-${node.kind}`, { 'is-drawer-card': inDrawer }]"
      :data-card="node.id"
      @click="emit('select', node.id)"
    >
      <div class="canvas-card-grip" aria-hidden="true">⋮⋮</div>
      <div class="canvas-card-icon">{{ icon }}</div>
      <div class="canvas-card-body">
        <strong>{{ node.title }}</strong>
        <span>{{ node.meta }}</span>
      </div>
      <button type="button" class="canvas-card-port canvas-card-port-left" data-card-port="left" aria-label="从左侧连接" @pointerdown.stop.prevent="emit('connect-start', node.id, 'left')" @click.stop />
      <button type="button" class="canvas-card-port canvas-card-port-right" data-card-port="right" aria-label="从右侧连接" @pointerdown.stop.prevent="emit('connect-start', node.id, 'right')" @click.stop />
      <span v-if="node.kind === 'note'" class="canvas-card-dot" />
    </article>
  </div>
</template>

<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useObject } from '../vue'

export interface CanvasNodeModel {
  id: string
  title: string
  meta: string
  kind: 'note' | 'image' | 'file' | 'task'
  group?: 'projects' | 'files' | 'ideas'
  x: number
  y: number
}

const props = defineProps<{
  node: CanvasNodeModel
  surfaceId: string
  inDrawer?: boolean
  strategy?: 'detach' | 'clone'
}>()
const emit = defineEmits<{
  select: [id: string]
  'connect-start': [objectId: string, portId: 'left' | 'right']
}>()

const { elementRef } = useObject({
  id: props.node.id,
  type: 'canvas-sticker',
  visual: 'canvas-sticker',
  visualMode: () => props.strategy ?? 'detach',
  surface: toRef(props, 'surfaceId'),
  abilities: ['move'],
  node: {
    ports: [
      { id: 'left', side: 'left', position: 0.5, hitRadius: 16 },
      { id: 'right', side: 'right', position: 0.5, hitRadius: 16 },
    ],
  },
})

const icon = computed(() => ({ note: '✦', image: '▧', file: 'F', task: '✓' }[props.node.kind]))
</script>

<style scoped>
.canvas-card-position { position: absolute; width: 184px; height: 86px; }
.canvas-card-position.is-drawer-card { position: relative; width: 100%; height: auto; }
.canvas-card {
  position: relative; display: flex; align-items: flex-start; gap: 10px; width: 100%;
  min-height: 86px; padding: 14px; box-sizing: border-box; border: 1px solid rgba(255,255,255,.75);
  border-radius: 14px; background: rgba(255,255,255,.82);
  box-shadow: 0 10px 26px rgba(67,75,108,.12), inset 0 1px 0 rgba(255,255,255,.9);
  color: #30364d; cursor: grab; user-select: none; transform-origin: 50% 50%;
}
.canvas-card.is-note { background: rgba(255,246,218,.9); }
.canvas-card.is-image { background: rgba(224,242,255,.9); }
.canvas-card.is-file { background: rgba(238,234,255,.9); }
.canvas-card.is-task { background: rgba(226,247,238,.9); }
.canvas-card-grip { position: absolute; top: 5px; right: 8px; color: #a0a6bd; font-size: 12px; letter-spacing: -2px; opacity: .65; }
.canvas-card-icon { display: grid; flex: 0 0 30px; place-items: center; width: 30px; height: 30px; border-radius: 9px; background: rgba(113,124,209,.13); color: #6874c3; font-size: 15px; font-weight: 700; }
.canvas-card-body { display: flex; min-width: 0; flex-direction: column; gap: 6px; padding-top: 1px; }
.canvas-card-body strong { overflow: hidden; color: #343a53; font-size: 13px; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.canvas-card-body span { color: #9299ad; font-size: 11px; }
.canvas-card-dot { position: absolute; right: 12px; bottom: 12px; width: 6px; height: 6px; border-radius: 50%; background: #d59c64; }
.canvas-card-port { position: absolute; top: 50%; z-index: 2; width: 10px; height: 10px; box-sizing: border-box; margin: 0; padding: 0; border: 2px solid #fff; border-radius: 50%; background: #7781d6; box-shadow: 0 2px 7px rgba(71,78,137,.28); opacity: 0; cursor: crosshair; pointer-events: auto; transform: translateY(-50%) scale(.72); transition: opacity .16s ease, transform .16s ease; }
.canvas-card-port-left { left: -6px; }.canvas-card-port-right { right: -6px; }
.canvas-card:hover .canvas-card-port { opacity: 1; transform: translateY(-50%) scale(1); }
</style>
