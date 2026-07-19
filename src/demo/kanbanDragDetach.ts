import { runtime } from '../Runtime'
import { applyFloatingStyle, clearFloatingStyle, moveFloating } from '../visual/Visual'
import { captureRects, playFlip } from '../layout/Flip'
import { columns, moveCard } from './store'

const LANDING_DURATION = 220

/**
 * "detach" 策略：全程只有一个对象——不克隆 proxy，本体自己脱离文档流。
 * 配合 KanbanBoard.vue 里的 `<Teleport :disabled="!isDetached(cardId)">`：
 * Runtime 一接管这个对象，Vue 就把它搬去 body；Runtime 松手，Vue 就把它
 * 摆回真实列表位置——DOM 搬运全程由 Vue 自己做，Runtime 只在"已经不受
 * Vue 管"的这段窗口里改它的内联定位样式。
 *
 * 跟 "clone" 策略（kanbanDrag.ts）比，这里不需要维护 landingRegrabs 登记
 * 表：这个节点全程只有一份，重新抓起就是对它再来一次 pointerdown，
 * getBoundingClientRect() 拿到的天然就是它当前的视觉位置——不管这个位置
 * 是"正在跟手"还是"正在 FLIP 回弹"。
 */
export function startCardDragDetach(event: PointerEvent, cardId: string, sourceEl: HTMLElement) {
  // 对象声明了自己不能参与 'move' 类型的 Session，直接拒绝。
  if (!runtime.objects.hasAbility(cardId, 'move')) return
  event.preventDefault()
  runtime.objects.setElement(cardId, sourceEl)
  // 如果这张卡此刻正在做落地 FLIP 回弹（transform/transition 还没播完，
  // 但已经不受 Runtime 控制），把残留的过渡状态清掉再开始新的一轮。
  sourceEl.style.transition = 'none'
  sourceEl.style.transform = ''

  const session = runtime.startSession('kanban-card-move-detach')
  // 对象的 Lease 单独持有（不放进 session 的 leases 数组）：落地时需要先
  // 单独释放它（触发 Teleport 把节点放回真实位置），同时继续拿着 Surface
  // 的 Lease 直到落地动画结束，让 Vue 的 TransitionGroup 全程保持关闭。
  const objectLease = runtime.owner.takeObject(cardId, session.id)
  columns.forEach(col => session.takeSurface(`column:${col.id}`))

  const rect = sourceEl.getBoundingClientRect()
  const startX = event.clientX
  const startY = event.clientY
  const offsetX = startX - rect.left
  const offsetY = startY - rect.top
  applyFloatingStyle(sourceEl, rect)
  moveFloating(sourceEl, startX, startY, offsetX, offsetY)

  let currentColumnId = findColumnIdOf(cardId)
  let currentIndex = -1

  function findColumnIdOf(id: string) {
    return columns.find(col => col.cardIds.includes(id))?.id
  }

  function hitTest(x: number, y: number): { columnId: string; index: number } | null {
    const columnEls = Array.from(document.querySelectorAll<HTMLElement>('[data-column]'))
    const columnEl = columnEls.find(el => {
      const r = el.getBoundingClientRect()
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
    })
    if (!columnEl) return null
    const columnId = columnEl.dataset.column!
    const cardEls = Array.from(columnEl.querySelectorAll<HTMLElement>('[data-card]')).filter(
      el => el.dataset.card !== cardId,
    )
    let index = cardEls.length
    for (let i = 0; i < cardEls.length; i++) {
      const cardRect = cardEls[i].getBoundingClientRect()
      if (y < cardRect.top + cardRect.height / 2) {
        index = i
        break
      }
    }
    return { columnId, index }
  }

  function onMove(moveEvent: PointerEvent) {
    if (session.state !== 'active') return
    moveFloating(sourceEl, moveEvent.clientX, moveEvent.clientY, offsetX, offsetY)
    const hit = hitTest(moveEvent.clientX, moveEvent.clientY)
    if (!hit) return
    if (hit.columnId === currentColumnId && hit.index === currentIndex) return
    currentColumnId = hit.columnId
    currentIndex = hit.index

    const affectedEls = Array.from(document.querySelectorAll<HTMLElement>('[data-card]'))
    const before = captureRects(affectedEls)
    moveCard(cardId, hit.columnId, hit.index)
    requestAnimationFrame(() => playFlip(affectedEls, before))
  }

  function onUp() {
    if (session.state !== 'active') return
    session.state = 'landing'
    const beforeRect = sourceEl.getBoundingClientRect()
    clearFloatingStyle(sourceEl)
    // 只放开这一个对象的 Lease：Vue 下一帧会把它摆回真实列表位置。
    // Surface 的 Lease（TransitionGroup 总闸）留到落地动画结束才一起释放。
    objectLease.release()
    requestAnimationFrame(() => {
      // 注意：这里不能继续用闭包里的 sourceEl。同列内重排时 Vue 确实会
      // 复用同一个节点（同一个 v-for 数组内 diff），但跨列拖拽时源列和
      // 目标列是两个独立的 v-for/TransitionGroup 实例，Vue 只能在源列里
      // 销毁旧节点、在目标列里创建一个新节点——Teleport 只能搬运"还活着
      // 的"vnode，搬不动"数组之间跳转"这件事本身。所以要重新查询一次
      // 当前真正渲染出来的节点：同列场景下查到的就是 sourceEl 本身，跨列
      // 场景下查到的是目标列刚创建的新节点——不管是哪种，用它当 FLIP 的
      // "to"，看起来都是同一个对象飞过去。
      const landedEl = document.querySelector<HTMLElement>(`[data-card="${cardId}"]`) ?? sourceEl
      playFlip([landedEl], new Map([[landedEl, beforeRect]]), LANDING_DURATION)
      const timer = window.setTimeout(() => runtime.endSession(session), LANDING_DURATION + 100)
      session.cleanup.track(() => window.clearTimeout(timer))
    })
  }

  session.cleanup.trackListener(window, 'pointermove', onMove)
  session.cleanup.trackListener(window, 'pointerup', onUp)
}
