import { createDomHitResolver, hitWithResolver } from '../../dom/Hit'
import { createAutoScroller, type AutoScrollController } from '../../dom/AutoScroll'
import { captureLayoutFlip, scheduleLayoutFlip } from '../../dom/GroupLayout'
import { clearFloatingStyle, createDragProxy, destroyDragProxy, settleFloatingLayout, setProxyInteractive } from '../../dom/Visual'
import { preserveProxyVisualContext } from '../../dom/ProxyVisualContext'
import { createCardMotionController, type CardMotionController } from '../../motion/CardMotionController'
import { FOLLOW_PROFILE, FOLLOW_ROTATION } from '../../motion/MotionProfile'
import { shapeReleaseVelocity } from '../../motion/ReleaseMotion'
import { captureDetachDraggingSnapshot, prepareDetachMotion, applyDetachPickupVisual, prepareDetachPickup, createDetachDropState, updateDetachDrop, prepareDetachLanding, resolveDetachLandingTarget, captureDetachTargetSnapshot, createDetachVisualContext, startDetachLandingVisual, completeDetachLanding, cancelDetachWithoutDrop, resolveDetachRegrabTarget, interruptDetachRegrab, scheduleDetachLandingFrame, createDetachLayoutLifecycle, createDetachLandingLifecycle } from '../DetachMoveDriver'
import type { Runtime, RuntimeCompletionGate } from '../../Runtime'
import type { LandingResult, MoveBehaviorDriver, MoveVisualLifecycle } from '../../behavior/MoveBehavior'

/** 把 target 滚动进 column 的可视范围内（贴边对齐，不居中）。 */
function keepElementWithinColumn(column: HTMLElement, target: HTMLElement): void {
  const columnRect = column.getBoundingClientRect()
  const elRect = target.getBoundingClientRect()
  if (elRect.top < columnRect.top) {
    const correction = -(columnRect.top - elRect.top)
    column.scrollTo({ top: column.scrollTop + correction, behavior: 'smooth' })
  } else if (elRect.bottom > columnRect.bottom) {
    const correction = elRect.bottom - columnRect.bottom
    column.scrollTo({ top: column.scrollTop + correction, behavior: 'smooth' })
  }
}

