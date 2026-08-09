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
      </div>
    </div>

    <div class="breadcrumbs" data-file-surface="breadcrumbs">
      <button v-for="crumb in breadcrumbs" :key="crumb.id" :data-file-breadcrumb-id="crumb.id" @click="openFolder(crumb.id)" :ref="el => bindBreadcrumbSurface(crumb.id, el as HTMLElement | null)">{{ crumb.label }}</button>
    </div>

    <div class="file-layout">
      <aside class="folder-sidebar">
        <h3>文件夹</h3>
        <button v-for="folder in folders" :key="folder.id" :data-file-id="folder.id" :class="{ selected: folder.id === currentFolder }" :style="{ paddingLeft: `${8 + folderDepth(folder.id) * 16}px` }" @click="openFolder(folder.id)" :ref="el => bindFolderSurface(folder.id, el as HTMLElement | null)">
          <span>{{ folderDepth(folder.id) ? '└' : '▰' }}</span>{{ folder.name }}<small>{{ folderItemCount(folder.id) }}</small>
        </button>
      </aside>

      <section class="file-surface" data-file-surface="browser" data-layout-surface :ref="el => browserSurface.elementRef.value = el as HTMLElement | null">
        <div class="surface-heading"><span>{{ currentFolderName }}</span><span>{{ visibleItems.length }} 个项目</span></div>
        <div class="file-items" :class="`is-${view}`">
          <article v-for="item in visibleItems" :key="item.id" class="file-item" :class="{ folder: item.kind === 'folder' }" :data-file-id="item.id" :ref="el => bindItem(item.id, el as HTMLElement | null)" @click="item.kind === 'folder' && openFolder(item.id)">
            <div class="file-icon">{{ item.kind === 'folder' ? '▰' : fileIcon(item.name) }}</div>
            <div class="file-name">{{ item.name }}</div>
            <small>{{ item.kind === 'folder' ? `${folderItemCount(item.id)} 个项目` : item.size }}</small>
          </article>
          <div v-if="visibleItems.length === 0" class="empty-state">这个文件夹还是空的</div>
        </div>
      </section>
    </div>

    <p class="file-hint">拖动文件到左侧文件夹，或拖动文件夹调整目标位置。当前策略：{{ strategy }}。</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, reactive, ref, watch, watchEffect } from 'vue'
import { runtime } from '../Runtime'
import { useSurface } from '../vue/useSurface'

type FileItem = { id: string; name: string; kind: 'file' | 'folder'; parentId: string; size: string; children: FileItem[] }

const props = defineProps<{ strategy: 'detach' | 'clone' }>()
const strategy = ref(props.strategy)

const rootId = 'root'
const view = ref<'grid' | 'list'>('grid')
const currentFolder = ref(rootId)
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

const browserSurface = useSurface({ id: 'file:surface:browser', type: 'file-browser', accepts: ['file-item', 'file-item-clone', 'folder-item', 'folder-item-clone'] })
const folderSurfaces = files.filter(item => item.kind === 'folder').map(folder => ({
  id: folder.id,
  surface: useSurface({ id: `file:surface:${folder.id}`, type: 'file-folder', accepts: ['file-item', 'file-item-clone', 'folder-item', 'folder-item-clone'] }),
}))
const breadcrumbSurfaces = [rootId, ...files.filter(item => item.kind === 'folder').map(folder => folder.id)].map(id => ({
  id,
  surface: useSurface({ id: `file:breadcrumb:${id}`, type: 'file-breadcrumb', accepts: ['file-item', 'folder-item'] }),
}))
const registeredIds: string[] = []
runtime.registerObjectType('file-item', {
  defaultVisualMode: 'detach',
  landingMode: 'target',
  motion: { enabled: true },
  preserveMoveTarget: true,
  resolveMoveHit: resolveFileFolderHit,
  resolveMoveTarget: resolveFileLandingTarget,
  resolveMoveLandingTarget: resolveFileLandingTarget,
})
runtime.registerObjectType('file-item-clone', { defaultVisualMode: 'clone', motion: { enabled: true } })
runtime.registerObjectType('folder-item', {
  defaultVisualMode: 'detach',
  landingMode: 'target',
  motion: { enabled: true },
  preserveMoveTarget: true,
  resolveMoveHit: resolveFileFolderHit,
  resolveMoveTarget: resolveFileLandingTarget,
  resolveMoveLandingTarget: resolveFileLandingTarget,
})
runtime.registerObjectType('folder-item-clone', { defaultVisualMode: 'clone', motion: { enabled: true } })

