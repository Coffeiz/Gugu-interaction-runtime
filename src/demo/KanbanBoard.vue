<template>
  <div class="kb-strategy-switch">
    <span>默认视觉模式：detach</span>
  </div>
  <div class="kb-board">
    <div v-for="col in columns" :key="col.id" class="kb-column" :data-column="col.id" data-layout-surface data-surface-type="kanban-column" :ref="el => setColumnRef(col.id, el as HTMLElement | null)">
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
                <TransitionGroup tag="div" class="kb-card-list" name="kb-card" :css="!columnControlled[col.id]">
                  <Teleport v-for="cardId in month.cardIds" :key="cardId" to="body" :disabled="!isDetached(cardId)">
                    <div
                      class="kb-card kb-card-done"
                      :class="{ 'kb-card-locked': isLocked(cardId) }"
                      :data-card="cardId"
                      :ref="el => bindCardPointer(cardId, el as HTMLElement | null)"
                    >
                      {{ cards[cardId].title }}<span v-if="isLocked(cardId)" class="kb-lock-hint"> 🔒 不可拖动</span>
                      <span class="kb-done-badge">✓ 完成</span>
                    </div>
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
        :css="!columnControlled[col.id]"
      >
        <Teleport v-for="cardId in col.cardIds" :key="cardId" to="body" :disabled="!isDetached(cardId)">
          <div
            class="kb-card"
            :class="{ 'kb-card-locked': isLocked(cardId) }"
            :data-card="cardId"
            :ref="el => bindCardPointer(cardId, el as HTMLElement | null)"
          >
            {{ cards[cardId].title }}<span v-if="isLocked(cardId)" class="kb-lock-hint"> 🔒 不可拖动</span>
          </div>
        </Teleport>
      </TransitionGroup>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watchEffect, onUnmounted } from 'vue'
import { columns, cards, moveCard } from './store'
import { buildDoneGroups } from './doneGrouping'
import { useRuntimeTransition } from '../vue/useRuntimeTransition'
import { DEFAULT_MOTION_PROFILE } from '../dom/MotionProfile'
import { useSurface } from '../vue/useSurface'
import { runtime } from '../Runtime'
import { FLIP_DURATION, FLIP_EASING } from '../dom/Flip'

// Runtime 默认使用 DefaultVisualAdapter 内置的 detach 策略，
// registerObjectType 不需要传 visual adapter
runtime.registerObjectType('kanban', {
  defaultVisualMode: 'detach',
  motion: {
    enabled: true,
    profile: {
      landing: { duration: 250, easing: 'cubic-bezier(.22,1,.36,1)' },
    },
  },
})

runtime.configureMotion({
  flip: { duration: 250, easing: 'cubic-bezier(.22,1,.36,1)' },
  resize: { duration: 250, easing: 'cubic-bezier(.22,1,.36,1)' },
  landing: { duration: 250, easing: 'cubic-bezier(.22,1,.36,1)' },
  group: { duration: 250, easing: 'cubic-bezier(.22,1,.36,1)' },
})

// 阶段 D：业务数据怎么变，由业务层订阅 Runtime 的 Action 通道自己决定，
// 不是 kanbanDrag.ts 直接调 moveCard——这两个文件现在
// 只负责生成"发生了什么"（Action），不负责"这意味着业务数据要怎么改"。
const stopActionSubscription = runtime.onAction(action => {
  if (action.type !== 'move') return
  const toColumnId = action.toSurfaceId.replace(/^column:/, '')
  moveCard(action.objectId, toColumnId, action.toIndex ?? 0)
})
onUnmounted(stopActionSubscription)

// 三个列数量固定、组件全程只挂载一次，属于合法的"静态次数"composable 调用
// （不是在 v-for 里动态调用）。每个列注册成一个 Surface，只接受
// 'kanban-card' 类型的对象——见 docs/DESIGN.md 原则 4、docs/PLAN.md 阶段 0.5。
const columnSurfaces = Object.fromEntries(
  columns.map(col => [
    col.id,
    useSurface({
      id: `column:${col.id}`,
      type: 'kanban-column',
      accepts: ['kanban-card'],

    }),
  ]),
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
    visual: 'kanban',
    visualMode: 'detach',
    surfaceId: '',
    element: null,
    abilities: cardId === 'c3' ? [] : ['move', 'sort'],
  })
})

