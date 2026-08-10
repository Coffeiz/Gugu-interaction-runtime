<template>
  <div class="file-demo">
    <div class="file-toolbar">
      <div>
        <h2>文件系统交互</h2>
        <p>文件、文件夹和面包屑都作为 Runtime 的对象与 Surface 参与演示。</p>
      </div>
      <div class="toolbar-controls">
        <div class="mode-switch" aria-label="文件视觉策略">
          <span>视觉策略</span>
          <button :class="{ active: strategy === 'detach' }" @click="setStrategy('detach')">detach</button>
          <button :class="{ active: strategy === 'clone' }" @click="setStrategy('clone')">clone</button>
        </div>
        <div class="view-switch">
          <button :class="{ active: view === 'grid' }" @click="view = 'grid'">网格</button>
          <button :class="{ active: view === 'list' }" @click="view = 'list'">列表</button>
        </div>
        <button type="button" class="selection-mode-button" :class="{ active: selectionState.active }" @click="toggleSelectionMode">
          {{ selectionState.active ? '退出多选' : '多选' }}
        </button>
      </div>
    </div>

    <div class="breadcrumbs" data-file-surface="breadcrumbs">
      <BreadcrumbItem
        v-for="crumb in breadcrumbs"
        :key="crumb.id"
        :id="crumb.id"
        :label="crumb.label"
        :accepts="fileObjectTypes"
        @open="openFolder"
      />
    </div>

    <div class="file-layout">
      <aside class="folder-sidebar">
        <h3>文件夹</h3>
        <FolderSidebarItem
          v-for="folder in folders"
          :key="folder.id"
          :folder="folder"
          :selected="folder.id === currentFolder"
          :depth="folderDepth(folder.id)"
          :item-count="folderItemCount(folder.id)"
          :accepts="fileObjectTypes"
          @open="openFolder"
        />
      </aside>

      <FileBrowserSurface
        :id="browserSurfaceId"
        :accepts="fileObjectTypes"
        @element="browserElement = $event"
        @pointerdown="handleSurfacePointerDown"
      >
        <div v-if="selectionBox" class="selection-box" :style="selectionBox" aria-hidden="true" />
        <div class="surface-heading"><span>{{ currentFolderName }}</span><span>{{ visibleItems.length }} 个项目</span></div>
        <div
          class="file-items"
          data-layout-collection="file-browser"
          :class="`is-${view}`"
        >
          <FileItemCard
            v-for="item in visibleItems"
            :key="item.id"
            :item="item"
            :strategy="strategy"
            :rendered-folder-id="currentFolder"
            :browser-surface-id="browserSurfaceId"
            :file-object-types="fileObjectTypes"
            :folder-item-count="folderItemCount(item.id)"
            :is-list="view === 'list'"
            :selected="selectionState.ids.has(item.id)"
            @open="handleItemClick"
          />
          <div v-if="visibleItems.length === 0" class="empty-state">这个文件夹还是空的</div>
        </div>
      </FileBrowserSurface>
      <Transition name="selection-bar">
        <div v-if="selectionState.ids.size" class="selection-bar" @click.stop>
          <span class="selection-count">已选 {{ selectionState.ids.size }} 项</span>
          <span class="selection-hint">拖动其中一张可批量移动</span>
          <button type="button" class="selection-cancel" @click="toggleSelectionMode">取消</button>
        </div>
      </Transition>
    </div>

    <p class="file-hint">拖动文件到左侧文件夹，或拖动文件夹调整目标位置。当前策略：{{ strategy }}。</p>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, reactive, ref, watch } from 'vue'
import { runtime } from '../Runtime'
import { createVueRuntimeAdapter } from '../adapters/vue'
import { useRuntimeAction } from '../vue'
import type { FileItem } from './fileTypes'
import { createGroupFileVisualAdapter } from './groupFileVisual'
import type { MoveGroupAction } from '../action/Action'
import BreadcrumbItem from './BreadcrumbItem.vue'
import FileBrowserSurface from './FileBrowserSurface.vue'
import FileItemCard from './FileItemCard.vue'
import FolderSidebarItem from './FolderSidebarItem.vue'

const props = defineProps<{ strategy: 'detach' | 'clone' }>()
const strategy = ref(props.strategy)

