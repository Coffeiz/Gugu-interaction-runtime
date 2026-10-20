<template>
  <section ref="element" class="bench-list" :class="{ 'is-folded': folded }" :data-surface="id" data-layout-surface>
    <slot />
  </section>
</template>

<script setup lang="ts">
import { ref, watchPostEffect } from 'vue'
import { useDroppable } from '@dnd-kit/vue'

const props = withDefaults(defineProps<{ id: string; folded?: boolean; droppable?: boolean }>(), { folded: false, droppable: true })
const element = ref<HTMLElement | null>(null)
if (props.droppable) {
  const { droppable } = useDroppable({ id: props.id, element })
  watchPostEffect(() => { droppable.value.element = element.value ?? undefined })
}
</script>
