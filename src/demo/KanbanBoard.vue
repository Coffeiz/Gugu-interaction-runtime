<template>
  <div class="kb-strategy-switch">
    <label><input type="radio" value="clone" v-model="strategy" /> clone 策略（proxy + 隐藏本体）</label>
    <label><input type="radio" value="detach" v-model="strategy" /> detach 策略（全程一个对象）</label>
  </div>
  <div class="kb-board">
    <div v-for="col in columns" :key="col.id" class="kb-column" :data-column="col.id" :ref="el => setColumnRef(col.id, el as HTMLElement | null)">
      <div class="kb-column-title">{{ col.title }}<span>{{ col.cardIds.length }}</span></div>

      <template v-if="col.id === 'done'">
        <div v-for="group in doneGroups" :key="group.name" class="kb-done-group">
          <div class="kb-done-group-title">{{ group.name }}</div>
          <TransitionGroup tag="div" class="kb-card-list" name="kb-card" :css="!columnControlled[col.id]">
            <Teleport v-for="cardId in group.cardIds" :key="cardId" to="body" :disabled="!isDetached(cardId)">
              <div
                class="kb-card kb-card-done"
                :class="{ 'kb-card-locked': isLocked(cardId) }"
                :data-card="cardId"
                @pointerdown="onCardPointerDown($event, cardId)"
              >
                {{ cards[cardId].title }}<span v-if="isLocked(cardId)" class="kb-lock-hint"> 🔒 不可拖动</span>
              </div>
            </Teleport>
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
        <Teleport v-for="cardId in col.cardIds" :key="cardId" to="body" :disabled="!isDetached(cardId)">
          <div
            class="kb-card"
            :class="{ 'kb-card-locked': isLocked(cardId) }"
            :data-card="cardId"
            @pointerdown="onCardPointerDown($event, cardId)"
          >
            {{ cards[cardId].title }}<span v-if="isLocked(cardId)" class="kb-lock-hint"> 🔒 不可拖动</span>
          </div>
        </Teleport>
      </TransitionGroup>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watchEffect } from 'vue'
import { columns, cards } from './store'
import { startCardDrag } from './kanbanDrag'
import { startCardDragDetach } from './kanbanDragDetach'
import { useRuntimeTransition } from '../vue/useRuntimeTransition'
import { useSurface } from '../vue/useSurface'
import { runtime } from '../Runtime'

const strategy = ref<'clone' | 'detach'>('clone')

// 三个列数量固定、组件全程只挂载一次，属于合法的"静态次数"composable 调用
// （不是在 v-for 里动态调用）。每个列注册成一个 Surface，只接受
// 'kanban-card' 类型的对象——见 docs/DESIGN.md 原则 4、docs/PLAN.md 阶段 0.5。
const columnSurfaces = Object.fromEntries(
  columns.map(col => [col.id, useSurface({ id: `column:${col.id}`, type: 'list', accepts: ['kanban-card'] })]),
)
function setColumnRef(colId: string, el: HTMLElement | null) {
  columnSurfaces[colId].elementRef.value = el
}

// 卡片没有各自独立的组件（demo 里所有卡片共用这一个模板渲染），没法像
// useObject 设计的那样"在拥有 DOM 的组件里调用一次"。这里退而求其次，
// 直接用 ObjectStore 的原始 API 做一次性注册 + 一个 watchEffect 保持
// surfaceId 跟着 columns 数据同步——真正接入业务时，每张卡片如果有自己
// 的组件，应该改成在那个组件里调用 useObject，而不是照抄这段。
// c3（"补充测试用例"）故意不给 'move' 能力，用来验证这条门禁是真的在
// 生效，不是摆设——demo 里它应该完全拖不动，pointerdown 直接被拒绝。
Object.keys(cards).forEach(cardId => {
  runtime.objects.register({
    id: cardId,
    type: 'kanban-card',
    surfaceId: '',
    element: null,
    abilities: cardId === 'c3' ? [] : ['move', 'sort'],
  })
})

function isLocked(cardId: string): boolean {
  return !runtime.objects.hasAbility(cardId, 'move')
}
watchEffect(() => {
  for (const col of columns) {
    for (const cardId of col.cardIds) {
      runtime.objects.setSurface(cardId, `column:${col.id}`)
    }
  }
})

// reactive() 让模板里 columnControlled[col.id] 能自动解包内部的 computed ref，
// 否则模板拿到的是 ref 对象本身而不是它的值。
const columnControlled = reactive(
  Object.fromEntries(columns.map(col => [col.id, useRuntimeTransition(`column:${col.id}`).controlled])),
)

// detach 策略专用：这个对象当前是不是被 Runtime 接管了，接管了就要被
// <Teleport> 搬去 body。直接读 Owner 而不额外包一层 computed——Owner 内部
// 是 reactive(Map)，模板渲染时读取会被 Vue 的响应式系统正常追踪到。
function isDetached(cardId: string): boolean {
  return runtime.owner.isControlled(cardId)
}

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
  if (strategy.value === 'detach') startCardDragDetach(event, cardId, el)
  else startCardDrag(event, cardId, el)
}
</script>

<style scoped>
.kb-strategy-switch { display: flex; gap: 16px; padding: 12px 24px 0; font-family: system-ui, sans-serif; font-size: 13px; }
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
  box-sizing: border-box;
  background: #fff; border-radius: 8px; padding: 10px 12px; font-size: 13px;
  box-shadow: 0 1px 3px rgba(0,0,0,.08); cursor: grab; user-select: none;
}
.kb-card-done { background: #f0f6ff; }
.kb-card-locked { cursor: not-allowed; opacity: .6; }
.kb-lock-hint { font-size: 11px; color: #999; }
.kb-card-dragging-source { opacity: .35; }
.kb-card-move { transition: transform .22s cubic-bezier(.22,1,.36,1); }
.kb-card-enter-active, .kb-card-leave-active { transition: opacity .18s ease; }
.kb-card-enter-from, .kb-card-leave-to { opacity: 0; }
</style>