const rootId = 'root'
const browserSurfaceId = 'file:surface:browser'
const fileObjectTypes = ['file-item', 'file-item-clone', 'folder-item', 'folder-item-clone']
const view = ref<'grid' | 'list'>('grid')
const currentFolder = ref(rootId)
const browserElement = ref<HTMLElement | null>(null)
const selectionState = reactive<{ active: boolean; ids: Set<string> }>({ active: false, ids: new Set() })
const selectionBox = ref<{ left: string; top: string; width: string; height: string } | null>(null)
let selectionPointerId: number | null = null
let selectionStart: { x: number; y: number; surface: HTMLElement } | null = null
let selectionMoved = false
function replaceSelection(ids: Set<string>, active = selectionState.active): void {
  selectionState.ids = ids
  selectionState.active = active
}

function clearSelection(): void {
  replaceSelection(new Set(), false)
}

function syncListRotation(mode: 'grid' | 'list'): void {
  runtime.configureMotion({ controller: { rotation: { tilt: mode === 'list' ? 0 : 5 } } })
}
watch(view, syncListRotation, { immediate: true })
const files = reactive<FileItem[]>([
  { id: 'folder:plans', name: '方案', kind: 'folder', parentId: rootId, size: '', children: [] },
  { id: 'folder:plans:research', name: '调研', kind: 'folder', parentId: 'folder:plans', size: '', children: [] },
  { id: 'folder:plans:design', name: '设计稿', kind: 'folder', parentId: 'folder:plans', size: '', children: [] },
  { id: 'folder:plans:design:archive', name: '归档', kind: 'folder', parentId: 'folder:plans:design', size: '', children: [] },
  { id: 'folder:assets', name: '素材', kind: 'folder', parentId: rootId, size: '', children: [] },
  { id: 'folder:assets:images', name: '图片', kind: 'folder', parentId: 'folder:assets', size: '', children: [] },
  { id: 'folder:assets:video', name: '视频', kind: 'folder', parentId: 'folder:assets', size: '', children: [] },
  { id: 'folder:references', name: '参考资料', kind: 'folder', parentId: rootId, size: '', children: [] },
  { id: 'file:readme', name: 'README.md', kind: 'file', parentId: rootId, size: '8 KB', children: [] },
  { id: 'file:roadmap', name: '路线图.pdf', kind: 'file', parentId: rootId, size: '1.2 MB', children: [] },
  { id: 'file:cover', name: '封面.png', kind: 'file', parentId: rootId, size: '842 KB', children: [] },
  { id: 'file:notes', name: '会议记录.md', kind: 'file', parentId: rootId, size: '16 KB', children: [] },
  { id: 'file:spec', name: '交互规范.docx', kind: 'file', parentId: rootId, size: '238 KB', children: [] },
  { id: 'file:todo', name: '待办清单.txt', kind: 'file', parentId: rootId, size: '4 KB', children: [] },
  { id: 'file:brief', name: '项目简报.pptx', kind: 'file', parentId: rootId, size: '3.6 MB', children: [] },
  { id: 'file:budget', name: '预算表.xlsx', kind: 'file', parentId: rootId, size: '92 KB', children: [] },
  { id: 'file:plan-a', name: '第一版方案.md', kind: 'file', parentId: 'folder:plans', size: '24 KB', children: [] },
  { id: 'file:plan-b', name: '迭代路线.md', kind: 'file', parentId: 'folder:plans', size: '18 KB', children: [] },
  { id: 'file:interview', name: '访谈摘录.md', kind: 'file', parentId: 'folder:plans:research', size: '42 KB', children: [] },
  { id: 'file:competitor', name: '竞品截图.zip', kind: 'file', parentId: 'folder:plans:research', size: '12.4 MB', children: [] },
  { id: 'file:wireframe', name: '线框图.fig', kind: 'file', parentId: 'folder:plans:design', size: '4.1 MB', children: [] },
  { id: 'file:archive', name: '旧版界面.png', kind: 'file', parentId: 'folder:plans:design:archive', size: '1.8 MB', children: [] },
  { id: 'file:hero', name: '首页插画.png', kind: 'file', parentId: 'folder:assets:images', size: '2.8 MB', children: [] },
  { id: 'file:icons', name: '图标集合.svg', kind: 'file', parentId: 'folder:assets:images', size: '126 KB', children: [] },
  { id: 'file:demo', name: '演示录屏.mp4', kind: 'file', parentId: 'folder:assets:video', size: '18.7 MB', children: [] },
  { id: 'file:reference-a', name: '参考文章.md', kind: 'file', parentId: 'folder:references', size: '11 KB', children: [] },
  { id: 'file:reference-b', name: '素材索引.csv', kind: 'file', parentId: 'folder:references', size: '76 KB', children: [] },
])

