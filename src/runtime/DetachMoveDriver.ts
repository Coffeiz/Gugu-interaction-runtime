import { captureLayoutFlip, scheduleLayoutFlip } from '../dom/GroupLayout'
import type { LandingResult, MoveBehaviorDriver, MoveContext } from '../behavior/MoveBehavior'
import type { VisualSnapshot, VisualState } from '../dom/VisualAdapterTypes'
import { applyFloatingStyle } from '../dom/Visual'
import { releaseVisibilityOwnership, setProxyInteractive } from '../dom/Visual'

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

/**
 * Runtime 的 detach 编排原语。
 *
 * 视觉代理仍由业务 VisualAdapter 提供；这里仅负责把 pointer 更新、落点
 * 解析和布局 FLIP 接到 MoveBehavior，避免业务入口重复维护这段顺序。
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

export function createDetachVisualLifecycle(
  clearRegrab: () => void,
  beginLanding: () => Promise<LandingResult>,
  finishReveal: () => void,
) {
  return {
    landing: () => beginLanding(),
    reveal: () => {
      clearRegrab()
      finishReveal()
    },
  }
}