function bindCardPointer(cardId: string, element: HTMLElement | null): void {
  runtime.objects.setElement(cardId, element)
}

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

// Owner 已属于框架无关 Core，不能再依赖直接读取 Map 触发 Vue 更新。
// 这里由 Vue adapter 订阅对象级 ownership 变化，驱动 Teleport 的 disabled 状态。
const ownershipVersion = ref(0)
const stopOwnershipSubscription = runtime.owner.subscribe(() => {
  ownershipVersion.value += 1
})
onUnmounted(stopOwnershipSubscription)

// detach 策略专用：这个对象当前是不是被 Runtime 接管了，接管了就要被
// <Teleport> 搬去 body。直接读 Owner 而不额外包一层 computed——Owner 内部
// 是 reactive(Map)，模板渲染时读取会被 Vue 的响应式系统正常追踪到。
function isDetached(cardId: string): boolean {
  ownershipVersion.value
  return runtime.owner.isControlled(cardId)
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

let groupToggleSeq = 0

function toggleGroup(level: 'year' | 'month', key: string) {
  const refs = level === 'year' ? yearContentRefs : monthContentRefs
  const openSet = level === 'year' ? openYears : openMonths
  const el = refs[key]
  const opening = !openSet.value.has(key)
  const next = new Set(openSet.value)
  if (opening) next.add(key)
  else next.delete(key)
  openSet.value = next
  if (!el) return
  const token = String(++groupToggleSeq)
  el.dataset.runtimeToggleToken = token
  const profile = runtime.getMotionProfile()?.group ?? DEFAULT_MOTION_PROFILE.group
  const duration = profile.duration
  const easing = profile.easing
  const current = el.getBoundingClientRect().height
  el.style.transition = ''
  el.style.height = `${current}px`
  el.style.overflow = 'hidden'
  void el.offsetHeight
  if (opening) {
    const target = el.scrollHeight
    el.style.transition = `height ${duration}ms ${easing}`
    el.style.height = `${target}px`
    window.setTimeout(() => {
      if (el.dataset.runtimeToggleToken !== token) return
      el.style.height = ''
      el.style.overflow = ''
      el.style.transition = ''
    }, duration + 40)
  } else {
    el.style.transition = `height ${duration}ms ${easing}`
    el.style.height = '0px'
    window.setTimeout(() => {
      if (el.dataset.runtimeToggleToken !== token) return
      el.style.transition = ''
    }, duration + 40)
  }
}

</script>

<style>
html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; }
#app { height: 100%; }

</style>

<style scoped>

.kb-strategy-switch { display: flex; gap: 16px; padding: 12px 24px 0; font-family: system-ui, sans-serif; font-size: 13px; }
.kb-board { display: flex; gap: 16px; padding: 24px; align-items: flex-start; font-family: system-ui, sans-serif; height: calc(100vh - 40px); }
.kb-column { max-height: calc(100vh - 40px - 48px); overflow-y: auto; overflow-anchor: none;
  width: 220px; background: #f4f5f7; border-radius: 10px; padding: 10px;
  display: flex; flex-direction: column; gap: 8px; min-height: 80px;
}
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
.kb-card-dragging-source { opacity: .35; visibility: hidden; }
.kb-card-move { transition: transform .22s cubic-bezier(.22,1,.36,1), box-shadow .15s ease; }
.kb-card-enter-active, .kb-card-leave-active { transition: opacity .18s ease; }
.kb-card-enter-from, .kb-card-leave-to { opacity: 0; }
/* 拖动期间禁用所有卡片 hover */
body.kb-dragging .kb-card:hover {
  transform: none;
  box-shadow: 0 1px 3px rgba(0,0,0,.08);
}
</style>
