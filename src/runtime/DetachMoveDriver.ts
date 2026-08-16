import { captureLayoutFlip, scheduleLayoutFlip, scheduleLayoutFlipOnRaf } from '../dom/GroupLayout'
import type { LandingResult, MoveContext } from '../behavior/MoveBehavior'
import type { VisualSnapshot, VisualState } from '../dom/VisualAdapterTypes'
import { applyFloatingStyle } from '../dom/Visual'
import { releaseVisibilityOwnership, setProxyInteractive } from '../dom/Visual'
import type { GrabAlignConfig } from '../Runtime'
import type { LayoutTransactionCoordinator } from '../dom/LayoutTransaction'



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



/**
 * 抓取点默认取卡片几何中心，不管实际点在卡片哪个位置——对应咕咕旧版
 * （main 分支 usePhysicsDrag.ts）的 centerGrab:true：卡片水平/垂直中心
 * 始终跟指针对齐，不是"点哪抓哪"。按 grabAlign.align 也可以切回
 * 'pointer'（保留点击位置在卡片里的相对偏移），再叠加 offsetX/offsetY
 * 做额外的固定偏移（比如往下偏几 px，做出"被拎着"的悬垂感）。
 * regrab（fromRect 有值）时用当时飞行中代理的 rect 重新量一次，保持
 * 抓取点在卡片里的相对位置不因为落地途中尺寸变化（缩放）而跑偏。
 */
