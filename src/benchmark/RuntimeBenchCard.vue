<template>
  <article
    ref="elementRef"
    class="bench-card"
    :data-card="id"
    :data-layout-role="canvas ? 'node' : 'card'"
    :data-layout-group="groupId"
    :style="canvas ? { left: `${x}px`, top: `${y}px` } : undefined"
  >
    <span v-if="thumbnail" class="bench-thumbnail" aria-hidden="true" />
    <span>{{ label }}</span>
    <i v-if="canvas" class="bench-port bench-port-left" data-card-port="left" />
    <i v-if="canvas" class="bench-port bench-port-right" data-card-port="right" />
  </article>
</template>

<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useObject } from '../vue'

const props = withDefaults(defineProps<{
  id: string
  surfaceId: string
  label: string
  groupId?: string
  selected?: boolean
  thumbnail?: boolean
  canvas?: boolean
  x?: number
  y?: number
}>(), { thumbnail: false, canvas: false, x: 0, y: 0 })

const { elementRef } = useObject({
  id: props.id,
  type: props.canvas ? 'bench-node' : 'bench-card',
  surface: toRef(props, 'surfaceId'),
  abilities: ['move', 'sort'],
  selected: toRef(props, 'selected'),
  visual: 'bench',
  node: computed(() => props.canvas ? { ports: [
    { id: 'left', side: 'left' as const, position: 0.5, hitRadius: 12 },
    { id: 'right', side: 'right' as const, position: 0.5, hitRadius: 12 },
  ] } : undefined),
})
</script>
