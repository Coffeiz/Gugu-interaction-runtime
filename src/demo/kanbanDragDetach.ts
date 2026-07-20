import { runtime } from '../Runtime'
import {
  applyFloatingStyle,
  clearFloatingStyle,
  createDragProxy,
  destroyDragProxy,
  landDragProxy,
  moveFloating,
  settleFloatingLayout,
} from '../dom/Visual'
import { captureLayoutFlip, scheduleLayoutFlip } from '../dom/GroupLayout'
import { createDomHitResolver, hitWithResolver, type HitResult } from '../dom/Hit'
import type { VisualSnapshot } from '../dom/VisualAdapterTypes'
import { columns } from './store'

const LANDING_DURATION = 3000

function createDetachLandingVisual(
  sessionId: string,
  target: HTMLElement,
  beforeRect: DOMRect,
  dragSnapshot: VisualSnapshot | undefined,
  targetSnapshot: VisualSnapshot | undefined,
  beforeContent: HTMLElement,
  duration = LANDING_DURATION,
): { readonly finished: Promise<void>; readonly dispose: () => void } {
  const targetRect = target.getBoundingClientRect()
  const proxy = createDragProxy(beforeContent, beforeRect)
  const previousVisibility = target.style.visibility
  let disposed = false
  let stopTracking: () => void = () => undefined
  const dispose = () => {
    if (disposed) return
    disposed = true
    stopTracking()
    target.style.visibility = previousVisibility
    destroyDragProxy(proxy)
  }

  proxy.style.transition = 'none'
  if (dragSnapshot) {
    proxy.style.boxShadow = dragSnapshot.boxShadow
    proxy.style.borderRadius = dragSnapshot.borderRadius
    proxy.style.backgroundColor = dragSnapshot.background
    proxy.style.opacity = dragSnapshot.opacity
    proxy.style.transform = dragSnapshot.transform || 'scale(1.03)'
  }
  target.style.visibility = 'hidden'
  const { finished: landed, retarget } = landDragProxy(proxy, targetRect, {
    duration,
    targetShadow: targetSnapshot?.boxShadow,
    targetRadius: targetSnapshot?.borderRadius,
    targetBackground: targetSnapshot?.background,
    targetOpacity: targetSnapshot?.opacity,
    targetContent: target,
  })
  stopTracking = runtime.trackLandingTarget(sessionId, target, retarget)
  const finished = landed.finally(dispose)
  return { finished, dispose }
}

const kanbanHitResolver = createDomHitResolver({ surfaceSelector: '[data-column]', targetSelector: '[data-card]' })
runtime.setHitResolver(kanbanHitResolver)

