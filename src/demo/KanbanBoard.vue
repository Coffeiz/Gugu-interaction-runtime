<template>
  <div class="kb-demo">
    <div class="kb-strategy-switch">
      <span>默认视觉模式：detach</span>
    </div>
    <div class="kb-board">
      <KanbanColumn
        v-for="col in columns"
        :key="col.id"
        :column-id="col.id"
        @element="setColumnElement(col.id, $event)"
      >
      <template #default="{ controlled }">
      <div class="kb-column-title">{{ col.title }}<span>{{ col.cardIds.length }}</span></div>

      <template v-if="col.id === 'done'">
        <div v-for="year in doneGroups" :key="year.key" class="kb-year-group" data-layout-group>
          <button class="kb-year-title" @click="toggleGroup('year', year.key)">
            <svg
              class="kb-year-chevron" :class="{ open: openYears.has(year.key) }"
              width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
            ><path d="M2 3.5l3 3 3-3" /></svg>
            {{ year.label }}<span>{{ year.cardIds.length }}</span>
          </button>
          <div class="kb-year-content" :ref="el => setGroupContentRef(yearContentRefs, year.key, el as HTMLElement | null)">
            <div v-for="month in year.months" :key="month.key" class="kb-month-group" data-layout-group>
              <button class="kb-month-title" @click="toggleGroup('month', month.key)">
                <svg
                  class="kb-month-chevron" :class="{ open: openMonths.has(month.key) }"
                  width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                ><path d="M2 3.5l3 3 3-3" /></svg>
                {{ month.label }}<span>{{ month.cardIds.length }}</span>
              </button>
              <div class="kb-month-content" :ref="el => setGroupContentRef(monthContentRefs, month.key, el as HTMLElement | null)">
                <TransitionGroup tag="div" class="kb-card-list" name="kb-card" :css="!controlled">
                  <Teleport v-for="cardId in month.cardIds" :key="cardId" to="body" :disabled="!isDetached(cardId)">
                    <KanbanCard
                      :card-id="cardId"
                      :title="cards[cardId].title"
                      :surface-id="`column:${col.id}`"
                      :strategy="props.strategy"
                      done
                      :locked="isLocked(cardId)"
                      @detached-change="setCardDetached(cardId, $event)"
                    />
                  </Teleport>
                </TransitionGroup>
              </div>
            </div>
          </div>
        </div>
      </template>

      <TransitionGroup
        v-else
        tag="div"
        class="kb-card-list"
        name="kb-card"
        :css="!controlled"
      >
        <Teleport v-for="cardId in col.cardIds" :key="cardId" to="body" :disabled="!isDetached(cardId)">
          <KanbanCard
            :card-id="cardId"
            :title="cards[cardId].title"
            :surface-id="`column:${col.id}`"
            :strategy="props.strategy"
            :locked="isLocked(cardId)"
            @detached-change="setCardDetached(cardId, $event)"
          />
        </Teleport>
      </TransitionGroup>
      </template>
      </KanbanColumn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref } from 'vue'
import { columns, cards, moveCard } from './store'
import { buildDoneGroups } from './doneGrouping'
import { DEFAULT_MOTION_PROFILE } from '../dom/MotionProfile'
import { runtime } from '../Runtime'
import KanbanCard from './KanbanCard.vue'
import KanbanColumn from './KanbanColumn.vue'
import { useRuntimeAction } from '../vue'

const props = defineProps<{ strategy: 'detach' | 'clone' }>()

// 看板默认使用 Runtime 内置的 detach 策略；clone 也通过同一默认视觉适配器接入，
// 方便对比两种策略，不在 Demo 侧编排 Session 或视觉生命周期。
runtime.registerObjectType('kanban', {
  defaultVisualMode: 'detach',
  motion: {
    enabled: true,
    profile: {
      landing: { duration: 1000, easing: 'cubic-bezier(.22,1,.36,1)' },
    },
  },
})
runtime.registerObjectType('kanban-clone', {
  defaultVisualMode: 'clone',
})

runtime.configureMotion({
  flip: { duration: 250, easing: 'cubic-bezier(.22,1,.36,1)' },
  resize: { duration: 250, easing: 'cubic-bezier(.22,1,.36,1)' },
  landing: { duration: 1000, easing: 'cubic-bezier(.22,1,.36,1)' },
  group: { duration: 250, easing: 'cubic-bezier(.22,1,.36,1)' },
})

// 阶段 D：业务数据怎么变，由业务层订阅 Runtime 的 Action 通道自己决定，
// 不是 kanbanDrag.ts 直接调 moveCard——这两个文件现在
// 只负责生成"发生了什么"（Action），不负责"这意味着业务数据要怎么改"。
useRuntimeAction(action => {
  if (action.type !== 'move') return
  const toColumnId = action.toSurfaceId.replace(/^column:/, '')
  moveCard(action.objectId, toColumnId, action.toIndex ?? 0)
})
const doneLayoutRoot = ref<HTMLElement | null>(null)
const detachedCards = reactive<Record<string, boolean>>({})
function setColumnElement(colId: string, el: HTMLElement | null) {
  if (colId === 'done') doneLayoutRoot.value = el
}
function setCardDetached(cardId: string, detached: boolean): void {
  detachedCards[cardId] = detached
}
function isDetached(cardId: string): boolean {
  return props.strategy === 'detach' && detachedCards[cardId] === true
}

