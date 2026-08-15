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
    <div ref="viewportRef" class="drawer-viewport" data-layout-role="viewport" data-drawer-scroll="projects">
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
 * 宽度变化只由 CSS 驱动；内容高度由 Runtime 的 floating Surface 统一测量和过渡。
 */
import { ref } from 'vue'

const props = withDefaults(defineProps<{
  collapsed: boolean
  collapsedWidth?: string
  openWidth?: string
}>(), {
  collapsedWidth: '50px',
  openWidth: '250px',
})

const rootRef = ref<HTMLElement | null>(null)
const viewportRef = ref<HTMLElement | null>(null)
const contentRef = ref<HTMLElement | null>(null)

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
