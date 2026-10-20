<template>
  <article
    ref="element"
    class="bench-card"
    :class="{ 'is-selected': selected }"
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
import { ref, watchPostEffect } from 'vue'
import { useDraggable } from '@dnd-kit/vue'
import { useSortable } from '@dnd-kit/vue/sortable'

const props = withDefaults(defineProps<{
  id: string
  index: number
  groupId: string
  selected?: boolean
  label: string
  thumbnail?: boolean
  canvas?: boolean
  x?: number
  y?: number
}>(), { thumbnail: false, canvas: false, x: 0, y: 0, selected: false })

const element = ref<HTMLElement | null>(null)
if (props.canvas) {
  const { draggable } = useDraggable({ id: props.id, element })
  watchPostEffect(() => { draggable.value.element = element.value ?? undefined })
} else {
  const { sortable } = useSortable({ id: props.id, index: props.index, group: props.groupId, element })
  watchPostEffect(() => { sortable.value.element = element.value ?? undefined })
}
</script>