const folders = computed(() => files.filter(item => item.kind === 'folder'))
const visibleItems = computed(() => files.filter(item => item.parentId === currentFolder.value))
const currentFolderName = computed(() => currentFolder.value === rootId ? '个人文件' : files.find(item => item.id === currentFolder.value)?.name ?? '个人文件')
const breadcrumbs = computed(() => {
  const result = [{ id: rootId, label: '个人文件' }]
  let cursor = currentFolder.value
  const chain: FileItem[] = []
  while (cursor !== rootId) {
    const folder = files.find(item => item.id === cursor && item.kind === 'folder')
    if (!folder) break
    chain.unshift(folder)
    cursor = folder.parentId
  }
  return result.concat(chain.map(folder => ({ id: folder.id, label: folder.name })))
})

function setStrategy(next: 'detach' | 'clone'): void {
  strategy.value = next
}

watch(() => props.strategy, next => {
  strategy.value = next
})

function folderDepth(id: string): number {
  let depth = 0
  let cursor = files.find(item => item.id === id)?.parentId
  while (cursor && cursor !== rootId) {
    depth += 1
    cursor = files.find(item => item.id === cursor)?.parentId
  }
  return depth
}

function folderItemCount(id: string): number {
  return files.filter(item => item.parentId === id).length
}

function hasActiveMove(): boolean {
  return files.some(item => runtime.isControlled(item.id))
}

function handleItemClick(item: FileItem, event: MouseEvent): void {
  if (selectionState.active || event.metaKey || event.ctrlKey || event.shiftKey) {
    const next = new Set(selectionState.ids)
    if (next.has(item.id)) next.delete(item.id)
    else next.add(item.id)
    replaceSelection(next, true)
    return
  }
  clearSelection()
  if (item.kind === 'folder') {
    if (!runtime.isControlled(item.id)) openFolder(item.id)
    return
  }
}

function toggleSelectionMode(): void {
  if (selectionState.active) {
    clearSelection()
  } else {
    replaceSelection(new Set(), true)
    stopSelectionBox()
  }
}

function updateSelectionBox(event: PointerEvent): void {
  if (!selectionStart) return
  if (Math.abs(event.clientX - selectionStart.x) > 3 || Math.abs(event.clientY - selectionStart.y) > 3) {
    selectionMoved = true
  }
  const surfaceRect = selectionStart.surface.getBoundingClientRect()
  const leftClient = Math.min(selectionStart.x, event.clientX)
  const topClient = Math.min(selectionStart.y, event.clientY)
  const rightClient = Math.max(selectionStart.x, event.clientX)
  const bottomClient = Math.max(selectionStart.y, event.clientY)
  selectionBox.value = {
    left: `${leftClient - surfaceRect.left}px`,
    top: `${topClient - surfaceRect.top}px`,
    width: `${rightClient - leftClient}px`,
    height: `${bottomClient - topClient}px`,
  }

  const next = new Set(runtime.getObjectsInRect(browserSurfaceId, {
    left: leftClient,
    top: topClient,
    right: rightClient,
    bottom: bottomClient,
  }))
  replaceSelection(next, selectionState.active || next.size > 0)
}

function handleSelectionPointerMove(event: PointerEvent): void {
  if (event.pointerId === selectionPointerId) updateSelectionBox(event)
}

function stopSelectionBox(): void {
  const wasClick = selectionPointerId !== null && !selectionMoved
  if (selectionPointerId !== null) {
    window.removeEventListener('pointermove', handleSelectionPointerMove)
    window.removeEventListener('pointerup', stopSelectionBox)
    window.removeEventListener('pointercancel', stopSelectionBox)
  }
  selectionPointerId = null
  selectionStart = null
  selectionMoved = false
  selectionBox.value = null
  if (wasClick) {
    clearSelection()
  }
}

