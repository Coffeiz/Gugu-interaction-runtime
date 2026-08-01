import { captureLayoutFlip, scheduleLayoutFlip, scheduleLayoutFlipOnRaf } from '../dom/GroupLayout'
import type { LandingResult, MoveContext } from '../behavior/MoveBehavior'
import type { VisualSnapshot, VisualState } from '../dom/VisualAdapterTypes'
import { applyFloatingStyle } from '../dom/Visual'
import { releaseVisibilityOwnership, setProxyInteractive } from '../dom/Visual'



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



export function prepareDetachPickup(
  sourceElement: HTMLElement,
  registeredElements: () => HTMLElement[],
): DetachPickupPreparation {
  const beforeContent = sourceElement.cloneNode(true) as HTMLElement
  const cards = registeredElements()
    .filter(element => element !== sourceElement && element.dataset.runtimeProxy !== 'true')
  return { beforeContent, beforePickup: captureLayoutFlip(cards) }
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
      if (!drop) {
        pending = null
        return null
      }
      if (same(drop, pending)) return pending
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
  // Runtime interrupt 的 cancel 清理会恢复 source 的原始 style；在新
  // session 接管前重新隐藏它，避免列表本体与新 grabbing 视觉短暂重叠。
  args.source.style.visibility = 'hidden'
  args.disposeProxy()
  // source 的可见性由新 session 的 pickup 阶段恢复，避免旧 proxy 销毁
  // 与新 session 接管之间露出一帧列表态本体。
}



export function cancelDetachWithoutDrop(args: {
  source: HTMLElement
  registeredElements: () => HTMLElement[]
  cancel: () => void
  releaseObject: () => void
  clearFloating: (element: HTMLElement) => void
  clearActive: () => void
}): void {
  document.body.classList.remove('kb-dragging')
  const returnCards = args.registeredElements()
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
  motionState?: { x: number; y: number; vx: number; vy: number; scaleX: number; scaleY: number; rotateX: number; rotateZ: number }
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
    motionState: args.motionState,
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
    reveal: args.result.completed ? args.reveal : undefined,
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



export function createDetachLayoutLifecycle(
  sourceEl: HTMLElement,
  registeredElements: () => HTMLElement[],
) {
  let layoutToken = 0
  return {
    capture: () => {
      layoutToken += 1
      return captureLayoutFlip(
        registeredElements()
          .filter(el => el !== sourceEl && el.dataset.runtimeProxy !== 'true'),
      )
    },
    play: (_context: unknown, snapshot: unknown, useRaf = false) => {
      const token = ++layoutToken
      if (useRaf) {
        // 列尾追加：等下一帧、Vue patch 落地后再量布局执行 Invert。
        // 目标列已有卡片无位移（没有 transform Invert），rAF 不会闪现；
        // 且 rAF 必然晚于 emit 的 Vue patch 微任务，resize 冻结与播放
        // 同帧起步，不顶动。
        requestAnimationFrame(() => {
          if (token !== layoutToken) return
          scheduleLayoutFlipOnRaf(snapshot as ReturnType<typeof captureLayoutFlip>)
        })
        return
      }
      // 中间插入/重排：有卡片位移 FLIP（有 Invert），必须 microtask 让
      // Invert 在 paint 前写入，不闪现；playLayout 在 emit 后调用，此时
      // Vue patch 已完成，microtask 量到的也是最终布局，不顶动。
      scheduleLayoutFlip(snapshot as ReturnType<typeof captureLayoutFlip>)
    },
  }
}
