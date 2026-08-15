<template>
  <div
    ref="elementRef"
    class="kb-column"
    :data-column="columnId"
    data-layout-surface
    data-surface-type="kanban-column"
  >
    <slot :controlled="controlled" />
  </div>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { useRuntimeTransition, useSurface } from '../vue'

const props = defineProps<{ columnId: string }>()
const emit = defineEmits<{ element: [element: HTMLElement | null] }>()

const { elementRef } = useSurface({
  id: `column:${props.columnId}`,
  type: 'kanban-column',
  layout: 'grid',
  accepts: ['kanban-card', 'kanban-card-clone'],
})
const { controlled } = useRuntimeTransition(`column:${props.columnId}`)

watch(elementRef, element => emit('element', element), { immediate: true })
</script>

<style scoped>
.kb-column {
  height: 100%; min-height: 80px; overflow-y: auto; overflow-anchor: none;
  width: 220px; background: #f4f5f7; border-radius: 10px; padding: 10px;
  display: flex; flex-direction: column; gap: 8px; box-sizing: border-box;
}
</style>
