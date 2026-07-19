import { runtime } from '../Runtime'
import { createDragProxy, destroyDragProxy, moveDragProxy } from '../visual/Visual'
import { captureRects, playFlip } from '../layout/Flip'
import { columns, moveCard } from './store'

/**
 * 一次卡片拖拽 = 一个 Session。接管范围覆盖"这条交互会联动布局的一切"——
 * 三个列的 Surface 全部接管，而不是只接管被拖动的卡片本身，对应
 * docs/DESIGN.md 原则 2（否则会出现新模型接管卡片、旧模型还在控制列容器
 * 的混合态）。
 */
export function startCardDrag(event: PointerEvent, cardId: string, sourceEl: HTMLElement) {
  event.preventDefault()
  const session = runtime.startSession('kanban-card-move')
  session.takeObject(cardId)
  columns.forEach(col => session.takeSurface(`column:${col.id}`))

  const startX = event.clientX
  const startY = event.clientY
  const rect = sourceEl.getBoundingClientRect()
  const offsetX = startX - rect.left
  const offsetY = startY - rect.top

  sourceEl.classList.add('kb-card-dragging-source')
  const proxy = createDragProxy(sourceEl)
  moveDragProxy(proxy, startX, startY, offsetX, offsetY)

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
    moveDragProxy(proxy, moveEvent.clientX, moveEvent.clientY, offsetX, offsetY)
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
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    sourceEl.classList.remove('kb-card-dragging-source')
    destroyDragProxy(proxy)
    landing(session)
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

/**
 * 显式 handoff：业务状态已经稳定（moveCard 已经落定），下一帧再把控制权
 * 交还 Vue，避免 Vue 在恢复的这一帧又补播一次 enter/move 动画——见规则 7。
 */
function landing(session: ReturnType<typeof runtime.startSession>) {
  session.handoff()
  requestAnimationFrame(() => {
    runtime.endSession(session)
  })
}