function setStrategy(next: 'detach' | 'clone'): void {
  strategy.value = next
}

watch(() => props.strategy, next => {
  strategy.value = next
})

function bindItem(id: string, element: HTMLElement | null): void {
  runtime.objects.setElement(id, element)
}

function bindFolderSurface(id: string, element: HTMLElement | null): void {
  const entry = folderSurfaces.find(item => item.id === id)
  if (entry) entry.surface.elementRef.value = element
}

function bindBreadcrumbSurface(id: string, element: HTMLElement | null): void {
  const entry = breadcrumbSurfaces.find(item => item.id === id)
  if (entry) entry.surface.elementRef.value = element
}

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

function openFolder(id: string): void {
  currentFolder.value = id
}

function fileIcon(name: string): string {
  if (name.endsWith('.md')) return 'M'
  if (name.endsWith('.pdf')) return 'P'
  if (name.match(/\.(png|jpg|jpeg)$/i)) return 'I'
  return 'F'
}

function resolveFileFolderHit(point: { objectId: string; x: number; y: number }): { columnId: string; index: number } | null {
  const breadcrumb = Array.from(document.querySelectorAll<HTMLElement>('[data-file-breadcrumb-id]')).find(element => {
    const rect = element.getBoundingClientRect()
    return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom
  })
  const breadcrumbId = breadcrumb?.dataset.fileBreadcrumbId
  if (breadcrumbId) return { columnId: `file:breadcrumb:${breadcrumbId}`, index: 0 }

  const folder = Array.from(document.querySelectorAll<HTMLElement>('.file-item.folder[data-file-id]')).find(element => {
    if (element.closest('[data-runtime-proxy="true"]')) return false
    const rect = element.getBoundingClientRect()
    return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom
  })
  const folderId = folder?.dataset.fileId
  if (!folderId || folderId === point.objectId) return null
  return { columnId: `file:surface:${folderId}`, index: 0 }
}

