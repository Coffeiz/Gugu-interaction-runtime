<template>
  <aside ref="rootRef" class="canvas-drawer" :class="{ 'is-collapsed': collapsed }">
    <slot name="header" :collapsed="collapsed" />
    <div class="drawer-viewport" :style="{ height: `${viewportHeight}px` }">
      <div ref="contentRef" class="drawer-viewport-inner"><slot /></div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  collapsed: boolean
  maxHeight?: number
  duration?: number
  easing?: string
}>(), {
  maxHeight: 420,
  duration: 340,
  easing: 'cubic-bezier(.22,1,.36,1)',
})

const rootRef = ref<HTMLElement | null>(null)
const contentRef = ref<HTMLElement | null>(null)
const viewportHeight = ref(0)
let observer: ResizeObserver | null = null
let initialized = false

function applyHeight(next: number): void {
  const viewport = contentRef.value?.parentElement
  if (!viewport) return
  if (!initialized) {
    viewportHeight.value = next
    initialized = true
    return
  }
  const current = viewport.getBoundingClientRect().height
  viewport.style.transition = 'none'
  viewport.style.height = `${current}px`
  void viewport.offsetHeight
  requestAnimationFrame(() => {
    viewport.style.transition = `height ${props.duration}ms ${props.easing}`
    viewport.style.height = `${next}px`
    window.setTimeout(() => { viewport.style.transition = ''; viewportHeight.value = next }, props.duration + 30)
  })
}

onMounted(() => {
  if (!contentRef.value) return
  observer = new ResizeObserver(() => {
    const natural = contentRef.value?.scrollHeight ?? 0
    applyHeight(props.collapsed ? 0 : Math.min(props.maxHeight, natural))
  })
  observer.observe(contentRef.value)
  applyHeight(props.collapsed ? 0 : Math.min(props.maxHeight, contentRef.value.scrollHeight))
})
watch(() => props.collapsed, collapsed => {
  const natural = contentRef.value?.scrollHeight ?? 0
  applyHeight(collapsed ? 0 : Math.min(props.maxHeight, natural))
})
onBeforeUnmount(() => observer?.disconnect())

defineExpose({ get element() { return rootRef.value } })
</script>

<style scoped>
.canvas-drawer { position: relative; display: flex; width: 250px; flex: 0 0 250px; flex-direction: column; overflow: hidden; border: 1px solid #dfe3ef; border-radius: 22px; background: rgba(255,255,255,.82); box-shadow: 0 12px 28px rgba(67,75,108,.12); backdrop-filter: blur(18px); transition: width .38s cubic-bezier(.22,1,.36,1), flex-basis .38s cubic-bezier(.22,1,.36,1); }
.canvas-drawer.is-collapsed { width: 50px; flex-basis: 50px; }
.drawer-viewport { position: relative; overflow: hidden; }
.drawer-viewport-inner { display: flex; flex-direction: column; gap: 12px; padding: 14px; box-sizing: border-box; transition: opacity .26s cubic-bezier(.22,1,.36,1), filter .26s cubic-bezier(.22,1,.36,1); }
.canvas-drawer.is-collapsed .drawer-viewport { pointer-events: none; }
.canvas-drawer.is-collapsed .drawer-viewport-inner { opacity: 0; filter: blur(6px); }
</style>
