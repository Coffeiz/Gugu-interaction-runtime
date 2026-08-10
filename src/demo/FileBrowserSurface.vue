<template>
  <section ref="elementRef" class="file-surface" data-file-surface="browser" data-layout-surface>
    <slot />
  </section>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { useSurface } from '../vue'

const props = defineProps<{ id: string; accepts: readonly string[] }>()
const emit = defineEmits<{ element: [element: HTMLElement | null] }>()
const { elementRef } = useSurface({ id: props.id, type: 'file-browser', accepts: props.accepts })
watch(elementRef, element => emit('element', element), { immediate: true })
</script>