function resolveFileLandingTarget(context: { objectId: string; destination: unknown }): HTMLElement | null {
  const destination = typeof context.destination === 'object' && context.destination !== null
    ? (context.destination as { columnId?: unknown; invalidReturn?: unknown }).columnId
    : undefined
  const invalidReturn = typeof context.destination === 'object' && context.destination !== null
    && (context.destination as { invalidReturn?: unknown }).invalidReturn === true
  if (typeof destination !== 'string') return null
  // 空白区域没有业务命中时，detach 会把源 Surface 作为回位目标。
  // 这里必须回到原文件节点，不能把整个文件面板当成一张“目标卡片”，
  // 否则 landing 代理会沿着面板矩形飞回，产生整块面板移动的错觉。
  const source = runtime.objects.get(context.objectId)?.element ?? null
  const sameSurface = runtime.objects.get(context.objectId)?.surfaceId === destination
    && Boolean(source?.isConnected)
  if (invalidReturn || sameSurface) {
    return source
  }
  // 跨目录时直接返回文件夹卡或面包屑作为视觉落点。Runtime 会把它视为
  // 语义目标，不要求它属于文件移动后的 destination surface。
  if (destination.startsWith('file:surface:folder:') || destination.startsWith('file:breadcrumb:')) {
    const id = destination.startsWith('file:breadcrumb:')
      ? destination.replace('file:breadcrumb:', '')
      : destination.replace('file:surface:', '')
    // 优先使用对象注册的真实节点。文件夹卡可能在 Vue 重排的一帧内暂时
    // 不在 querySelector 结果中，但 Runtime 对象仍保留稳定的身份映射。
    const registeredTarget = destination.startsWith('file:breadcrumb:')
      ? null
      : runtime.objects.get(id)?.element ?? null
    const surfaceTarget = runtime.surfaces.get(destination)?.element ?? null
    if (registeredTarget?.isConnected) {
      return registeredTarget
    }

    // 不使用带冒号的 CSS selector，避免策略切换或浏览器转义差异让目标
    // 解析失败；dataset 比较也能覆盖侧栏文件夹节点和内容区文件夹卡。
    const target = destination.startsWith('file:breadcrumb:')
      ? Array.from(document.querySelectorAll<HTMLElement>('[data-file-breadcrumb-id]'))
        .find(element => element.dataset.fileBreadcrumbId === id) ?? null
      : Array.from(document.querySelectorAll<HTMLElement>('[data-file-id]'))
        .find(element => element.dataset.fileId === id && element.dataset.runtimeProxy !== 'true') ?? null
    if (target?.isConnected) {
      return target
    }
    return surfaceTarget
  }
  return runtime.surfaces.get(destination)?.element ?? null
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

const stopAction = runtime.onAction(action => {
  if (action.type !== 'move' || (!action.objectId.startsWith('file:') && !action.objectId.startsWith('folder:'))) return
  moveFile(action.objectId, action.toSurfaceId)
})

watchEffect(() => {
  for (const item of files) {
    const type = item.kind === 'folder'
      ? (strategy.value === 'clone' ? 'folder-item-clone' : 'folder-item')
      : (strategy.value === 'clone' ? 'file-item-clone' : 'file-item')
    if (!runtime.objects.has(item.id)) {
      runtime.objects.register({
        id: item.id,
        type,
        visual: type,
        visualMode: strategy.value,
        surfaceId: item.parentId === rootId ? 'file:surface:browser' : `file:surface:${item.parentId}`,
        element: null,
        abilities: ['move', 'sort'],
      })
      registeredIds.push(item.id)
    } else {
      runtime.objects.register({
        ...runtime.objects.get(item.id)!,
        type,
        visual: type,
        visualMode: strategy.value,
      })
      runtime.objects.setSurface(item.id, item.parentId === rootId ? 'file:surface:browser' : `file:surface:${item.parentId}`)
    }
  }
})

onUnmounted(() => {
  stopAction()
  for (const id of registeredIds) runtime.objects.unregister(id)
  runtime.surfaces.unregister('file:surface:browser')
  for (const folder of folders.value) runtime.surfaces.unregister(`file:surface:${folder.id}`)
  for (const breadcrumb of breadcrumbSurfaces) runtime.surfaces.unregister(`file:breadcrumb:${breadcrumb.id}`)
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
.breadcrumbs { display: flex; gap: 8px; align-items: center; margin: 18px 0 12px; color: #707aca; font-size: 13px; }
.breadcrumbs button { border: 0; background: transparent; color: inherit; cursor: pointer; padding: 0; }
.breadcrumbs button:not(:last-child)::after { content: ' / '; margin-left: 8px; color: #a4abc0; }
.file-layout { display: grid; grid-template-columns: 210px minmax(0, 1fr); min-height: 490px; overflow: hidden; border: 1px solid #e0e4ee; border-radius: 14px; background: #fff; }
.folder-sidebar { max-height: 490px; overflow: auto; padding: 18px 12px; border-right: 1px solid #e7eaf2; background: #fbfcff; }
.folder-sidebar h3 { margin: 0 8px 12px; font-size: 12px; color: #9098aa; }
.folder-sidebar button { display: flex; align-items: center; gap: 8px; width: 100%; border: 0; border-radius: 8px; padding: 10px 8px; background: transparent; color: #59627a; text-align: left; cursor: pointer; }
.folder-sidebar button.selected { background: #eef0ff; color: #5961b5; }
.folder-sidebar small { margin-left: auto; color: #a4abc0; }
.file-surface { min-width: 0; padding: 18px 20px; background: #fcfdff; }
.surface-heading { display: flex; justify-content: space-between; padding-bottom: 14px; border-bottom: 1px solid #edf0f5; color: #5b647b; font-size: 13px; }
.file-items { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 12px; padding-top: 18px; }
.file-items.is-list { display: flex; flex-direction: column; }
.file-item { min-height: 106px; box-sizing: border-box; border: 1px solid #e3e7f0; border-radius: 10px; padding: 14px; background: #fff; box-shadow: 0 4px 16px rgba(50,60,100,.05); cursor: grab; user-select: none; }
.file-item.folder { border-color: #d7dcfa; background: #f8f9ff; }
.file-items.is-list .file-item { display: grid; grid-template-columns: 32px 1fr auto; align-items: center; min-height: 54px; padding: 10px 14px; }
.file-item:hover { border-color: #b8bff0; box-shadow: 0 7px 20px rgba(75,86,160,.12); }
.file-icon { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 8px; background: #eef0ff; color: #6972c5; font-weight: 700; }
.file-name { margin-top: 12px; color: #394156; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-items.is-list .file-name { margin: 0 12px; }
.file-item small { display: block; margin-top: 6px; color: #a0a7b8; font-size: 11px; }
.file-items.is-list small { margin: 0; }
.empty-state { grid-column: 1 / -1; padding: 80px 20px; color: #a5acc0; text-align: center; }
.file-hint { margin: 12px 2px 0; color: #949caf; font-size: 12px; }
</style>