export function createDetachMoveFromAdapter(config: {
  runtime: Runtime
  objectId: string
  element: HTMLElement
  event: PointerEvent
  fromRect?: DOMRect
  returnRect?: DOMRect
}): { driver: MoveBehaviorDriver; lifecycle: MoveVisualLifecycle } {
  const { runtime, objectId, element, event, fromRect, returnRect } = config
  // surfaceIds 和 findColumnIdOf 从 Runtime 注册表获取，不需要用户传
  const objectItem = runtime.objects.get(objectId)
  const allSurfaces = runtime.surfaces.snapshot()
  const surfaceIds = allSurfaces.map(s => s.id)
  const findColumnIdOf = (oid: string) => runtime.objects.get(oid)?.surfaceId
  const initialSurfaceId = objectItem?.surfaceId ?? allSurfaces[0]?.id
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
  let objectLease: { release: () => void } | null = null
  let autoScroller: AutoScrollController | null = null
  let dragMotion: CardMotionController | null = null
  let releaseMotionState: { x: number; y: number; vx: number; vy: number; scaleX: number; scaleY: number } | undefined
  let dragOffset = { x: 0, y: 0 }
  let pickupRect: { left: number; top: number; width: number; height: number } | null = null
  let pickupIndex: number | null = null
  let cancelProxySequence = 0
  let pointerMoved = false

  function getSessionState() { return sessionId ? runtime.getSession(sessionId)?.state : undefined }

  function updateDropFromPoint(x: number, y: number): void {
    if (getSessionState() !== 'active') return
    if (!dropState) return
    const hit = updateDetachDrop({
      active: getSessionState() === 'active',
      event: { clientX: x, clientY: y } as PointerEvent,
      state: dropState,
      resolve: (ev: PointerEvent) => hitWithResolver(runtime.getHitResolver() ?? kanbanHitResolver, ev.clientX, ev.clientY, objectId),
      getSurface: (drop: { columnId: string }) => drop.columnId,
    })
    if (!hit) return
    pendingDrop = hit
  }

  function onMove(moveEvent: PointerEvent) {
    pointerMoved = true
    dragMotion?.setTarget({
      x: moveEvent.clientX - dragOffset.x,
      y: moveEvent.clientY - dragOffset.y,
    })
    updateDropFromPoint(moveEvent.clientX, moveEvent.clientY)
    autoScroller?.update(
      (runtime.getHitResolver() ?? kanbanHitResolver).findSurface({ x: moveEvent.clientX, y: moveEvent.clientY }),
      { x: moveEvent.clientX, y: moveEvent.clientY },
    )
  }

  function onUp() {
    if (released) return { accepted: false as const }
    released = true
    releaseMotionState = dragMotion ? { ...dragMotion.getState() } : undefined
    if (releaseMotionState) {
      const releaseVelocity = shapeReleaseVelocity({ x: releaseMotionState.vx, y: releaseMotionState.vy })
      releaseMotionState.vx = releaseVelocity.x
      releaseMotionState.vy = releaseVelocity.y
    }
    dragMotion?.stop()
    dragMotion = null
    autoScroller?.stop()
    if (!dropState || !sessionId) return { accepted: false as const }
    pendingDrop = dropState.release()
    // 原地按下后立即松手没有 pointermove，命中器会排除 source 自身，
    // 因而 pendingDrop 为空；这应视为回到原位置并走完整 landing 生命周期，
    // 而不是走没有 regrab 的 invalid-return 快路径。
    if (!pendingDrop && !pointerMoved && releaseMotionState && Math.hypot(releaseMotionState.vx, releaseMotionState.vy) < 0.5) {
      const sourceColumn = element.closest<HTMLElement>('[data-column]')
        ?? (initialSurfaceId
          ? document.querySelector<HTMLElement>(`[data-column="${CSS.escape(initialSurfaceId.replace(/^column:/, ''))}"]`)
          : null)
      const columnId = sourceColumn?.dataset.column
      if (sourceColumn && columnId) {
        const cards = Array.from(sourceColumn.querySelectorAll<HTMLElement>('[data-card]'))
          .filter(card => card !== element && card.dataset.runtimeProxy !== 'true')
        pendingDrop = { columnId, index: pickupIndex ?? cards.length }
      }
    }
    if (!pendingDrop) {
      const sourceVisibility = element.style.visibility
      const returnProxy = createDragProxy(element, element.getBoundingClientRect())
      const cancelToken = ++cancelProxySequence
      returnProxy.dataset.runtimeCancelProxy = 'true'
      preserveProxyVisualContext(element, returnProxy)
      // getBoundingClientRect 包含 grabbing 的 scale；createDragProxy 再把该
      // 尺寸与 scale 叠加会放大一遍。回飞代理使用未变换的 border-box 尺寸，
      // 与本体及普通 landing 的尺寸基准保持一致。
      const sourceStyle = getComputedStyle(element)
      returnProxy.style.width = sourceStyle.width
      returnProxy.style.height = sourceStyle.height
      returnProxy.style.transition = 'none'
      // createDragProxy 已经挂到 runtime overlay；不要再 reparent 到 body，
      // 否则会绕过统一的裁剪/层级/样式上下文。
      element.style.visibility = 'hidden'
      const destination = pickupRect
      requestAnimationFrame(() => {
        if (!destination) return
        returnProxy.style.transition = 'left 250ms cubic-bezier(.22,1,.36,1), top 250ms cubic-bezier(.22,1,.36,1), transform 250ms cubic-bezier(.22,1,.36,1), box-shadow 250ms cubic-bezier(.22,1,.36,1)'
        returnProxy.style.left = `${destination.left}px`
        returnProxy.style.top = `${destination.top}px`
        returnProxy.style.transform = 'scale(1)'
        returnProxy.style.boxShadow = getComputedStyle(element).boxShadow
      })
      window.setTimeout(() => {
        if (cancelProxySequence !== cancelToken) return
        destroyDragProxy(returnProxy)
        element.style.visibility = sourceVisibility
      }, 290)
      cancelDetachWithoutDrop({
        source: element,
        cancel: () => runtime.cancel(sessionId!, 'no-valid-drop'),
        clearFloating: clearFloatingStyle,
        clearActive: () => delete element.dataset.runtimeActive,
        releaseObject: () => objectLease?.release(),
      })
      // cancel 内部会 clearFloatingStyle 恢复 source 原始样式；回飞 proxy
      // 尚未结束前必须再次隐藏 source，避免 invalid drop 出现双卡。
      element.style.visibility = 'hidden'
      return { accepted: false as const }
    }
    const beforeRect = prepareDetachLanding({
      source: element,
      settle: settleFloatingLayout,
      clearActive: () => delete element.dataset.runtimeActive,
      releaseObject: () => objectLease?.release(),
    })
    // 释放控制权后，Vue nextTick 会把元素从 Teleport 移回列容器
    // resolveDetachLandingTarget 在下一帧（scheduleDetachLandingFrame 的 rAF）执行时，
    // 元素已在列容器中，getBoundingClientRect 返回正确位置
    landingPlan = scheduleDetachLandingFrame(() => clearFloatingStyle(element), () => {
      const sid = sessionId!
      const landedEl = resolveDetachLandingTarget({
        resolve: () => runtime.resolveMoveTarget(sid, pendingDrop, () => {
          return document.querySelector<HTMLElement>(`[data-card="${objectId}"]`) ?? null
        }),
        applyState: (target: HTMLElement) => runtime.applyVisualState(objectId, target, { phase: 'revealing', hovered: false, selected: target.classList.contains('is-selected'), grabbed: false }),
      })
      if (!landedEl) { landingGate?.complete({ completed: true, reason: '' }); landingGate = null; return }
      const scrollColumn = landedEl.closest<HTMLElement>('[data-column]')
      if (scrollColumn) {
        keepElementWithinColumn(scrollColumn, landedEl)
      }
      const targetSnapshot = captureDetachTargetSnapshot((el: HTMLElement) => runtime.captureVisualState(objectId, el), landedEl)
      const visualContext = createDetachVisualContext({
        createContext: () => runtime.createVisualLifecycleContext(sid, pendingDrop, landedEl, beforeContent!),
        source: element, sourceRect: beforeRect, visualSnapshot: draggingSnapshot!, targetSnapshot,
        motionState: releaseMotionState,
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
    const targetRect = liveEl.getBoundingClientRect()
    runtime.startObjectPointer(objectId, liveEl, regrabEvent, regrabContext.proxyRect, targetRect)
  }

  const driver: MoveBehaviorDriver = {
    prepare(ctx) {
      sessionId = ctx.session.id
      pointerMoved = false
      document.querySelectorAll<HTMLElement>('[data-runtime-cancel-proxy="true"]').forEach(destroyDragProxy)
      cancelProxySequence += 1
      autoScroller = createAutoScroller(ctx.session.cleanup, {
        onScroll: point => updateDropFromPoint(point.x, point.y),
      })
      if (ctx.session.state !== 'prepare') return
      runtime.objects.setElement(objectId, element)
      // 取消回飞可能在下一次抓取前仍处于收尾阶段；新 session 接管时必须
      // 先让 source 重新可见，避免新旧视觉对象同时隐藏或叠加。
      element.style.visibility = ''
      objectLease = runtime.acquireObject(sessionId!, objectId)
      runtime.takeSurfaces(sessionId!, surfaceIds)
      const { beforePickup } = prepareDetachPickup(element)
      const sourceColumnForIndex = element.closest<HTMLElement>('[data-column]')
      if (sourceColumnForIndex) {
        const sourceCards = Array.from(sourceColumnForIndex.querySelectorAll<HTMLElement>('[data-card]'))
          .filter(card => card.dataset.runtimeProxy !== 'true')
        pickupIndex = sourceCards.findIndex(card => card === element)
      }
      beforeContent = element.cloneNode(true) as HTMLElement
      scheduleLayoutFlip(beforePickup)
      const moveContext = runtime.getMoveContext(sessionId!)
      const motion = prepareDetachMotion(moveContext, element, event, fromRect)
      const rect = motion.rect
      dragOffset = { x: motion.offsetX, y: motion.offsetY }
      applyDetachPickupVisual((_id: string, el: HTMLElement, state: any) => runtime.applyVisualState(objectId, el, state), objectId, element, rect, fromRect)
      // grabbing 期间 transform 由 MotionController 每帧写入，不能再让 CSS transition
      // 对每次物理更新做线性插值，否则角度回正会覆盖弹簧的非线性轨迹。
      element.style.transition = 'none'
      draggingSnapshot = captureDetachDraggingSnapshot((_id: string, el: HTMLElement) => runtime.captureVisualState(objectId, el), objectId, element)
      element.dataset.runtimeActive = 'true'
      dragMotion = createCardMotionController({
        mode: 'follow',
        followRotation: FOLLOW_ROTATION,
        onFrame: frame => {
          element.style.left = `${frame.x}px`
          element.style.top = `${frame.y}px`
          element.style.transform = `perspective(760px) rotateX(${frame.rotateX.toFixed(2)}deg) rotateZ(${frame.rotateZ.toFixed(2)}deg) scale(${frame.scaleX.toFixed(4)}, ${frame.scaleY.toFixed(4)})`
        },
      })
      dragMotion.setProfile(FOLLOW_PROFILE)
      const originRect = returnRect ?? rect
      pickupRect = { left: originRect.left, top: originRect.top, width: originRect.width, height: originRect.height }
      dragMotion.seed({ x: rect.left, y: rect.top, scaleX: 1.03, scaleY: 1.03, rotateX: 5, rotateZ: 0 })
      dragMotion.setTarget({ x: event.clientX - dragOffset.x, y: event.clientY - dragOffset.y })
      dragMotion.start()
      dropState = createDetachDropState(
        findColumnIdOf(objectId),
        (ev: PointerEvent) => hitWithResolver(runtime.getHitResolver() ?? kanbanHitResolver, ev.clientX, ev.clientY, objectId),
        (drop: { columnId: string; index: number }, previous: { columnId: string; index: number } | null) => drop.columnId === previous?.columnId && drop.index === previous?.index,
      )
      // regrab 后可能没有新的 pointermove 就立即松手；先用 pointerdown 坐标
      // 初始化当前落点，避免 pendingDrop 为空而被误判为无效取消。
      updateDropFromPoint(event.clientX, event.clientY)
    },
    update(_ctx: any, input: any) { if (input.event instanceof PointerEvent) onMove(input.event) },
    resolveDestination() { return onUp() },
    commit: () => {
      settleFloatingLayout(element)
      document.body.classList.remove('kb-dragging')
    },
    cancel(_ctx: any, _reason: string) {
      released = true
      dragMotion?.stop()
      dragMotion = null
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
