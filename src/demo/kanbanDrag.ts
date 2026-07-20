import { runtime } from '../Runtime'
import { createDragPlaceholder, createDragProxy, destroyAllDragProxies, destroyDragPlaceholder, destroyDragProxy, landDragProxy, moveDragProxy } from '../dom/Visual'
import { captureLayoutFlip, scheduleLayoutFlip } from '../dom/GroupLayout'
import { createDomHitResolver, hitWithResolver, type HitResult } from '../dom/Hit'
import { columns } from './store'

const LANDING_DURATION = 220
const kanbanHitResolver = createDomHitResolver({ surfaceSelector: '[data-column]', targetSelector: '[data-card]' })
runtime.setHitResolver(kanbanHitResolver)

function hideLiveCard(cardId: string): void {
  document.querySelectorAll<HTMLElement>(`[data-card="${cardId}"]`).forEach(el => {
    if (el.dataset.runtimeProxy === 'true') return
    el.style.visibility = 'hidden'
  })
}

function showLiveCard(cardId: string): void {
  document.querySelectorAll<HTMLElement>(`[data-card="${cardId}"]`).forEach(el => {
    if (el.dataset.runtimeProxy !== 'true') el.style.visibility = ''
  })
}

function resolveLiveCard(cardId: string): HTMLElement | null {
  return Array.from(document.querySelectorAll<HTMLElement>(`[data-card="${cardId}"]`))
    .filter(el => el.dataset.runtimeProxy !== 'true' && el.isConnected)
    .find(el => {
      const rect = el.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0
    }) ?? null
}

