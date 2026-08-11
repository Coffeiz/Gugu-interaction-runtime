<template>
  <section ref="rootRef" class="motion-debug-group">
    <button class="motion-debug-group-toggle" type="button" :aria-expanded="open" @click="toggle">
      <span>{{ title }}</span><span class="motion-debug-group-chevron" :class="{ open }">⌄</span>
    </button>
    <div ref="contentRef" class="motion-debug-group-content" :class="{ collapsed: !open }">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { runtime } from '../Runtime'

const props = defineProps<{ title: string; defaultOpen?: boolean }>()
const rootRef = ref<HTMLElement | null>(null)
const contentRef = ref<HTMLElement | null>(null)
const open = ref(props.defaultOpen ?? true)
let toggling = false

async function toggle(): Promise<void> {
  if (toggling || !rootRef.value || !contentRef.value) return
  toggling = true
  const opening = !open.value
  await runtime.runGroupToggle({
    root: rootRef.value,
    content: contentRef.value,
    opening,
    mutate: () => { open.value = opening },
    waitForLayout: () => nextTick(),
  })
  toggling = false
}
</script>

<style scoped>
.motion-debug-group { margin: 7px 0; border: 1px solid rgba(102,112,184,.16); border-radius: 6px; overflow: hidden; background: rgba(255,255,255,.34); }
.motion-debug-group-toggle { display: flex; width: 100%; align-items: center; justify-content: space-between; border: 0; padding: 7px 8px; background: rgba(102,112,184,.07); color: #6670b8; font: 600 11px system-ui, sans-serif; cursor: pointer; text-align: left; }
.motion-debug-group-chevron { transition: transform 250ms cubic-bezier(.22,1,.36,1); }
.motion-debug-group-chevron.open { transform: rotate(180deg); }
.motion-debug-group-content { box-sizing: border-box; padding: 8px 8px 1px; }
.motion-debug-group-content.collapsed { height: 0; padding-top: 0; padding-bottom: 0; pointer-events: none; }
</style>
