import { captureLayoutFlip, scheduleLayoutFlip } from '../dom/GroupLayout'
import type { LandingResult, MoveBehaviorDriver, MoveContext, MoveVisualLifecycle } from '../behavior/MoveBehavior'
import type { VisualSnapshot, VisualState } from '../dom/VisualAdapterTypes'
import { applyFloatingStyle, clearFloatingStyle, moveFloating, settleFloatingLayout } from '../dom/Visual'
import { releaseVisibilityOwnership, setProxyInteractive } from '../dom/Visual'
import { createDomHitResolver, hitWithResolver } from '../dom/Hit'
import type { Runtime, RuntimeCompletionGate } from '../Runtime'



export function createDetachMoveRequest(objectId: string, event: PointerEvent) {
  return {
    type: 'move' as const,
    objectId,
    input: { kind: 'pointerdown' as const, event },
  }
}



export function captureDetachDraggingSnapshot(
  capture: (objectId: string, element: HTMLElement) => VisualSnapshot,
  objectId: string,
  element: HTMLElement,
): VisualSnapshot {
  const snapshot = capture(objectId, element)
  return {
    ...snapshot,
    boxShadow: element.style.boxShadow || snapshot.boxShadow,
    transform: element.style.transform || snapshot.transform,
  }
}



export function prepareDetachMotion(
  context: MoveContext,
  element: HTMLElement,
  event: PointerEvent,
  fromRect?: DOMRect,
): { rect: DOMRect; offsetX: number; offsetY: number } {
  const rect = fromRect ?? element.getBoundingClientRect()
  const offsetX = fromRect ? event.clientX - rect.left : context.dragOffset.x
  const offsetY = fromRect ? event.clientY - rect.top : context.dragOffset.y
  if (fromRect) context.dragOffset = { x: offsetX, y: offsetY }
  return { rect, offsetX, offsetY }
}



export function applyDetachPickupVisual(
  applyState: (objectId: string, element: HTMLElement, state: VisualState) => void,
  objectId: string,
  element: HTMLElement,
  rect: DOMRect,
  fromRect?: DOMRect,
): void {
  element.style.transform = ''
  applyFloatingStyle(element, rect)
  document.body.classList.add('kb-dragging')
  if (fromRect) element.style.transition = 'none'
  applyState(objectId, element, {
    phase: 'dragging',
    hovered: element.matches(':hover'),
    selected: element.classList.contains('is-selected'),
    grabbed: true,
  })
}



export interface DetachPickupPreparation {
  readonly beforeContent: HTMLElement
  readonly beforePickup: ReturnType<typeof captureLayoutFlip>
}



export function prepareDetachPickup(sourceElement: HTMLElement): DetachPickupPreparation {
  const beforeContent = sourceElement.cloneNode(true) as HTMLElement
  const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-card]'))
    .filter(element => element !== sourceElement && element.dataset.runtimeProxy !== 'true')
  return { beforeContent, beforePickup: captureLayoutFlip(cards) }
}



export function prepareDetachSession<TLease>(
  acquireObject: (sessionId: string, objectId: string) => TLease,
  takeSurfaces: (sessionId: string, surfaceIds: string[]) => void,
  sessionId: string,
  objectId: string,
  surfaceIds: string[],
): TLease {
  const objectLease = acquireObject(sessionId, objectId)
  takeSurfaces(sessionId, surfaceIds)
  return objectLease
}



export function startDetachSession<TSession, TLease>(
  start: () => { id: string },
  getSession: (sessionId: string) => TSession | undefined,
  prepare: (sessionId: string) => TLease,
): { session: TSession; objectLease: TLease } {
  const handle = start()
  const session = getSession(handle.id)
  if (!session) throw new Error('detach session was not created')
  return { session, objectLease: prepare(handle.id) }
}



export function createDetachDropState<TDrop>(
  initialSurface: string | undefined,
  resolve: (event: PointerEvent) => TDrop | null,
  same: (drop: TDrop, previous: TDrop | null) => boolean,
) {
  let currentSurface = initialSurface
  let pending: TDrop | null = null
  return {
    update(event: PointerEvent, getSurface: (drop: TDrop) => string): TDrop | null {
      const drop = resolve(event)
      if (!drop || same(drop, pending)) return pending
      currentSurface = getSurface(drop)
      pending = drop
      return pending
    },
    release(): TDrop | null {
      return pending
    },
    get currentSurface(): string | undefined {
      return currentSurface
    },
  }
}



export function updateDetachDrop<TDrop>(args: {
  active: boolean
  event: PointerEvent
  state: ReturnType<typeof createDetachDropState<TDrop>>
  resolve: (event: PointerEvent) => TDrop | null
  getSurface: (drop: TDrop) => string
}): TDrop | null {
  if (!args.active) return null
  return args.state.update(args.event, args.getSurface)
}



