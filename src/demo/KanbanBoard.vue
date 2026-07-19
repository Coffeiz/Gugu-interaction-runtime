<template>
  <div class="kb-board">
    <div v-for="col in columns" :key="col.id" class="kb-column" :data-column="col.id">
      <div class="kb-column-title">{{ col.title }}<span>{{ col.cardIds.length }}</span></div>

      <template v-if="col.id === 'done'">
        <div v-for="group in doneGroups" :key="group.name" class="kb-done-group">
          <div class="kb-done-group-title">{{ group.name }}</div>
          <TransitionGroup tag="div" class="kb-card-list" name="kb-card" :css="!columnControlled[col.id]">
            <div
              v-for="cardId in group.cardIds"
              :key="cardId"
              class="kb-card kb-card-done"
              :data-card="cardId"
              @pointerdown="onCardPointerDown($event, cardId)"
            >
              {{ cards[cardId].title }}
            </div>
          </TransitionGroup>
        </div>
      </template>

      <TransitionGroup
        v-else
        tag="div"
        class="kb-card-list"
        name="kb-card"
        :css="!columnControlled[col.id]"
      >
        <div
          v-for="cardId in col.cardIds"
          :key="cardId"
          class="kb-card"
          :data-card="cardId"
          @pointerdown="onCardPointerDown($event, cardId)"
        >
          {{ cards[cardId].title }}
        </div>
      </TransitionGroup>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue'
import { columns, cards } from './store'
import { startCardDrag } from './kanbanDrag'
import { useRuntimeTransition } from '../vue/useRuntimeTransition'

// reactive() 让模板里 columnControlled[col.id] 能自动解包内部的 computed ref，
// 否则模板拿到的是 ref 对象本身而不是它的值。
const columnControlled = reactive(
  Object.fromEntries(columns.map(col => [col.id, useRuntimeTransition(`column:${col.id}`).controlled])),
)

const doneColumn = computed(() => columns.find(col => col.id === 'done')!)
const doneGroups = computed(() => {
  const groups = new Map<string, string[]>()
  for (const cardId of doneColumn.value.cardIds) {
    const name = cards[cardId].doneGroup ?? '其它'
    if (!groups.has(name)) groups.set(name, [])
    groups.get(name)!.push(cardId)
  }
  return Array.from(groups, ([name, cardIds]) => ({ name, cardIds }))
})

function onCardPointerDown(event: PointerEvent, cardId: string) {
  const el = (event.currentTarget as HTMLElement) ?? null
  if (!el) return
  startCardDrag(event, cardId, el)
}
</script>

<style scoped>
.kb-board { display: flex; gap: 16px; padding: 24px; align-items: flex-start; font-family: system-ui, sans-serif; }
.kb-column {
  width: 220px; background: #f4f5f7; border-radius: 10px; padding: 10px;
  display: flex; flex-direction: column; gap: 8px; min-height: 80px;
}
.kb-column-title { display: flex; justify-content: space-between; font-weight: 600; font-size: 13px; color: #444; padding: 2px 4px; }
.kb-card-list { display: flex; flex-direction: column; gap: 8px; min-height: 4px; }
.kb-done-group { display: flex; flex-direction: column; gap: 8px; }
.kb-done-group-title { font-size: 11px; color: #888; padding: 0 4px; }
.kb-card {
  background: #fff; border-radius: 8px; padding: 10px 12px; font-size: 13px;
  box-shadow: 0 1px 3px rgba(0,0,0,.08); cursor: grab; user-select: none;
}
.kb-card-done { background: #f0f6ff; }
.kb-card-dragging-source { opacity: .35; }
.kb-card-move { transition: transform .22s cubic-bezier(.22,1,.36,1); }
.kb-card-enter-active, .kb-card-leave-active { transition: opacity .18s ease; }
.kb-card-enter-from, .kb-card-leave-to { opacity: 0; }
</style>