function isLocked(cardId: string): boolean {
  return cardId === 'c3'
}

const doneColumn = computed(() => columns.find(col => col.id === 'done')!)
// 完成列按"年 > 月"两层分组，对应咕咕真实的多层分组结构（不是单层的
// "本周/上周"标签）。分组本身由 doneGrouping.ts 从真实日期推导。
const doneGroups = computed(() => buildDoneGroups(doneColumn.value.cardIds, cards))

// 年组、月组的展开/收起共用同一套逻辑——两层分组都是"内容全程留在 DOM
// 里（不用 v-if 卸载），折叠只是把 height 收到 0"，区别只是各自的
// ref 表和展开状态 Set 分开存，key 互不冲突（年份 key 和 'YYYY-MM' 月份
// key 本身不会撞）。默认全部展开。
const openYears = ref(new Set<string>(doneGroups.value.map(y => y.key)))
const openMonths = ref(new Set<string>(doneGroups.value.flatMap(y => y.months.map(m => m.key))))
const yearContentRefs: Record<string, HTMLElement | null> = {}
const monthContentRefs: Record<string, HTMLElement | null> = {}
function setGroupContentRef(refs: Record<string, HTMLElement | null>, key: string, el: HTMLElement | null) {
  refs[key] = el
}

async function toggleGroup(level: 'year' | 'month', key: string): Promise<void> {
  const refs = level === 'year' ? yearContentRefs : monthContentRefs
  const openSet = level === 'year' ? openYears : openMonths
  const el = refs[key]
  const root = doneLayoutRoot.value
  const opening = !openSet.value.has(key)
  if (!el || !root) {
    toggleGroupState(level, key)
    return
  }
  const profile = runtime.getMotionProfile()?.group ?? DEFAULT_MOTION_PROFILE.group
  await runtime.runGroupToggle({
    root,
    content: el,
    opening,
    mutate: () => toggleGroupState(level, key),
    waitForLayout: nextTick,
    duration: profile.duration,
    easing: profile.easing,
  })
}

function toggleGroupState(level: 'year' | 'month', key: string): void {
  const openSet = level === 'year' ? openYears : openMonths
  const next = new Set(openSet.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  openSet.value = next
}

</script>

<style>
html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; }
#app { height: 100%; }

</style>

<style scoped>

.kb-demo { display: flex; flex: 1; min-height: 0; flex-direction: column; }
.kb-strategy-switch { display: flex; flex: 0 0 auto; gap: 16px; padding: 12px 24px 0; font-family: system-ui, sans-serif; font-size: 13px; }
.kb-board { display: flex; flex: 1; min-height: 0; gap: 16px; padding: 24px; align-items: stretch; font-family: system-ui, sans-serif; }
.kb-column-title { display: flex; justify-content: space-between; font-weight: 600; font-size: 13px; color: #444; padding: 2px 4px; }
.kb-card-list { display: flex; flex-direction: column; gap: 8px; min-height: 4px; }
.kb-year-group { display: flex; flex-direction: column; overflow: visible; }
.kb-year-title {
  display: flex; align-items: center; gap: 6px; width: 100%;
  background: none; border: none; padding: 4px; margin: 0;
  font: 600 12px system-ui, sans-serif; color: #555; cursor: pointer; text-align: left;
  border-radius: 6px;
}
.kb-year-title:hover { background: rgba(0,0,0,.04); }
.kb-year-title > span { margin-left: auto; font-size: 10px; font-weight: 400; color: rgba(0,0,0,.38); }
.kb-year-chevron { flex-shrink: 0; color: rgba(0,0,0,.3); transform: rotate(0deg); transition: transform .2s cubic-bezier(.34,1.1,.64,1); }
.kb-year-chevron.open { transform: rotate(180deg); }
.kb-year-content { display: flex; flex-direction: column; gap: 10px; overflow: visible; }
.kb-month-group { display: flex; flex-direction: column; gap: 8px; padding-left: 4px; overflow: visible; }
.kb-month-title {
  display: flex; align-items: center; gap: 5px; width: 100%;
  background: none; border: none; padding: 3px 4px; margin: 0;
  font: 500 11px system-ui, sans-serif; color: #999; cursor: pointer; text-align: left;
  border-radius: 5px;
}
.kb-month-title:hover { background: rgba(0,0,0,.03); }
.kb-month-title > span { margin-left: auto; font-size: 10px; color: rgba(0,0,0,.3); }
.kb-month-chevron { flex-shrink: 0; color: rgba(0,0,0,.25); transform: rotate(0deg); transition: transform .2s cubic-bezier(.34,1.1,.64,1); }
.kb-month-chevron.open { transform: rotate(180deg); }
.kb-month-content { display: flex; flex-direction: column; overflow: visible; }
.kb-month-content .kb-card-list { padding-top: 6px; }
</style>