export function interruptDetachRegrab(args: {
  event: PointerEvent
  proxy: HTMLElement
  source: HTMLElement
  sessionId: string
  interrupt: () => void
  clearRegrab: () => void
  disposeProxy: () => void
}): void {
  args.event.stopPropagation()
  setProxyInteractive(args.proxy, false)
  args.clearRegrab()
  releaseVisibilityOwnership(args.source, args.sessionId)
  args.interrupt()
  args.source.style.visibility = ''
  args.disposeProxy()
}



export function cancelDetachWithoutDrop(args: {
  source: HTMLElement
  cancel: () => void
  releaseObject: () => void
  clearFloating: (element: HTMLElement) => void
  clearActive: () => void
}): void {
  document.body.classList.remove('kb-dragging')
  const returnCards = Array.from(document.querySelectorAll<HTMLElement>('[data-card]'))
    .filter(element => element !== args.source && element.dataset.runtimeProxy !== 'true')
  const returnBefore = captureLayoutFlip(returnCards)
  args.cancel()
  args.clearFloating(args.source)
  args.clearActive()
  args.releaseObject()
  scheduleLayoutFlip(returnBefore)
}



export function prepareDetachLanding(args: {
  source: HTMLElement
  settle: (element: HTMLElement) => void
  clearActive: () => void
  releaseObject: () => void
}): DOMRect {
  const beforeRect = args.source.getBoundingClientRect()
  args.settle(args.source)
  args.clearActive()
  args.releaseObject()
  return beforeRect
}



export function scheduleDetachLandingFrame(
  clearFloating: () => void,
  callback: () => void,
): () => void {
  return () => requestAnimationFrame(() => {
    clearFloating()
    callback()
  })
}



export function resolveDetachLandingTarget<TDestination>(args: {
  resolve: () => HTMLElement | null
  applyState: (element: HTMLElement) => void
}): HTMLElement | null {
  const target = args.resolve()
  if (!target) return null
  args.applyState(target)
  return target
}



export function captureDetachTargetSnapshot(
  capture: (element: HTMLElement) => VisualSnapshot,
  element: HTMLElement,
): VisualSnapshot {
  const transition = element.style.transition
  element.dataset.runtimeLandingCapture = 'true'
  element.style.transition = 'none'
  void element.offsetWidth
  const snapshot = capture(element)
  element.style.transition = transition
  delete element.dataset.runtimeLandingCapture
  return snapshot
}



export function createDetachVisualContext<TContext extends object>(args: {
  createContext: () => TContext
  source: HTMLElement
  sourceRect: DOMRect
  visualSnapshot: VisualSnapshot
  targetSnapshot: VisualSnapshot
}): TContext & {
  sourceElement: HTMLElement
  sourceRect: DOMRect
  visualSnapshot: VisualSnapshot
  targetSnapshot: VisualSnapshot
} {
  return {
    ...args.createContext(),
    sourceElement: args.source,
    sourceRect: args.sourceRect,
    visualSnapshot: args.visualSnapshot,
    targetSnapshot: args.targetSnapshot,
  }
}



export function startDetachLandingVisual(args: {
  createProxy: () => { element: HTMLElement } | null
  enableProxy: (element: HTMLElement) => void
  bindRegrab: (element: HTMLElement) => void
  land: (element: HTMLElement) => Promise<LandingResult>
  onMissing: () => void
  onComplete: (result: LandingResult) => void
}): HTMLElement | null {
  const proxy = args.createProxy()
  if (!proxy) {
    args.onMissing()
    return null
  }
  args.enableProxy(proxy.element)
  args.bindRegrab(proxy.element)
  void args.land(proxy.element).then(args.onComplete)
  return proxy.element
}



export function completeDetachLanding(args: {
  active: boolean
  result: LandingResult
  complete: (result: LandingResult) => void
  reveal: () => void
}): void {
  if (!args.active) return
  args.complete({
    completed: args.result.completed,
    reason: args.result.reason ?? '',
    reveal: args.reveal,
  })
}



export function resolveDetachRegrabTarget(
  resolve: () => HTMLElement | null,
  fallback: () => HTMLElement | null,
): HTMLElement | null {
  return resolve() ?? fallback()
}



export function createDetachLandingLifecycle<TGate extends { promise: Promise<LandingResult> }>(args: {
  createGate: () => TGate
  onGate: (gate: TGate) => void
  clearDragging: () => void
  scheduleLanding: () => void
  clearRegrab: () => void
  finishReveal: () => void
}) {
  return {
    landing: () => {
      const gate = args.createGate()
      args.onGate(gate)
      args.clearDragging()
      args.scheduleLanding()
      return gate.promise
    },
    reveal: () => {
      args.clearRegrab()
      args.finishReveal()
    },
  }
}



