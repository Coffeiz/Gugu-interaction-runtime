<template>
  <aside
    ref="rootRef"
    class="canvas-drawer"
    :class="{ 'is-collapsed': collapsed }"
    :style="{ '--drawer-width': collapsed ? collapsedWidth : openWidth }"
    data-runtime-surface
    data-floating-surface
  >
    <slot name="header" :collapsed="collapsed" />
    <div
      ref="viewportRef"
      class="drawer-viewport"
      data-layout-role="viewport"
      data-drawer-scroll="projects"
      :style="{ height: `${viewportHeight}px` }"
    >
      <div ref="contentRef" class="drawer-viewport-inner">
        <slot />
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
/**
 * 抽屉展示壳：宽度开合与内容自然高度分别处理。
 *
 * 宽度变化只由 CSS 驱动；内容变化由 ResizeObserver 提前记录自然高度，
 * 用单一的高度过渡收尾，避免宽度换行和高度事务互相抢写。
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  collapsed: boolean
  collapsedWidth?: string
  openWidth?: string
  maxHeight?: number
  duration?: number
  easing?: string
}>(), {
  collapsedWidth: '50px',
  openWidth: '250px',
  maxHeight: 420,
  duration: 340,
  easing: 'cubic-bezier(.22,1,.36,1)',
})

const rootRef = ref<HTMLElement | null>(null)
const viewportRef = ref<HTMLElement | null>(null)
const contentRef = ref<HTMLElement | null>(null)
const viewportHeight = ref(0)
const naturalHeight = ref(0)
let resizeObserver: ResizeObserver | null = null
let initialized = false
let pendingCleanup: (() => void) | null = null
let pendingTarget: number | null = null


function targetFor(collapsed: boolean, natural: number): number {
  return collapsed ? 0 : Math.min(props.maxHeight, Math.max(0, natural))
}

function applyHeight(next: number): void {
  const viewport = viewportRef.value
  if (!viewport) return
  if (!initialized) {
    viewportHeight.value = next
    initialized = true
    return
  }
  if (pendingTarget !== null ? Math.abs(next - pendingTarget) < 0.5 : Math.abs(next - viewportHeight.value) < 0.5) return

  pendingCleanup?.()
  pendingTarget = next
  const current = viewport.getBoundingClientRect().height
  viewport.style.transition = 'none'
  viewport.style.height = `${current}px`
  void viewport.offsetHeight

  let settled = false
  let fallback: ReturnType<typeof window.setTimeout> | null = null
  const settle = () => {
    if (settled) return
    settled = true
    viewport.removeEventListener('transitionend', onEnd)
    if (fallback !== null) window.clearTimeout(fallback)
    pendingCleanup = null
    viewport.style.transition = ''
    viewport.style.height = `${next}px`
    viewportHeight.value = next
    if (pendingTarget === next) pendingTarget = null
  }
  const onEnd = (event: TransitionEvent) => {
    if (event.target === viewport && event.propertyName === 'height') settle()
  }
  viewport.addEventListener('transitionend', onEnd)
  pendingCleanup = () => {
    viewport.removeEventListener('transitionend', onEnd)
    if (fallback !== null) window.clearTimeout(fallback)
    settled = true
  }
  requestAnimationFrame(() => {
    if (settled) return
    viewport.style.transition = `height ${props.duration}ms ${props.easing}`
    viewport.style.height = `${next}px`
  })
  fallback = window.setTimeout(settle, props.duration + 260)
}

function updateNaturalHeight(): void {
  naturalHeight.value = contentRef.value?.scrollHeight ?? 0
  applyHeight(targetFor(props.collapsed, naturalHeight.value))
}

onMounted(() => {
  if (!contentRef.value) return
  resizeObserver = new ResizeObserver(updateNaturalHeight)
  resizeObserver.observe(contentRef.value)
  updateNaturalHeight()
})

watch(() => props.collapsed, collapsed => {
  applyHeight(targetFor(collapsed, naturalHeight.value))
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  pendingCleanup?.()
})

defineExpose({
  rootRef,
  viewportRef,
  contentRef,
  get element() { return rootRef.value },
})
</script>

<style scoped>
.canvas-drawer {
  position: absolute; z-index: 4; top: 50%; right: 14px;
  display: flex; width: var(--drawer-width); flex-direction: column;
  overflow: hidden; border: 1px solid #dfe3ef; border-radius: 25px;
  background: rgba(255,255,255,.82); box-shadow: 0 12px 28px rgba(67,75,108,.12);
  backdrop-filter: blur(18px); transform: translateY(-50%);
  transition: width .38s cubic-bezier(.22,1,.36,1), background .25s ease, box-shadow .25s ease;
}
.drawer-viewport { position: relative; width: 100%; overflow-x: hidden; overflow-y: auto; overflow-anchor: none; }
.drawer-viewport::-webkit-scrollbar { width: 3px; }
.drawer-viewport::-webkit-scrollbar-track { background: transparent; }
.drawer-viewport::-webkit-scrollbar-thumb { background: rgba(0,0,0,.12); border-radius: 99px; }
.drawer-viewport-inner {
  display: flex; flex-direction: column; gap: 12px; padding: 14px; box-sizing: border-box;
  opacity: 1; filter: blur(0);
  transition: opacity .26s cubic-bezier(.22,1,.36,1), filter .26s cubic-bezier(.22,1,.36,1);
}
.canvas-drawer.is-collapsed .drawer-viewport { pointer-events: none; overflow-y: hidden; }
.canvas-drawer.is-collapsed .drawer-viewport-inner { opacity: 0; filter: blur(6px); }
</style>
