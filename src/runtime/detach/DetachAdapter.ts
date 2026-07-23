import { createDomHitResolver, hitWithResolver } from '../../dom/Hit'
import { captureLayoutFlip, scheduleLayoutFlip } from '../../dom/GroupLayout'
import { moveFloating, clearFloatingStyle, settleFloatingLayout, setProxyInteractive } from '../../dom/Visual'
import { captureDetachDraggingSnapshot, prepareDetachMotion, applyDetachPickupVisual, prepareDetachPickup, createDetachDropState, updateDetachDrop, prepareDetachLanding, resolveDetachLandingTarget, captureDetachTargetSnapshot, createDetachVisualContext, startDetachLandingVisual, completeDetachLanding, cancelDetachWithoutDrop, resolveDetachRegrabTarget, interruptDetachRegrab, scheduleDetachLandingFrame, createDetachLayoutLifecycle, createDetachLandingLifecycle, executeDetachDrag } from '../DetachMoveDriver'
import type { Runtime, RuntimeCompletionGate } from '../../Runtime'
import type { LandingResult, MoveBehaviorDriver, MoveVisualLifecycle } from '../../behavior/MoveBehavior'

export function createDetachMoveFromAdapter(config: {
  runtime: Runtime
  objectId: string
  element: HTMLElement
  event: PointerEvent
  fromRect?: DOMRect
  surfaceIds: string[]
  findColumnIdOf: (objectId: string) => string | undefined
}): { driver: MoveBehaviorDriver; lifecycle: MoveVisualLifecycle } {
  const { runtime, objectId, element, event, fromRect, surfaceIds, findColumnIdOf } = config
  const kanbanHitResolver = createDomHitResolver({ surfaceSelector: '[data-column]', targetSelector: '[data-card]' })
  let beforeContent: HTMLElement | undefined
  let draggingSnapshot: ReturnType<typeof captureDetachDraggingSnapshot> | undefined
  let dropState: ReturnType<typeof createDetachDropState<{ columnId: string; index: number }>> | undefined
  let pendingDrop: { columnId: string; index: number } | null = null
  let landingPlan: (() => void) | null = null
  let landingGate: RuntimeCompletionGate<LandingResult> | null = null
  let landingProxy: HTMLElement | null = null
  let released = false
  let sessionId: string | null = null

  function getSessionState() { return sessionId ? runtime.getSession(sessionId)?.state : undefined }

  function onMove(moveEvent: PointerEvent) {
    if (getSessionState() !== 'active') return
    if (!dropState) return
    const hit = updateDetachDrop({
      active: getSessionState() === 'active',
      event: moveEvent,
      state: dropState,
      resolve: (ev: PointerEvent) => hitWithResolver(runtime.getHitResolver() ?? kanbanHitResolver, ev.clientX, ev.clientY, objectId),
      getSurface: (drop: { columnId: string }) => drop.columnId,
    })
    if (!hit) return
    pendingDrop = hit
  }

  function onUp() {
    if (released) return { accepted: false as const }
    released = true
    if (!dropState || !sessionId) return { accepted: false as const }
    pendingDrop = dropState.release()
    if (!pendingDrop) {
      cancelDetachWithoutDrop({
        source: element,
        cancel: () => runtime.cancel(sessionId!, 'no-valid-drop'),
        clearFloating: clearFloatingStyle,
        clearActive: () => delete element.dataset.runtimeActive,
        releaseObject: () => {},
      })
      return { accepted: false as const }
    }
    const beforeRect = prepareDetachLanding({
      source: element,
      settle: settleFloatingLayout,
      clearActive: () => delete element.dataset.runtimeActive,
      releaseObject: () => {},
    })
    landingPlan = scheduleDetachLandingFrame(() => clearFloatingStyle(element), () => {
      const sid = sessionId!
      const landedEl = resolveDetachLandingTarget({
        resolve: () => {
          const allCards = document.querySelectorAll<HTMLElement>(`[data-card="${objectId}"]`)
          console.log('[createDetachMove] querySelectorAll', Array.from(allCards).map(el => ({ className: el.className, rect: el.getBoundingClientRect(), runtimeActive: el.dataset.runtimeActive, runtimeProxy: el.dataset.runtimeProxy, isConnected: el.isConnected, dataset: JSON.stringify(el.dataset) })))
          return runtime.resolveMoveTarget(sid, pendingDrop, () => {
            return document.querySelector<HTMLElement>(`[data-card="${objectId}"]`) ?? null
          })
        },
        applyState: (target: HTMLElement) => runtime.applyVisualState(objectId, target, { phase: 'revealing', hovered: false, selected: target.classList.contains('is-selected'), grabbed: false }),
      })
      if (!landedEl) { landingGate?.complete({ completed: true, reason: '' }); landingGate = null; return }
      console.log('[createDetachMove] landedEl', { className: landedEl.className, rect: landedEl.getBoundingClientRect() })
      const targetSnapshot = captureDetachTargetSnapshot((el: HTMLElement) => runtime.captureVisualState(objectId, el), landedEl)
      console.log('[createDetachMove] landing visual', { targetRect: landedEl.getBoundingClientRect() })
      const visualContext = createDetachVisualContext({
        createContext: () => runtime.createVisualLifecycleContext(sid, pendingDrop, landedEl, beforeContent!),
        source: element, sourceRect: beforeRect, visualSnapshot: draggingSnapshot!, targetSnapshot,
      })
      landingProxy = startDetachLandingVisual({
        createProxy: () => runtime.createVisualProxy(sid, visualContext) ?? null,
        enableProxy: (proxy: HTMLElement) => setProxyInteractive(proxy, true),
        bindRegrab: (proxy: HTMLElement) => runtime.bindRegrabTarget(sid, objectId, proxy, onRegrab),
        land: () => runtime.landVisualProxy(sid, landedEl, visualContext),
        onMissing: () => { landingGate?.complete({ completed: false, reason: 'visual-proxy-missing' }); landingGate = null },
        onComplete: (landingResult: LandingResult) => {
          completeDetachLanding({ active: getSessionState() === 'landing', result: landingResult, complete: (result: LandingResult) => landingGate?.complete(result), reveal: () => { void runtime.revealVisualProxy(sid, landedEl, visualContext) } })
          landingGate = null
        },
      })
    })
    return { accepted: true as const, destination: pendingDrop }
  }

  function onRegrab(regrabEvent: PointerEvent) {
    if (getSessionState() !== 'landing') return
    const proxy = landingProxy
    if (!proxy || !sessionId) return
    const liveEl = resolveDetachRegrabTarget(
      () => runtime.resolveVisualTarget(sessionId!, pendingDrop),
      () => document.querySelector<HTMLElement>(`[data-card="${objectId}"]`),
    )
    if (!liveEl) return
    const regrabContext = runtime.createRegrabContext(sessionId!, regrabEvent, proxy, liveEl)
    if (!regrabContext) return
    interruptDetachRegrab({
      event: regrabContext.event, sessionId: sessionId!, proxy, source: liveEl,
      interrupt: () => regrabContext.interrupt('regrab'),
      clearRegrab: () => runtime.clearRegrab(objectId),
      disposeProxy: () => runtime.disposeVisualProxy(sessionId!),
    })
    executeDetachDrag({ runtime, objectId, element: liveEl, event: regrabEvent, fromRect: regrabContext.proxyRect, surfaceIds, findColumnIdOf })
  }

  const driver: MoveBehaviorDriver = {
    prepare(ctx) {
      sessionId = ctx.session.id
      if (ctx.session.state !== 'prepare') return
      console.log('[prepare] before setElement', { rect: element.getBoundingClientRect() })
      runtime.objects.setElement(objectId, element)
      console.log('[prepare] before acquireObject', { rect: element.getBoundingClientRect() })
      runtime.acquireObject(sessionId!, objectId)
      console.log('[prepare] before takeSurfaces', { rect: element.getBoundingClientRect() })
      runtime.takeSurfaces(sessionId!, surfaceIds)
      console.log('[prepare] before pickup', { rect: element.getBoundingClientRect() })
      const { beforePickup } = prepareDetachPickup(element)
      beforeContent = element.cloneNode(true) as HTMLElement
      scheduleLayoutFlip(beforePickup)
      const moveContext = runtime.getMoveContext(sessionId!)
      const motion = prepareDetachMotion(moveContext, element, event, fromRect)
      const rect = motion.rect
      applyDetachPickupVisual((_id: string, el: HTMLElement, state: any) => runtime.applyVisualState(objectId, el, state), objectId, element, rect, fromRect)
      draggingSnapshot = captureDetachDraggingSnapshot((_id: string, el: HTMLElement) => runtime.captureVisualState(objectId, el), objectId, element)
      element.dataset.runtimeActive = 'true'
      moveFloating(element, event.clientX, event.clientY, motion.offsetX, motion.offsetY)
      dropState = createDetachDropState(
        findColumnIdOf(objectId),
        (ev: PointerEvent) => hitWithResolver(runtime.getHitResolver() ?? kanbanHitResolver, ev.clientX, ev.clientY, objectId),
        (drop: { columnId: string; index: number }, previous: { columnId: string; index: number } | null) => drop.columnId === previous?.columnId && drop.index === previous?.index,
      )
    },
    update(_ctx: any, input: any) { if (input.event instanceof PointerEvent) onMove(input.event) },
    resolveDestination() { return onUp() },
    commit: () => {
      settleFloatingLayout(element)
      document.body.classList.remove('kb-dragging')
    },
    cancel(_ctx: any, _reason: string) {
      released = true
      if (landingProxy) { runtime.disposeVisualProxy(sessionId!); landingProxy = null }
      runtime.clearRegrab(objectId)
      document.body.classList.remove('kb-dragging')
      delete element.dataset.runtimeActive
      clearFloatingStyle(element)
    },
  }

  const lifecycle: MoveVisualLifecycle = {
    layout: createDetachLayoutLifecycle(element),
    ...createDetachLandingLifecycle({
      createGate: () => runtime.createCompletionGate(sessionId!, { completed: false, reason: 'landing-cancelled' }),
      onGate: (gate: RuntimeCompletionGate<LandingResult>) => { landingGate = gate },
      clearDragging: () => document.body.classList.remove('kb-dragging'),
      scheduleLanding: () => { landingPlan?.(); landingPlan = null },
      clearRegrab: () => runtime.clearRegrab(objectId),
      finishReveal: () => { if (landingProxy) setProxyInteractive(landingProxy, false) },
    }),
  }

  return { driver, lifecycle }
}
