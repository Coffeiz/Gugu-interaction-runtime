<template>
  <button :ref="bindElement" class="breadcrumb-entry" :data-file-breadcrumb-id="id" @click="$emit('open', id)">{{ label }}</button>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useSurface, useTarget } from '../vue'

const props = defineProps<{ id: string; label: string; accepts: readonly string[] }>()
defineEmits<{ open: [id: string] }>()

const surface = useSurface({ id: `file:breadcrumb:${props.id}`, type: 'file-breadcrumb', accepts: props.accepts })
const target = useTarget({ id: `breadcrumb:${props.id}`, surfaceId: `file:breadcrumb:${props.id}`, accepts: props.accepts, priority: 1 })
const elementRef = ref<HTMLElement | null>(null)

function bindElement(element: unknown): void {
  const htmlElement = element as HTMLElement | null
  surface.elementRef.value = htmlElement
  target.elementRef.value = htmlElement
}
</script>