/** detach 只保留 Teleport/本体浮动这一策略差异，其余输入、命中和阶段时序交给 Runtime。 */
export function startCardDragDetach(event: PointerEvent, cardId: string, sourceEl: HTMLElement) {
  if (!runtime.objects.hasAbility(cardId, 'move')) return
  event.preventDefault()

  const beforeContent = sourceEl.cloneNode(true) as HTMLElement
  const pickupCards = Array.from(document.querySelectorAll<HTMLElement>('[data-card]'))
    .filter(el => el !== sourceEl && el.dataset.runtimeProxy !== 'true')
  const beforePickup = captureLayoutFlip(pickupCards)
  scheduleLayoutFlip(beforePickup)

  runtime.objects.setElement(cardId, sourceEl)
  sourceEl.style.transition = 'none'
  sourceEl.style.transform = ''

  const handle = runtime.start({
    type: 'move',
    objectId: cardId,
    input: { kind: 'pointerdown', event },
  })
  const session = runtime.getSession(handle.id)!
  const visualAdapter = runtime.getVisualAdapter(runtime.objects.get(cardId)?.type ?? 'project-card')
  const objectLease = runtime.owner.takeObject(cardId, session.id)
  const moveContext = runtime.getMoveContext(session.id)
  const rect = sourceEl.getBoundingClientRect()
  const startX = event.clientX
  const startY = event.clientY
  const offsetX = moveContext.dragOffset.x
  const offsetY = moveContext.dragOffset.y

  applyFloatingStyle(sourceEl, rect)
  visualAdapter.applyState?.(sourceEl, {
    phase: 'dragging',
    hovered: sourceEl.matches(':hover'),
    selected: sourceEl.classList.contains('is-selected'),
    grabbed: true,
  })
  const draggingSnapshotBase = visualAdapter.captureVisualState?.(sourceEl)
  const draggingSnapshot = draggingSnapshotBase && {
    ...draggingSnapshotBase,
    boxShadow: sourceEl.style.boxShadow || draggingSnapshotBase.boxShadow,
    transform: sourceEl.style.transform || draggingSnapshotBase.transform,
  }
  sourceEl.dataset.runtimeActive = 'true'
  moveFloating(sourceEl, startX, startY, offsetX, offsetY)
  moveContext.followElement = sourceEl
  session.cleanup.track(() => {
    clearFloatingStyle(sourceEl)
    delete sourceEl.dataset.runtimeActive
    objectLease.release()
  })

  const initialColumnId = findColumnIdOf(cardId)
  let landingPlan: (() => void) | null = null
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

  function restoreCancelledLayout(): void {
    const returnCards = Array.from(document.querySelectorAll<HTMLElement>('[data-card]'))
      .filter(el => el !== sourceEl && el.dataset.runtimeProxy !== 'true')
    const returnBefore = captureLayoutFlip(returnCards)
    clearFloatingStyle(sourceEl)
    delete sourceEl.dataset.runtimeActive
    objectLease.release()
    scheduleLayoutFlip(returnBefore)
  }

  function commitDrop(destination: unknown): void {
    const drop = destination as HitResult
    const beforeRect = sourceEl.getBoundingClientRect()
    const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-card]'))
      .filter(el => el !== sourceEl && el.dataset.runtimeProxy !== 'true')
    const before = captureLayoutFlip(cards)
    scheduleLayoutFlip(before)

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

    settleFloatingLayout(sourceEl)
    delete sourceEl.dataset.runtimeActive
    objectLease.release()
    landingPlan = () => requestAnimationFrame(() => {
      clearFloatingStyle(sourceEl)
      const landedEl = visualAdapter.resolveTarget?.(cardId, drop)
        ?? document.querySelector<HTMLElement>(`[data-card="${cardId}"]`)
        ?? sourceEl
      visualAdapter.applyState?.(landedEl, {
        phase: 'revealing',
        hovered: landedEl.matches(':hover'),
        selected: landedEl.classList.contains('is-selected'),
        grabbed: false,
      })
      const targetSnapshot = visualAdapter.captureVisualState?.(landedEl)
      const landingVisual = createDetachLandingVisual(
        session.id,
        landedEl,
        beforeRect,
        draggingSnapshot,
        targetSnapshot,
        beforeContent,
      )
      session.cleanup.track(landingVisual.dispose)
      void landingVisual.finished.then(() => {
        if (session.state !== 'landing') return
        resolveLanding?.()
        resolveLanding = null
        revealPlan = () => undefined
      })
    })
  }

  runtime.orchestrateMoveSession(session.id, {
    surfaceIds: columns.map(col => `column:${col.id}`),
    driver: {
      resolveDestination: (_context, input) => resolveDestination(input),
      commit: (_context, destination) => commitDrop(destination),
      cancel: context => {
        if (context.session.state === 'prepare' || context.session.state === 'active' || context.session.state === 'release') {
          restoreCancelledLayout()
        }
      },
    },
    lifecycle: {
      landing: () => new Promise<void>(resolve => {
        resolveLanding = resolve
        landingPlan?.()
        landingPlan = null
      }),
      reveal: () => {
        revealPlan?.()
        revealPlan = null
      },
    },
  })
}
