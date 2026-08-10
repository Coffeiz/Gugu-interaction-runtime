<template>
  <article
    ref="elementRef"
    class="file-item"
    :class="{ folder: item.kind === 'folder', 'is-selected': selected }"
    :data-demo-list-layout="isList ? 'true' : undefined"
    :data-file-id="item.id"
    data-layout-role="card"
    :data-layout-key="item.id"
    @click="$emit('open', item, $event)"
  >
    <div class="file-icon">{{ item.kind === 'folder' ? '▰' : fileIcon(item.name) }}</div>
    <div class="file-name">{{ item.name }}</div>
    <small>{{ item.kind === 'folder' ? `${folderItemCount} 个项目` : item.size }}</small>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useObject } from '../vue'
import type { FileItem } from './fileTypes'

const props = defineProps<{
  item: FileItem
  strategy: 'detach' | 'clone'
  renderedFolderId: string
  browserSurfaceId: string
  fileObjectTypes: readonly string[]
  folderItemCount: number
  isList: boolean
  selected?: boolean
}>()

defineEmits<{
  open: [item: FileItem, event: MouseEvent]
}>()

const objectType = computed(() => {
  const prefix = props.item.kind === 'folder' ? 'folder-item' : 'file-item'
  return props.strategy === 'clone' ? `${prefix}-clone` : prefix
})
const surfaceId = computed(() => props.item.parentId === props.renderedFolderId
  ? props.browserSurfaceId
  : `file:surface:${props.item.parentId}`)
const target = computed(() => props.item.kind === 'folder'
  ? { surfaceId: `file:surface:${props.item.id}`, accepts: [...props.fileObjectTypes], priority: 2 }
  : undefined)

const { elementRef } = useObject({
  id: props.item.id,
  type: objectType,
  visual: objectType,
  visualMode: computed(() => props.strategy),
  surface: surfaceId,
  abilities: ['move', 'sort'],
  selected: computed(() => Boolean(props.selected)),
  target,
})

function fileIcon(name: string): string {
  if (name.endsWith('.md')) return 'M'
  if (name.endsWith('.pdf')) return 'P'
  if (name.match(/\.(png|jpg|jpeg)$/i)) return 'I'
  return 'F'
}
</script>

<style scoped>
.file-item { min-height: 106px; box-sizing: border-box; border: 1px solid #e3e7f0; border-radius: 10px; padding: 14px; background: #fff; box-shadow: 0 4px 16px rgba(50,60,100,.05); cursor: grab; user-select: none; }
.file-item.folder { border-color: #d7dcfa; background: #f8f9ff; }
.file-item[data-demo-list-layout="true"] { display: grid; grid-template-columns: 32px 1fr auto; align-items: center; min-height: 54px; padding: 10px 14px; }
.file-item[data-demo-list-layout="true"][data-runtime-proxy-content] { box-sizing: border-box !important; display: grid !important; grid-template-columns: 32px minmax(0, 1fr) auto !important; align-items: center !important; justify-items: stretch !important; justify-content: stretch !important; min-height: 54px !important; padding: 10px 14px !important; border-radius: 10px !important; }
.file-item[data-demo-list-layout="true"][data-runtime-proxy-content] .file-name { grid-column: 2 !important; justify-self: start !important; text-align: left !important; min-width: 0 !important; margin: 0 12px !important; }
.file-item[data-demo-list-layout="true"][data-runtime-proxy-content] .file-icon { grid-column: 1 !important; justify-self: start !important; }
.file-item[data-demo-list-layout="true"][data-runtime-proxy-content] small { grid-column: 3 !important; justify-self: end !important; text-align: right !important; margin: 0 !important; }
.file-item:hover { border-color: #b8bff0; box-shadow: 0 7px 20px rgba(75,86,160,.12); }
.file-item.is-selected { border-color: #818bd6; box-shadow: 0 0 0 2px rgba(129,139,214,.16), 0 7px 20px rgba(75,86,160,.12); }
.file-icon { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 8px; background: #eef0ff; color: #6972c5; font-weight: 700; }
.file-name { margin-top: 12px; color: #394156; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-item[data-demo-list-layout="true"] .file-name { margin: 0 12px; }
.file-item small { display: block; margin-top: 6px; color: #a0a7b8; font-size: 11px; }
.file-item[data-demo-list-layout="true"] small { margin: 0; }
</style>