function handleSurfacePointerDown(event: PointerEvent): void {
  if (selectionPointerId !== null || event.button !== 0) return
  const target = event.target as HTMLElement
  if (target.closest('.file-item')) return
  const surface = (event.currentTarget as HTMLElement).closest('.file-surface') as HTMLElement | null
  if (!surface) return
  selectionPointerId = event.pointerId
  selectionStart = { x: event.clientX, y: event.clientY, surface }
  selectionMoved = false
  replaceSelection(new Set(), selectionState.active)
  selectionBox.value = { left: '0px', top: '0px', width: '0px', height: '0px' }
  window.addEventListener('pointermove', handleSelectionPointerMove)
  window.addEventListener('pointerup', stopSelectionBox)
  window.addEventListener('pointercancel', stopSelectionBox)
  event.preventDefault()
}

function openFolder(id: string): void {
  if (id === currentFolder.value || hasActiveMove()) return
  const browser = browserElement.value
  const beforeCards = visibleItems.value
    .map(item => runtime.objects.get(item.id)?.element)
    .filter((element): element is HTMLElement => Boolean(element?.isConnected))
  if (!browser) {
    currentFolder.value = id
    return
  }
  void domAdapter.runLayoutMutation({
    elements: beforeCards,
    root: browser,
    mutate: () => { currentFolder.value = id },
    waitForPatch: () => nextTick(),
  })
}

function moveFile(objectId: string, targetSurfaceId: string): void {
  const item = files.find(entry => entry.id === objectId)
  if (!item) return
  const target = targetSurfaceId.startsWith('file:breadcrumb:')
    ? targetSurfaceId.replace('file:breadcrumb:', '')
    : targetSurfaceId.replace('file:surface:', '')
  if (target === 'browser' || target === item.id) return
  if (target === 'root') {
    item.parentId = rootId
    return
  }
  const targetFolder = files.find(entry => entry.id === target && entry.kind === 'folder')
  if (!targetFolder) return
  let cursor: string | undefined = targetFolder.id
  while (cursor && cursor !== rootId) {
    if (cursor === item.id) return
    cursor = files.find(entry => entry.id === cursor)?.parentId
  }
  item.parentId = targetFolder.id
}

function moveGroup(action: MoveGroupAction): void {
  const target = action.toSurfaceId.startsWith('file:breadcrumb:')
    ? action.toSurfaceId.replace('file:breadcrumb:', '')
    : action.toSurfaceId.replace('file:surface:', '')
  if (target === 'browser') return
  const targetItem = files.find(item => item.id === target && item.kind === 'folder')
  if (!targetItem && target !== 'root') return
  if (action.objectIds.some(id => id === target)) return
  for (const objectId of action.objectIds) moveFile(objectId, action.toSurfaceId)
  clearSelection()
}

const listProxyLayout = { compact: { selector: '[data-demo-list-layout="true"]', width: 'min(320px, calc(100vw - 48px))' } }

const groupVisual = createGroupFileVisualAdapter(runtime)
for (const type of ['file-item', 'file-item-clone', 'folder-item', 'folder-item-clone']) {
  runtime.registerObjectType(type, {
    defaultVisualMode: type.endsWith('-clone') ? 'clone' : 'detach',
    visual: groupVisual,
    landingMode: 'target',
    motion: { enabled: true },
    preserveMoveTarget: true,
    proxyLayout: listProxyLayout,
  })
}

const domAdapter = createVueRuntimeAdapter(runtime)
useRuntimeAction(action => {
  if (action.type === 'move') {
    moveFile(action.objectId, action.toSurfaceId)
  }
  if (action.type === 'move-group') moveGroup(action)
})

onUnmounted(() => {
  stopSelectionBox()
  syncListRotation('grid')
  domAdapter.dispose()
})
</script>