/**
 * Runtime 的 detach 编排原语。
 */
export function createDetachMoveDriver(
  onMove: (event: PointerEvent) => void,
  onRelease: () => { columnId: string; index: number } | null,
): MoveBehaviorDriver {
  return {
    update: (_context, input) => {
      if (input.event instanceof PointerEvent) onMove(input.event)
    },
    resolveDestination: () => {
      const drop = onRelease()
      return drop ? { accepted: true, destination: drop } : { accepted: false }
    },
    commit: () => undefined,
  }
}



export function createDetachLayoutLifecycle(sourceEl: HTMLElement) {
  return {
    capture: () => captureLayoutFlip(
      Array.from(document.querySelectorAll<HTMLElement>('[data-card]'))
        .filter(el => el !== sourceEl && el.dataset.runtimeProxy !== 'true'),
    ),
    play: (_context: unknown, snapshot: unknown) => {
      scheduleLayoutFlip(snapshot as ReturnType<typeof captureLayoutFlip>)
    },
  }
}



// ---- executeDetachDrag：完整编排入口 ----

export interface DetachDragOptions {
  runtime: Runtime
  objectId: string
  element: HTMLElement
  event: PointerEvent
  fromRect?: DOMRect
  surfaceIds: string[]
  findColumnIdOf: (objectId: string) => string | undefined
}

/**
 * 执行一次完整的 detach 拖拽。
 *
 * 内部完成 pickup → 跟手 → 落点判定 → release → landing → reveal → regrab 的
 * 全流程编排，包括 Session 创建和 Runtime.orchestrateMoveSession 调用。
 * 调用方（VisualAdapter.legacyStart）只需传入上下文即可。
 */
