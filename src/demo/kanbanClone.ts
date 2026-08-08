import { runtime } from '../Runtime'
import { createDragProxy, destroyDragProxy, moveDragProxy } from '../dom/Visual'
import { captureRects, playFlip } from '../dom/Flip'
import { columns, moveCard } from './store'

const LANDING_DURATION = 220
const landingRegrabs = new Map<string, (event: PointerEvent) => void>()

/**
 * 看板 demo 的历史 clone 策略：源卡片保留列表占位，视觉上由一个 proxy 接管。
 * 它只用于对比 detach，不作为 Runtime 的默认策略。
 */
export function startCardDragClone(event: PointerEvent, cardId: string, sourceEl: HTMLElement, fromRect?: DOMRect): void {
  event.preventDefault()
  const regrab = landingRegrabs.get(cardId)
  if (regrab) {
    regrab(event)
    return
  }

  const session = runtime.startSession('kanban-card-move-clone')
  session.takeObject(cardId)
  columns.forEach(column => session.takeSurface(`column:${column.id}`))

  const rect = fromRect ?? sourceEl.getBoundingClientRect()
  const offsetX = event.clientX - rect.left
  const offsetY = event.clientY - rect.top
  const proxy = createDragProxy(sourceEl, rect, { glass: false })
  // 先复制可见源节点，再隐藏列表占位；否则源节点的 inline visibility 会被
  // 一并复制进 proxy，clone 模式会出现“拖动时代理也消失”。
  sourceEl.style.visibility = 'hidden'
  const proxyContent = proxy.querySelector<HTMLElement>('[data-runtime-proxy-content]')
  if (proxyContent) proxyContent.style.visibility = 'visible'
  moveDragProxy(proxy, event.clientX, event.clientY, offsetX, offsetY)

  let currentColumnId = findColumnId(cardId)
  let currentIndex = -1

  function hitTest(x: number, y: number): { columnId: string; index: number } | null {
    const columnEl = Array.from(document.querySelectorAll<HTMLElement>('[data-column]')).find(element => {
      const bounds = element.getBoundingClientRect()
      return x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom
    })
    if (!columnEl) return null
    const columnId = columnEl.dataset.column
    if (!columnId) return null
    const cardEls = Array.from(columnEl.querySelectorAll<HTMLElement>('[data-card]'))
      .filter(element => element.dataset.card !== cardId)
    let index = cardEls.length
    for (let i = 0; i < cardEls.length; i += 1) {
      const bounds = cardEls[i].getBoundingClientRect()
      if (y < bounds.top + bounds.height / 2) {
        index = i
        break
      }
    }
    return { columnId, index }
  }

  function onMove(moveEvent: PointerEvent): void {
    if (session.state !== 'active') return
    moveDragProxy(proxy, moveEvent.clientX, moveEvent.clientY, offsetX, offsetY)
    const hit = hitTest(moveEvent.clientX, moveEvent.clientY)
    if (!hit || (hit.columnId === currentColumnId && hit.index === currentIndex)) return
    currentColumnId = hit.columnId
    currentIndex = hit.index
    const affected = Array.from(document.querySelectorAll<HTMLElement>('[data-card]'))
    const before = captureRects(affected)
    moveCard(cardId, hit.columnId, hit.index)
    requestAnimationFrame(() => playFlip(affected, before))
  }

  function onUp(): void {
    if (session.state !== 'active') return
    session.state = 'landing'
    landingRegrabs.set(cardId, onRegrab)
    requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(`[data-card="${cardId}"]`)
      if (!target || session.state !== 'landing') {
        finish()
        return
      }
      target.style.visibility = 'hidden'
      const targetRect = target.getBoundingClientRect()
      proxy.style.transition = `left ${LANDING_DURATION}ms cubic-bezier(.22,1,.36,1), top ${LANDING_DURATION}ms cubic-bezier(.22,1,.36,1), transform ${LANDING_DURATION}ms ease`
      proxy.style.left = `${targetRect.left}px`
      proxy.style.top = `${targetRect.top}px`
      proxy.style.transform = 'scale(1)'
      const timer = window.setTimeout(finish, LANDING_DURATION + 60)
      session.cleanup.track(() => window.clearTimeout(timer))
    })
  }

  function finish(): void {
    if (session.state === 'done' || session.state === 'cancelled') return
    if (landingRegrabs.get(cardId) === onRegrab) landingRegrabs.delete(cardId)
    const target = document.querySelector<HTMLElement>(`[data-card="${cardId}"]`)
    if (target) target.style.visibility = ''
    destroyDragProxy(proxy)
    session.handoff()
    requestAnimationFrame(() => runtime.endSession(session))
  }

  function onRegrab(regrabEvent: PointerEvent): void {
    if (session.state !== 'landing') return
    regrabEvent.preventDefault()
    regrabEvent.stopPropagation()
    landingRegrabs.delete(cardId)
    const proxyRect = proxy.getBoundingClientRect()
    const target = document.querySelector<HTMLElement>(`[data-card="${cardId}"]`)
    if (target) target.style.visibility = ''
    destroyDragProxy(proxy)
    runtime.endSession(session)
    startCardDragClone(regrabEvent, cardId, sourceEl, proxyRect)
  }

  session.cleanup.trackListener(window, 'pointermove', onMove)
  session.cleanup.trackListener(window, 'pointerup', onUp)
  proxy.addEventListener('pointerdown', onRegrab)
  session.cleanup.track(() => proxy.removeEventListener('pointerdown', onRegrab))
}

function findColumnId(cardId: string): string | undefined {
  return columns.find(column => column.cardIds.includes(cardId))?.id
}
