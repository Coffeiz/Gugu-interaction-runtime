<template>
  <button :ref="target.elementRef" class="breadcrumb-entry" :data-file-breadcrumb-id="id" @click="$emit('open', id)">{{ label }}</button>
</template>

<script setup lang="ts">
import { useSurface, useTarget } from '../vue'

const props = defineProps<{ id: string; label: string; accepts: readonly string[] }>()
defineEmits<{ open: [id: string] }>()

useSurface({ id: `file:breadcrumb:${props.id}`, type: 'file-breadcrumb', layout: 'grid', accepts: props.accepts })
const target = useTarget({ id: `breadcrumb:${props.id}`, surfaceId: `file:breadcrumb:${props.id}`, accepts: props.accepts, priority: 1 })
</script>
