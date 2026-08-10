<template>
  <div
    ref="elementRef"
    class="kb-card"
    :class="{ 'kb-card-done': done, 'kb-card-locked': locked }"
    :data-card="cardId"
  >
    {{ title }}<span v-if="locked" class="kb-lock-hint"> 🔒 不可拖动</span>
    <span v-if="done" class="kb-done-badge">✓ 完成</span>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useObject, useRuntimeTransition } from '../vue'

const props = defineProps<{
  cardId: string
  title: string
  surfaceId: string
  strategy: 'detach' | 'clone'
  done?: boolean
  locked?: boolean
}>()
const emit = defineEmits<{ 'detached-change': [detached: boolean] }>()

const type = computed(() => props.strategy === 'clone' ? 'kanban-card-clone' : 'kanban-card')
const visual = computed(() => props.strategy === 'clone' ? 'kanban-clone' : 'kanban')
const abilities = computed(() => props.locked ? [] : ['move', 'sort'])

const { elementRef } = useObject({
  id: props.cardId,
  type,
  visual,
  visualMode: computed(() => props.strategy),
  surface: computed(() => props.surfaceId),
  abilities,
})
const { controlled } = useRuntimeTransition(props.cardId)
watch(
  controlled,
  value => emit('detached-change', props.strategy === 'detach' && value),
  { immediate: true },
)
</script>

<style scoped>
.kb-card {
  box-sizing: border-box;
  background: #fff; border-radius: 8px; padding: 10px 12px; font-size: 13px;
  box-shadow: 0 1px 3px rgba(0,0,0,.08); cursor: grab; user-select: none;
  transition: box-shadow .15s ease, transform .15s ease;
}
.kb-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,.12);
}
.kb-card[data-runtime-landing-capture="true"]:hover {
  transform: none !important;
  box-shadow: 0 1px 3px rgba(0,0,0,.08) !important;
}
.kb-card-done { background: #f0f6ff; }
.kb-card-locked { cursor: not-allowed; opacity: .6; }
.kb-lock-hint { font-size: 11px; color: #999; }
.kb-done-badge {
  display: inline-flex; align-items: center; margin-left: 6px;
  font-size: 10px; font-weight: 700; color: #3a8870;
  background: rgba(90,158,136,.12); border-radius: 20px; padding: 0 6px;
  box-shadow: inset 0 0 0 1px rgba(90,158,136,.35);
}
.kb-card-move { transition: transform .22s cubic-bezier(.22,1,.36,1), box-shadow .15s ease; }
.kb-card-enter-active, .kb-card-leave-active { transition: opacity .18s ease; }
.kb-card-enter-from, .kb-card-leave-to { opacity: 0; }
/* 拖动期间禁用所有卡片 hover */
:global(body.kb-dragging) .kb-card:hover {
  transform: none;
  box-shadow: 0 1px 3px rgba(0,0,0,.08);
}
</style>
