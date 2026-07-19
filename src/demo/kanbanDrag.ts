import { runtime } from '../Runtime'
import { createDragProxy, destroyDragProxy, moveDragProxy } from '../visual/Visual'
import { captureRects, playFlip } from '../layout/Flip'
import { columns, moveCard } from './store'

const LANDING_DURATION = 220

/**
 * 一次卡片拖拽 = 一个 Session。接管范围覆盖"这条交互会联动布局的一切"——
 * 三个列的 Surface 全部接管，而不是只接管被拖动的卡片本身，对应
 * docs/DESIGN.md 原则 2（否则会出现新模型接管卡片、旧模型还在控制列容器
 * 的混合态）。
 *
 * 落地（landing）不是瞬间发生的：松手后代理还要飞回真实卡片的位置，这段
 * 飞行期间允许被重新抓起（regrab）——这正是 Gugu-web clone2 落地中途被
 * 重新抓起那类 bug 的最小复现场景，用来验证"旧 Session 不会清理新 Session
 * 的样式"这条规则。
 */
export function startCardDrag(event: PointerEvent, cardId: string, sourceEl: HTMLElement, fromRect?: DOMRect) {
  event.preventDefault()
  const session = runtime.startSession('kanban-card-move')
  session.takeObject(cardId)
  columns.forEach(col => session.takeSurface(`column:${col.id}`))

  const rect = fromRect ?? sourceEl.getBoundingClientRect()
  const startX = event.clientX
  const startY = event.clientY
  const offsetX = startX - rect.left
  const offsetY = startY - rect.top

  sourceEl.classList.add('kb-card-dragging-source')
  const proxy = createDragProxy(sourceEl, rect)
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
    if (session.state !== 'active') return
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
    if (session.state !== 'active') return
    beginLanding()
  }

  function beginLanding() {
    session.state = 'landing'
    sourceEl.classList.remove('kb-card-dragging-source')
    requestAnimationFrame(() => {
      const targetEl = document.querySelector<HTMLElement>(`[data-card="${cardId}"]`)
      if (!targetEl || session.state !== 'landing') {
        finish()
        return
      }
      targetEl.style.visibility = 'hidden'
      const targetRect = targetEl.getBoundingClientRect()
      proxy.style.transition = `left ${LANDING_DURATION}ms cubic-bezier(.22,1,.36,1), top ${LANDING_DURATION}ms cubic-bezier(.22,1,.36,1), transform ${LANDING_DURATION}ms ease`
      proxy.style.left = `${targetRect.left}px`
      proxy.style.top = `${targetRect.top}px`
      proxy.style.transform = 'scale(1)'
      const timer = window.setTimeout(finish, LANDING_DURATION + 60)
      session.cleanup.track(() => window.clearTimeout(timer))
    })
  }

  function finish() {
    if (session.state === 'done' || session.state === 'cancelled') return
    const targetEl = document.querySelector<HTMLElement>(`[data-card="${cardId}"]`)
    if (targetEl) targetEl.style.visibility = ''
    destroyDragProxy(proxy)
    landing(session)
  }

  /** regrab：落地飞行途中重新抓起这张卡片，起点是代理当前的插值位置。 */
  function onRegrab(regrabEvent: PointerEvent) {
    if (session.state !== 'landing') return
    regrabEvent.stopPropagation()
    const proxyRect = proxy.getBoundingClientRect()
    // 旧 Session 只清理自己的东西：这里不调用 finish()/landing()，只是让旧
    // Session 直接结束（跳过它自己的落地收尾），新 Session 接管同一个视觉
    // 位置继续——不能让旧 Session 的收尾逻辑在新 Session 已经接管之后，还
    // 反过来清掉新 Session 正在用的样式（规则 5）。
    const targetEl = document.querySelector<HTMLElement>(`[data-card="${cardId}"]`)
    if (targetEl) targetEl.style.visibility = ''
    destroyDragProxy(proxy)
    runtime.endSession(session)
    startCardDrag(regrabEvent, cardId, sourceEl, proxyRect)
  }

  session.cleanup.trackListener(window, 'pointermove', onMove)
  session.cleanup.trackListener(window, 'pointerup', onUp)
  proxy.addEventListener('pointerdown', onRegrab)
  session.cleanup.track(() => proxy.removeEventListener('pointerdown', onRegrab))
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
