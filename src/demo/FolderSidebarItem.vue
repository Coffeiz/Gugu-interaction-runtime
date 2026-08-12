<template>
  <button
    :ref="bindElement"
    class="folder-entry"
    :data-file-id="folder.id"
    :class="{ selected }"
    :style="{ paddingLeft: `${8 + depth * 16}px` }"
    @click="$emit('open', folder.id)"
  >
    <span>{{ depth ? '└' : '▰' }}</span>{{ folder.name }}<small>{{ itemCount }}</small>
  </button>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useSurface, useTarget } from '../vue'
import type { FileItem } from './fileTypes'

const props = defineProps<{
  folder: FileItem
  selected: boolean
  depth: number
  itemCount: number
  accepts: readonly string[]
}>()
defineEmits<{ open: [id: string] }>()

const surface = useSurface({ id: `file:surface:${props.folder.id}`, type: 'file-folder', layout: 'grid', accepts: props.accepts })
const target = useTarget({ id: `sidebar:${props.folder.id}`, surfaceId: `file:surface:${props.folder.id}`, accepts: props.accepts, priority: 1 })
const elementRef = ref<HTMLElement | null>(null)

function bindElement(element: unknown): void {
  const htmlElement = element as HTMLElement | null
  surface.elementRef.value = htmlElement
  target.elementRef.value = htmlElement
}
</script>