<style scoped>
.file-demo { padding-top: 22px; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
.file-toolbar { display: flex; align-items: end; justify-content: space-between; gap: 20px; }
.file-toolbar h2 { margin: 0; font-size: 18px; }
.file-toolbar p { margin: 5px 0 0; color: #7c8497; font-size: 13px; }
.toolbar-controls { display: flex; align-items: center; gap: 10px; }
.mode-switch { display: flex; align-items: center; gap: 4px; padding: 4px; border: 1px solid #e0e4ee; border-radius: 9px; background: #fff; font-size: 12px; }
.mode-switch span { padding: 0 5px; color: #838ba0; }
.mode-switch button { border: 0; border-radius: 6px; padding: 7px 9px; color: #7b849b; background: transparent; cursor: pointer; }
.mode-switch button.active { color: #fff; background: #707aca; }
.view-switch { display: flex; gap: 4px; padding: 4px; border: 1px solid #e0e4ee; border-radius: 9px; background: #fff; }
.view-switch button { border: 0; border-radius: 6px; padding: 7px 12px; color: #7b849b; background: transparent; cursor: pointer; }
.view-switch button.active { color: #fff; background: #707aca; }
.selection-mode-button { display: inline-flex; align-self: stretch; align-items: center; justify-content: center; height: 43px; min-height: 43px; box-sizing: border-box; border: 1px solid #e0e4ee; border-radius: 9px; padding: 0 12px; background: #fff; color: #707aca; cursor: pointer; font: inherit; font-size: 12px; line-height: 1; }
.selection-mode-button:hover, .selection-mode-button.active { border-color: #b8bff0; background: #eef0ff; color: #5961b5; }
.breadcrumbs { display: flex; gap: 8px; align-items: center; margin: 18px 0 12px; color: #707aca; font-size: 13px; }
.breadcrumbs button { border: 0; background: transparent; color: inherit; cursor: pointer; padding: 0; }
.breadcrumbs button:not(:last-child)::after { content: ' / '; margin-left: 8px; color: #a4abc0; }
.file-layout { position: relative; display: grid; grid-template-columns: 210px minmax(0, 1fr); min-height: 490px; overflow: hidden; border: 1px solid #e0e4ee; border-radius: 14px; background: #fff; }
.folder-sidebar { max-height: 490px; overflow: auto; padding: 18px 12px; border-right: 1px solid #e7eaf2; background: #fbfcff; }
.folder-sidebar h3 { margin: 0 8px 12px; font-size: 12px; color: #9098aa; }
.folder-sidebar button { display: flex; align-items: center; gap: 8px; width: 100%; border: 0; border-radius: 8px; padding: 10px 8px; background: transparent; color: #59627a; text-align: left; cursor: pointer; }
.folder-sidebar button.selected { background: #eef0ff; color: #5961b5; }
.folder-sidebar small { margin-left: auto; color: #a4abc0; }
.file-surface { position: relative; min-width: 0; padding: 18px 20px; background: #fcfdff; }
.surface-heading { display: flex; justify-content: space-between; padding-bottom: 14px; border-bottom: 1px solid #edf0f5; color: #5b647b; font-size: 13px; }
.file-items { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 12px; padding-top: 18px; }
.file-items.is-list { display: flex; flex-direction: column; }
.empty-state { grid-column: 1 / -1; padding: 80px 20px; color: #a5acc0; text-align: center; }
.file-hint { margin: 12px 2px 0; color: #949caf; font-size: 12px; }
.selection-bar {
  position: absolute;
  left: calc(50% + 105px);
  bottom: 18px;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 10px 14px;
  border-radius: 14px;
  background: rgba(30, 32, 44, .88);
  box-shadow: 0 8px 28px rgba(0, 0, 0, .2);
  color: rgba(255, 255, 255, .9);
  backdrop-filter: blur(14px);
  z-index: 10;
  white-space: nowrap;
}
.selection-count { color: rgba(255, 255, 255, .82); font-size: 12px; }
.selection-hint { color: rgba(255, 255, 255, .54); font-size: 11px; }
.selection-cancel {
  border: 0;
  border-radius: 7px;
  padding: 5px 10px;
  background: rgba(255, 255, 255, .12);
  color: rgba(255, 255, 255, .75);
  cursor: pointer;
  font: inherit;
  font-size: 11px;
}
.selection-cancel:hover { background: rgba(255, 255, 255, .22); color: #fff; }
.selection-bar-enter-active, .selection-bar-leave-active { transition: opacity .18s ease, transform .18s ease; }
.selection-bar-enter-from, .selection-bar-leave-to { opacity: 0; transform: translate(-50%, 5px); }
.selection-box { position: absolute; z-index: 8; pointer-events: none; border: 1px solid rgba(112, 122, 202, .8); border-radius: 4px; background: rgba(112, 122, 202, .12); }
</style>