export function prepareDetachMotion(
  context: MoveContext,
  element: HTMLElement,
  event: PointerEvent,
  fromRect?: DOMRect,
  grabAlign?: GrabAlignConfig,
): { rect: DOMRect; offsetX: number; offsetY: number } {
  const rect = fromRect ?? element.getBoundingClientRect()
  const align = grabAlign?.align ?? 'center'
  const baseX = align === 'pointer' ? event.clientX - rect.left : rect.width / 2
  const baseY = align === 'pointer' ? event.clientY - rect.top : rect.height / 2
  // offsetX/offsetY 返回的是"指针到卡片左上角"的距离（target.x = pointerX -
  // offsetX 就是左上角落点），这个距离跟卡片实际往哪边挪是反着的：距离变大，
  // 左上角（连带整张卡片）反而往指针的反方向移。grabAlign.offsetY 想要的是
  // "卡片往下挪"（正值往下），所以这里要用减法，不能直接加。
  const offsetX = baseX - (grabAlign?.offsetX ?? 0)
  const offsetY = baseY - (grabAlign?.offsetY ?? 0)
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



/**
 * 正被拖拽/落地的源节点整段生命周期都不该参与 collection 入场/离场判断，
 * 这段判断跟"抓在手里"还是"正在落地"无关，只要还没交接完就一直排除；
 * `.contains` 覆盖 presence 包裹层是源节点祖先的情况（比如 Teleport 传送
 * 前后，包裹层和源节点还是同一棵子树）。
 */
function ignoreDetachSource(sourceElement: HTMLElement): (element: HTMLElement) => boolean {
  return element => element === sourceElement || element.contains(sourceElement)
}

export function prepareDetachPickup(
  sourceElement: HTMLElement,
  registeredElements: () => HTMLElement[],
  scopeSurfaces?: () => readonly HTMLElement[],
  surfaceMeasures?: () => ReadonlyMap<HTMLElement, (() => { width?: number; height: number } | null)>,
): DetachPickupPreparation {
  const beforeContent = sourceElement.cloneNode(true) as HTMLElement
  const cards = registeredElements()
    .filter(element => element !== sourceElement && element.dataset.runtimeProxy !== 'true')
  return {
    beforeContent,
    beforePickup: captureLayoutFlip(cards, document, true, ignoreDetachSource(sourceElement), {
      scopeSurfaces: scopeSurfaces?.(),
      surfaceMeasures: surfaceMeasures?.(),
    }),
  }
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
}): void {
  args.event.stopPropagation()
  setProxyInteractive(args.proxy, false)
  args.clearRegrab()
  releaseVisibilityOwnership(args.source, args.sessionId)
  args.interrupt()
  // Runtime interrupt 的 cancel 清理会恢复 source 的原始 style；在新
  // session 接管前重新隐藏它，避免列表本体与新 grabbing 视觉短暂重叠。
  args.source.style.visibility = 'hidden'
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
  const returnBefore = captureLayoutFlip(returnCards, document, true, ignoreDetachSource(args.source))
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
  options: { ignoreTemporaryOpacity?: boolean } = {},
): VisualSnapshot {
  const rect = element.getBoundingClientRect()
  const opacity = element.style.opacity
  const computedOpacity = getComputedStyle(element).opacity
  // pointerup 发生在目标卡片上时，真实节点即使被设为 pointer-events:none
  // 仍可能在当前指针帧保持 :hover。直接读取它会把 hover 阴影/位移带进
  // landing 快照。克隆到同一父节点、移出视口后读取，既保留继承的主题变量，
  // 又确保快照节点不会命中 :hover；真实目标的 rect 仍以原节点为准。
  const snapshotNode = element.cloneNode(true) as HTMLElement
  snapshotNode.dataset.runtimeLandingSnapshot = 'true'
  snapshotNode.style.position = 'fixed'
  snapshotNode.style.left = '-100000px'
  snapshotNode.style.top = '-100000px'
  snapshotNode.style.width = `${rect.width}px`
  snapshotNode.style.height = `${rect.height}px`
  snapshotNode.style.visibility = 'visible'
  snapshotNode.style.pointerEvents = 'none'
  snapshotNode.style.transition = 'none'
  // 跨 Surface 交接时，业务侧可能暂时把目标设为 opacity:0；这个状态
  // 不属于目标静态视觉，快照应按可见本体读取。
  if (options.ignoreTemporaryOpacity && (opacity === '0' || computedOpacity === '0')) {
    snapshotNode.style.opacity = '1'
  }
  const parent = element.parentElement ?? element.ownerDocument.body
  parent.appendChild(snapshotNode)
  try {
    void snapshotNode.offsetWidth
    const snapshot = capture(snapshotNode)
    // CSS animation 或祖先交接状态可能继续让 computedStyle 返回 0，
    // 即使上面的临时 inline 覆盖已经生效。这里仍要把这个明确的
    // 交接态从目标静态快照中剔除，否则代理会按 opacity:0 淡出。
    return options.ignoreTemporaryOpacity
      && (opacity === '0' || computedOpacity === '0' || snapshot.opacity === '0')
      ? { ...snapshot, rect, opacity: '1' }
      : { ...snapshot, rect }
  } finally {
    snapshotNode.remove()
  }
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
  // 视觉适配器的异常也必须走统一失败交接；否则 landing Promise 会悬空，
  // session 既不会 reveal，也不会进入 Runtime 的代理清理边界。
  void args.land(proxy.element)
    .then(args.onComplete)
    .catch(() => args.onComplete({ completed: false, reason: 'landing-error' }))
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
  const usable = (element: HTMLElement | null): HTMLElement | null => {
    if (!element?.isConnected) return null
    const rect = element.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0 ? element : null
  }
  return usable(resolve()) ?? usable(fallback())
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
  scopeSurfaces?: () => readonly HTMLElement[],
  surfaceMeasures?: () => ReadonlyMap<HTMLElement, (() => { width?: number; height: number } | null)>,
  layoutTransaction?: LayoutTransactionCoordinator,
) {
  let layoutToken = 0
  let transactionRoot: ParentNode | null = null
  let transactionParticipantId: string | undefined
  return {
    capture: () => {
      layoutToken += 1
      transactionRoot = sourceEl.ownerDocument
      const transaction = layoutTransaction?.begin(transactionRoot, 'move')
      transactionParticipantId = transaction?.participantId
      if (transaction) layoutTransaction?.request(transactionRoot, { type: 'move-layout', source: sourceEl })
      return captureLayoutFlip(
        registeredElements()
          .filter(el => el !== sourceEl && el.dataset.runtimeProxy !== 'true'),
        document,
        true,
        ignoreDetachSource(sourceEl),
        { scopeSurfaces: scopeSurfaces?.(), surfaceMeasures: surfaceMeasures?.() },
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
          const play = (plan?: { isCurrent: () => boolean }) => {
            if (plan && !plan.isCurrent()) return
            scheduleLayoutFlipOnRaf(snapshot as ReturnType<typeof captureLayoutFlip>)
          }
          const deferred = transactionRoot && transactionParticipantId
            ? layoutTransaction?.defer(transactionRoot, transactionParticipantId, plan => play(plan), 'move-flip')
            : null
          if (!deferred) play()
          if (transactionRoot) layoutTransaction?.commit(transactionRoot, transactionParticipantId)
          transactionParticipantId = undefined
        })
        return
      }
      // 中间插入/重排：有卡片位移 FLIP（有 Invert），必须 microtask 让
      // Invert 在 paint 前写入，不闪现；playLayout 在 emit 后调用，此时
      // Vue patch 已完成，microtask 量到的也是最终布局，不顶动。
      const play = (plan?: { isCurrent: () => boolean }) => {
        if (plan && !plan.isCurrent()) return
        scheduleLayoutFlip(snapshot as ReturnType<typeof captureLayoutFlip>)
      }
      const deferred = transactionRoot && transactionParticipantId
        ? layoutTransaction?.defer(transactionRoot, transactionParticipantId, plan => play(plan), 'move-flip')
        : null
      if (!deferred) play()
      if (transactionRoot) layoutTransaction?.commit(transactionRoot, transactionParticipantId)
      transactionParticipantId = undefined
    },
    cancel: () => {
      if (transactionRoot) layoutTransaction?.cancel(transactionRoot, transactionParticipantId)
      transactionRoot = null
      transactionParticipantId = undefined
    },
  }
}