/** clone 策略只提供视觉实现与 Action 提交；输入、命中结果保存和阶段时序由 Runtime 编排。 */
export function startCardDrag(event: PointerEvent, cardId: string, sourceEl: HTMLElement, fromRect?: DOMRect) {
  if (!runtime.objects.hasAbility(cardId, 'move')) return
  event.preventDefault()
  runtime.objects.setElement(cardId, sourceEl)

  const activeRegrab = runtime.getRegrab(cardId)
  if (activeRegrab) {
    activeRegrab(event)
    return
  }

  destroyAllDragProxies()
  const handle = runtime.start({
    type: 'move',
    objectId: cardId,
    input: { kind: 'pointerdown', event },
  })
  const session = runtime.getSession(handle.id)!
  const visualAdapter = runtime.getVisualAdapter(runtime.objects.get(cardId)?.type ?? 'project-card')
  const moveContext = runtime.getMoveContext(session.id)
  const rect = fromRect ?? sourceEl.getBoundingClientRect()
  const startX = event.clientX
  const startY = event.clientY
  const offsetX = fromRect ? startX - rect.left : moveContext.dragOffset.x
  const offsetY = fromRect ? startY - rect.top : moveContext.dragOffset.y
  moveContext.dragOffset = { x: offsetX, y: offsetY }

  sourceEl.classList.add('kb-card-dragging-source')
  sourceEl.dataset.runtimeActive = 'true'
  const placeholder = createDragPlaceholder(sourceEl, rect)
  sourceEl.style.display = 'none'
  const proxy = createDragProxy(sourceEl, rect)
  visualAdapter.applyState?.(proxy, {
    phase: 'dragging',
    hovered: sourceEl.matches(':hover'),
    selected: sourceEl.classList.contains('is-selected'),
    grabbed: true,
  })
  session.cleanup.track(() => destroyDragProxy(proxy))
  session.cleanup.track(() => destroyDragPlaceholder(placeholder))
  session.cleanup.track(() => {
    runtime.clearRegrab(cardId, onRegrab)
    sourceEl.classList.remove('kb-card-dragging-source')
    delete sourceEl.dataset.runtimeActive
    sourceEl.style.display = ''
    showLiveCard(cardId)
  })
  moveDragProxy(proxy, startX, startY, offsetX, offsetY)
  moveContext.followElement = proxy

  const initialColumnId = findColumnIdOf(cardId)
  let resolveLanding: (() => void) | null = null
  let revealPlan: (() => void) | null = null

  function findColumnIdOf(id: string) {
    return columns.find(col => col.cardIds.includes(id))?.id
  }

  function resolveDestination(input: { event?: Event }): HitResult | undefined {
    const moveEvent = input.event
    if (!(moveEvent instanceof PointerEvent)) return undefined
    return hitWithResolver(
      runtime.getHitResolver() ?? kanbanHitResolver,
      moveEvent.clientX,
      moveEvent.clientY,
      cardId,
    ) ?? undefined
  }

  function commitDrop(destination: unknown): void {
    const drop = destination as HitResult
    const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-card]'))
      .filter(el => el.dataset.card !== cardId && el !== proxy && el.dataset.runtimeProxy !== 'true')
    const before = captureLayoutFlip(cards)
    destroyDragPlaceholder(placeholder)
    sourceEl.style.display = ''

    if (initialColumnId) {
      runtime.emitAction({
        type: 'move',
        objectId: cardId,
        fromSurfaceId: `column:${initialColumnId}`,
        toSurfaceId: `column:${drop.columnId}`,
        toIndex: drop.index,
        timestamp: Date.now(),
      })
    }
    hideLiveCard(cardId)
    scheduleLayoutFlip(before)
  }

  function beginLanding(destination: unknown) {
    const drop = destination as HitResult
    sourceEl.classList.remove('kb-card-dragging-source')
    delete sourceEl.dataset.runtimeActive
    hideLiveCard(cardId)
    runtime.registerRegrab(cardId, onRegrab)

    requestAnimationFrame(() => {
      const targetEl = visualAdapter.resolveTarget?.(cardId, drop) ?? resolveLiveCard(cardId)
      if (!targetEl || session.state !== 'landing') {
        resolveLanding?.()
        resolveLanding = null
        revealPlan = finish
        return
      }

      const targetRect = targetEl.getBoundingClientRect()
      visualAdapter.applyState?.(targetEl, {
        phase: 'landing',
        hovered: targetEl.matches(':hover'),
        selected: targetEl.classList.contains('is-selected'),
        grabbed: false,
      })
      const targetSnapshot = visualAdapter.captureVisualState?.(targetEl)
      const targetStyle = getComputedStyle(targetEl)
      targetEl.style.visibility = 'hidden'
      const { finished, retarget } = landDragProxy(proxy, targetRect, {
        duration: LANDING_DURATION,
        targetShadow: targetSnapshot?.boxShadow ?? targetStyle.boxShadow,
        targetRadius: targetSnapshot?.borderRadius ?? targetStyle.borderRadius,
        targetBackground: targetSnapshot?.background ?? targetStyle.backgroundColor,
        targetOpacity: targetSnapshot?.opacity ?? targetStyle.opacity,
        targetContent: targetEl,
      })
      const stopTracking = runtime.trackLandingTarget(session.id, targetEl, retarget)

      void finished.then(() => {
        stopTracking()
        if (session.state !== 'landing') return
        resolveLanding?.()
        resolveLanding = null
        revealPlan = finish
      })
    })
  }

  function finish() {
    if (session.state === 'done' || session.state === 'cancelled') return
    runtime.clearRegrab(cardId, onRegrab)
    showLiveCard(cardId)
    delete sourceEl.dataset.runtimeActive
    sourceEl.style.display = ''
    destroyDragProxy(proxy)
  }

  function onRegrab(regrabEvent: PointerEvent) {
    if (session.state !== 'landing') return
    regrabEvent.stopPropagation()
    runtime.clearRegrab(cardId)
    const proxyRect = proxy.getBoundingClientRect()
    showLiveCard(cardId)
    delete sourceEl.dataset.runtimeActive
    destroyDragProxy(proxy)
    runtime.interrupt(session.id, 'regrab')
    startCardDrag(regrabEvent, cardId, sourceEl, proxyRect)
  }

  runtime.orchestrateMoveSession(session.id, {
    surfaceIds: columns.map(col => `column:${col.id}`),
    driver: {
      resolveDestination: (_context, input) => resolveDestination(input),
      commit: (_context, destination) => commitDrop(destination),
    },
    lifecycle: {
      landing: (_context, destination) => new Promise<void>(resolve => {
        resolveLanding = resolve
        beginLanding(destination)
      }),
      reveal: () => {
        revealPlan?.()
        revealPlan = null
      },
    },
  })

  proxy.addEventListener('pointerdown', onRegrab)
  session.cleanup.track(() => proxy.removeEventListener('pointerdown', onRegrab))
}
