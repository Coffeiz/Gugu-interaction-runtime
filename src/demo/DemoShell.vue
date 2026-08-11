<template>
  <main class="demo-shell">
    <header class="demo-header">
      <div>
        <p class="demo-eyebrow">Gugu Interaction Runtime</p>
        <h1>交互 Runtime 演示台</h1>
      </div>
      <nav class="demo-tabs" aria-label="演示页面">
        <button :class="{ active: page === 'kanban' }" @click="page = 'kanban'">看板</button>
        <button :class="{ active: page === 'files' }" @click="page = 'files'">文件系统</button>
        <button :class="{ active: page === 'canvas' }" @click="page = 'canvas'">自由画布</button>
      </nav>
    </header>

    <section v-if="page === 'kanban'" class="demo-page kanban-page">
      <div class="page-toolbar">
        <div>
          <h2>看板拖拽</h2>
          <p>不改代码即可切换两种视觉策略，观察代理和布局交互的差异。</p>
        </div>
        <div class="mode-switch" aria-label="看板视觉策略">
          <span>视觉策略</span>
          <button :class="{ active: strategy === 'detach' }" @click="strategy = 'detach'">detach</button>
          <button :class="{ active: strategy === 'clone' }" @click="strategy = 'clone'">clone</button>
        </div>
      </div>
      <KanbanBoard :strategy="strategy" />
    </section>

    <section v-else-if="page === 'files'" class="demo-page">
      <FileSystemDemo :strategy="strategy" />
    </section>
    <section v-else class="demo-page canvas-page"><CanvasDemo /></section>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import KanbanBoard from './KanbanBoard.vue'
import FileSystemDemo from './FileSystemDemo.vue'
import CanvasDemo from './CanvasDemo.vue'

const page = ref<'kanban' | 'files' | 'canvas'>('kanban')
const strategy = ref<'detach' | 'clone'>('detach')
</script>

<style scoped>
.demo-shell { display: flex; height: 100%; min-height: 0; flex-direction: column; overflow: hidden; background: #f6f7fb; color: #202533; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
.demo-header { display: flex; flex: 0 0 auto; align-items: end; justify-content: space-between; gap: 24px; padding: 28px 32px 18px; border-bottom: 1px solid #e3e6ef; background: rgba(255,255,255,.84); }
.demo-eyebrow { margin: 0 0 5px; color: #7d86a0; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; }
h1, h2, p { margin: 0; }
h1 { font-size: 22px; letter-spacing: 0; }
.demo-tabs, .mode-switch { display: flex; align-items: center; gap: 6px; }
.demo-tabs button, .mode-switch button { border: 1px solid #dce1ec; border-radius: 8px; background: #fff; color: #65708a; padding: 8px 13px; cursor: pointer; }
.demo-tabs button.active, .mode-switch button.active { border-color: #7781d6; background: #707aca; color: #fff; }
.demo-page { min-height: 0; padding: 0 28px 28px; }
.canvas-page { display: flex; flex: 1; }
.kanban-page { display: flex; flex: 1; flex-direction: column; overflow: hidden; }
.page-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 22px 0 4px; }
.page-toolbar h2 { font-size: 18px; }
.page-toolbar p { margin-top: 5px; color: #7c8497; font-size: 13px; }
.mode-switch { padding: 6px; border: 1px solid #e0e4ee; border-radius: 10px; background: #fff; font-size: 12px; }
.mode-switch span { padding: 0 5px; color: #838ba0; }
</style>