export function executeDetachDrag(options: DetachDragOptions): void {
  const { runtime, objectId, element, event, fromRect, surfaceIds, findColumnIdOf } = options

  if (!runtime.objects.hasAbility(objectId, 'move')) return
  event.preventDefault()

  const activeRegrab = runtime.getRegrab(objectId)
  if (activeRegrab) {
    activeRegrab(event)
    return
  }

  const { beforeContent, beforePickup } = prepareDetachPickup(element)
  scheduleLayoutFlip(beforePickup)
  runtime.objects.setElement(objectId, element)
  const { session, objectLease } = startDetachSession(
    () => runtime.start(createDetachMoveRequest(objectId, event)),
    id => runtime.getSession(id),
    id => prepareDetachSession(
      (sessionId, oid) => runtime.acquireObject(sessionId, oid),
      (sessionId, sids) => runtime.takeSurfaces(sessionId, sids),
      id,
      objectId,
      surfaceIds,
    ),
  )

  const moveContext = runtime.getMoveContext(session.id)
  const motion = prepareDetachMotion(moveContext, element, event, fromRect)
  const rect = motion.rect
  const startX = event.clientX
  const startY = event.clientY
  const offsetX = motion.offsetX
  const offsetY = motion.offsetY
  applyDetachPickupVisual(
    (id, el, state) => runtime.applyVisualState(id, el, state),
    objectId,
    element,
    rect,
    fromRect,
  )

  const draggingSnapshot = captureDetachDraggingSnapshot(
    (id, el) => runtime.captureVisualState(id, el), objectId, element,
  )
  element.dataset.runtimeActive = 'true'
  moveFloating(element, startX, startY, offsetX, offsetY)

  const kanbanHitResolver = createDomHitResolver({ surfaceSelector: '[data-column]', targetSelector: '[data-card]' })
  const dropState = createDetachDropState(
    findColumnIdOf(objectId),
    ev => hitWithResolver(runtime.getHitResolver() ?? kanbanHitResolver, ev.clientX, ev.clientY, objectId),
    (drop: { columnId: string; index: number }, previous) =>
      drop.columnId === previous?.columnId && drop.index === previous?.index,
  )

  let pendingDrop: { columnId: string; index: number } | null = null
  let landingPlan: (() => void) | null = null
  let landingGate: RuntimeCompletionGate<LandingResult> | null = null
  let landingProxy: HTMLElement | null = null
  let released = false

  function onMove(moveEvent: PointerEvent) {
    if (session.state !== 'active') return
    const hit = updateDetachDrop({
      active: session.state === 'active',
      event: moveEvent,
      state: dropState,
      resolve: ev => hitWithResolver(
        runtime.getHitResolver() ?? kanbanHitResolver,
        ev.clientX,
        ev.clientY,
        objectId,
      ),
      getSurface: (drop: { columnId: string }) => drop.columnId,
    })
    if (!hit) return
    pendingDrop = hit
  }

  function onUp(): { columnId: string; index: number } | null {
    if (released) return null
    released = true
    if (session.state !== 'active' && session.state !== 'release') return null
    pendingDrop = dropState.release()
    if (!pendingDrop) {
      cancelDetachWithoutDrop({
        source: element,
        cancel: () => runtime.cancel(session.id, 'no-valid-drop'),
        clearFloating: clearFloatingStyle,
        clearActive: () => delete element.dataset.runtimeActive,
        releaseObject: () => objectLease?.release(),
      })
      return null
    }
    const beforeRect = prepareDetachLanding({
      source: element,
      settle: settleFloatingLayout,
      clearActive: () => delete element.dataset.runtimeActive,
      releaseObject: () => objectLease?.release(),
    })
    landingPlan = scheduleDetachLandingFrame(() => clearFloatingStyle(element), () => {
      const landedEl = resolveDetachLandingTarget({
        resolve: () => runtime.resolveMoveTarget(
          session.id,
          pendingDrop,
          () => document.querySelector<HTMLElement>(`[data-card="${objectId}"]`) ?? element,
        ),
        applyState: target => runtime.applyVisualState(objectId, target, {
          phase: 'revealing',
          hovered: false,
          selected: target.classList.contains('is-selected'),
          grabbed: false,
        }),
      })
      if (!landedEl) {
        landingGate?.complete({ completed: true, reason: '' })
        landingGate = null
        return
      }
      console.log('[executeDetachDrag] landedEl', { className: landedEl.className, rect: landedEl.getBoundingClientRect() })
      const targetSnapshot = captureDetachTargetSnapshot(
        el => runtime.captureVisualState(objectId, el), landedEl,
      )
      console.log('[executeDetachDrag] landing visual', { targetRect: landedEl.getBoundingClientRect() })
      const visualContext = createDetachVisualContext({
        createContext: () => runtime.createVisualLifecycleContext(session.id, pendingDrop, landedEl, beforeContent),
        source: element,
        sourceRect: beforeRect,
        visualSnapshot: draggingSnapshot,
        targetSnapshot,
      })
      landingProxy = startDetachLandingVisual({
        createProxy: () => runtime.createVisualProxy(session.id, visualContext) ?? null,
        enableProxy: proxy => setProxyInteractive(proxy, true),
        bindRegrab: proxy => runtime.bindRegrabTarget(session.id, objectId, proxy, onRegrab),
        land: () => runtime.landVisualProxy(session.id, landedEl, visualContext),
        onMissing: () => {
          landingGate?.complete({ completed: false, reason: 'visual-proxy-missing' })
          landingGate = null
        },
        onComplete: landingResult => {
          completeDetachLanding({
            active: session.state === 'landing',
            result: landingResult,
            complete: result => landingGate?.complete(result),
            reveal: () => { void runtime.revealVisualProxy(session.id, landedEl, visualContext) },
          })
          landingGate = null
        },
      })
    })
    return pendingDrop
  }

  function onRegrab(regrabEvent: PointerEvent) {
    if (session.state !== 'landing') return
    const proxy = landingProxy
    if (!proxy) return

    const liveEl = resolveDetachRegrabTarget(
      () => runtime.resolveVisualTarget(session.id, pendingDrop),
      () => document.querySelector<HTMLElement>(`[data-card="${objectId}"]`),
    )
    if (!liveEl) return
    const regrabContext = runtime.createRegrabContext(session.id, regrabEvent, proxy, liveEl)
    if (!regrabContext) return
    const proxyRect = regrabContext.proxyRect

    interruptDetachRegrab({
      event: regrabContext.event,
      sessionId: session.id,
      proxy,
      source: liveEl,
      interrupt: () => regrabContext.interrupt('regrab'),
      clearRegrab: () => runtime.clearRegrab(objectId),
      disposeProxy: () => runtime.disposeVisualProxy(session.id),
    })
    executeDetachDrag({
      runtime, objectId, element: liveEl, event: regrabEvent,
      fromRect: proxyRect, surfaceIds, findColumnIdOf,
    })
  }

  const lifecycle = {
    layout: createDetachLayoutLifecycle(element),
    ...createDetachLandingLifecycle({
      createGate: () => runtime.createCompletionGate(session.id, { completed: false, reason: 'landing-cancelled' }),
      onGate: gate => { landingGate = gate },
      clearDragging: () => document.body.classList.remove('kb-dragging'),
      scheduleLanding: () => { landingPlan?.(); landingPlan = null },
      clearRegrab: () => runtime.clearRegrab(objectId),
      finishReveal: () => { if (landingProxy) setProxyInteractive(landingProxy, false) },
    }),
  }

  runtime.orchestrateMoveSession(
    createDetachMoveRequest(objectId, event),
    {
      sessionId: session.id,
      followElement: element,
      driver: createDetachMoveDriver(onMove, onUp),
      lifecycle,
    },
  )
}
