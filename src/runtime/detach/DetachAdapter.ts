import { createAutoScroller, type AutoScrollController } from '../../dom/AutoScroll'
import { captureLayoutFlip, scheduleLayoutFlip } from '../../dom/GroupLayout'
import { applyFloatingStyle, clearFloatingStyle, getFloatingProxy, setProxyInteractive } from '../../dom/Visual'
import { acquireSourceVisualLease, type SourceVisualLease } from '../../dom/SourceVisualLease'
import { createCardMotionController, type CardMotionController } from '../../motion/CardMotionController'
import { FOLLOW_PROFILE, FOLLOW_ROTATION } from '../../motion/MotionProfile'
import { shapeReleaseVelocity } from '../../motion/ReleaseMotion'
import { captureDetachDraggingSnapshot, prepareDetachMotion, prepareDetachPickup, createDetachDropState, updateDetachDrop, resolveDetachLandingTarget, captureDetachTargetSnapshot, createDetachVisualContext, startDetachLandingVisual, completeDetachLanding, resolveDetachRegrabTarget, interruptDetachRegrab, scheduleDetachLandingFrame, createDetachLayoutLifecycle, createDetachLandingLifecycle } from '../DetachMoveDriver'
import type { Runtime, RuntimeCompletionGate } from '../../Runtime'
import type { LandingResult, MoveBehaviorDriver, MoveVisualLifecycle } from '../../behavior/MoveBehavior'

/** 临时诊断专用：console 打点 + performance.mark，方便跟 Performance 面板的 trace 对上号。 */
function markProbe(name: string, detail: Record<string, unknown>): void {
  console.info(`[probe:${name}]`, JSON.stringify(detail))
  performance.mark(`probe:${name}`, { detail })
}

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
  const { runtime, objectId, element, event, fromRect } = config
  // surfaceIds 和 findColumnIdOf 从 Runtime 注册表获取，不需要用户传
  const objectItem = runtime.objects.get(objectId)
  const allSurfaces = runtime.surfaces.snapshot()
  const surfaceIds = allSurfaces.map(s => s.id)
  const findColumnIdOf = (oid: string) => runtime.objects.get(oid)?.surfaceId
  const initialSurfaceId = objectItem?.surfaceId ?? allSurfaces[0]?.id
  const registeredElements = (): HTMLElement[] => [...runtime.objects.values()]
    .map(item => item.element)
    .filter((candidate): candidate is HTMLElement => Boolean(candidate?.isConnected))
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
  let sourceLease: SourceVisualLease | null = null
  let autoScroller: AutoScrollController | null = null
  let dragMotion: CardMotionController | null = null
  let releaseMotionState: { x: number; y: number; vx: number; vy: number; scaleX: number; scaleY: number; rotateX: number; rotateZ: number; rotateVX: number; rotateVZ: number } | undefined
  let dragOffset = { x: 0, y: 0 }
  let pickupIndex: number | null = null
  let pointerMoved = false

  function getSessionState() { return sessionId ? runtime.getSession(sessionId)?.state : undefined }

  function updateDropFromPoint(x: number, y: number): void {
    if (getSessionState() !== 'active') return
    if (!dropState) return
    const hit = updateDetachDrop({
      active: getSessionState() === 'active',
      event: { clientX: x, clientY: y } as PointerEvent,
      state: dropState,
      resolve: (ev: PointerEvent) => runtime.resolveMoveHit(objectId, ev.clientX, ev.clientY),
      getSurface: (drop: { columnId: string; index: number }) => drop.columnId,
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
      runtime.resolveMoveSurfaceElement(objectId, moveEvent.clientX, moveEvent.clientY),
      { x: moveEvent.clientX, y: moveEvent.clientY },
    )
  }

  function onUp(releaseEvent?: PointerEvent) {
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
    if (releaseEvent) updateDropFromPoint(releaseEvent.clientX, releaseEvent.clientY)
    pendingDrop = dropState.release()
    // 原地按下后立即松手没有 pointermove，命中器会排除 source 自身，
    // 因而 pendingDrop 为空；这应视为回到原位置并走完整 landing 生命周期，
    // 而不是走没有 regrab 的 invalid-return 快路径。
    if (!pendingDrop && !pointerMoved && releaseMotionState && Math.hypot(releaseMotionState.vx, releaseMotionState.vy) < 0.5) {
      if (initialSurfaceId) {
        pendingDrop = {
          columnId: initialSurfaceId,
          index: pickupIndex ?? Math.max(0, runtime.getObjectSurfaceIndex(objectId, initialSurfaceId)),
        }
      }
    }
    const invalidReturn = !pendingDrop
    if (invalidReturn && initialSurfaceId) {
      // 无效落点不是另一条“回飞 proxy”路径：仍复用抓取阶段的唯一 proxy，
      // 飞回原 Surface 的真实业务节点。仅跳过 Action，避免业务 Store 发生假移动。
      pendingDrop = {
        columnId: initialSurfaceId,
        index: pickupIndex ?? Math.max(0, runtime.getObjectSurfaceIndex(objectId, initialSurfaceId)),
      }
    }
    if (!pendingDrop) return { accepted: false as const }
    // 抓取阶段是源节点自己在飞（0.9.6 式单节点），这里松手交给 landing proxy 接管：
    // 恢复源节点的正常布局占位、保持隐藏，proxy 才是接下来唯一的可见视觉主体。
    const destination = pendingDrop
    const beforeRect = landingProxy?.getBoundingClientRect() ?? element.getBoundingClientRect()
    sourceLease?.restoreLayoutHidden()
    delete element.dataset.runtimeActive
    objectLease?.release()
    const proceedWithTarget = (sid: string, target: HTMLElement | null) => {
      if (getSessionState() !== 'landing') return
      const landedEl = resolveDetachLandingTarget({
        resolve: () => target,
        applyState: (target: HTMLElement) => runtime.applyVisualState(objectId, target, { phase: 'revealing', hovered: false, selected: target.classList.contains('is-selected'), grabbed: false }),
      })
      if (!landedEl) {
        landingGate?.complete({ completed: false, reason: 'target-not-registered' }); landingGate = null; return
      }
      const scrollColumn = runtime.resolveMoveSurfaceViewport(destination.columnId)
      if (scrollColumn) {
        keepElementWithinColumn(scrollColumn, landedEl)
      }
      const targetSnapshot = captureDetachTargetSnapshot((el: HTMLElement) => runtime.captureVisualState(objectId, el), landedEl)
      const visualContext = createDetachVisualContext({
        createContext: () => runtime.createVisualLifecycleContext(sid, destination, landedEl, beforeContent!),
        source: element, sourceRect: beforeRect, visualSnapshot: draggingSnapshot!, targetSnapshot,
        motionState: releaseMotionState,
      })
      landingProxy = startDetachLandingVisual({
        // 抓取阶段没有 proxy（源节点自己飞），这里现建；getVisualProxy 兜底只是防御
        // regrab 等场景下 proxy 已经存在的情况，不是复用 prepare 阶段建的实例。
        createProxy: () => runtime.getVisualProxy(sid) ?? runtime.createVisualProxy(sid, visualContext) ?? null,
        enableProxy: (proxy: HTMLElement) => setProxyInteractive(proxy, true),
        bindRegrab: (proxy: HTMLElement) => runtime.bindRegrabTarget(sid, objectId, proxy, onRegrab),
        land: () => runtime.landVisualProxy(sid, landedEl, visualContext),
        onMissing: () => { landingGate?.complete({ completed: false, reason: 'visual-proxy-missing' }); landingGate = null },
        onComplete: (landingResult: LandingResult) => {
          completeDetachLanding({
            active: getSessionState() === 'landing',
            result: landingResult,
            complete: (result: LandingResult) => landingGate?.complete(result),
            // 本体揭示后立刻在同一个微任务里销毁飞行代理，不要等 MoveLandingCoordinator.run
            // 后续的 session.handoff() → behavior.reveal()（我们自己的 finishReveal，只关
            // pointerEvents）→ port.end()（真正 disposeVisualProxy 的地方）——那条链隔了两次
            // await，代理在本体已可见之后还会多留几帧甚至更久，表现为本体和代理短暂重叠。
            reveal: () => runtime.revealVisualProxy(sid, landedEl, visualContext).then(() => {
              if (landingProxy) { runtime.disposeVisualProxy(sid); landingProxy = null }
            }),
          })
          landingGate = null
        },
      })
    }
    landingPlan = scheduleDetachLandingFrame(() => undefined, () => {
      const sid = sessionId!
      // 0.9.6 是同步解析（resolveMoveTarget + 兜底 querySelector），拿到目标就在
      // 同一个 rAF 回调里同步 applyState + conceal，跟 Vue 挂载目标节点在同一帧
      // 完成，不会露出一帧未隐藏的本体。1.0.1 为了修跨 Surface 拿错/拿空目标的
      // 问题，改成了 waitForMoveTarget 的多帧异步轮询——但轮询本身要等目标出现
      // 在新 Surface 容器里才 resolve，而 Vue 的挂载/绘制发生在轮询检测到之前，
      // 这段异步等待就是本体一闪的来源。这里先按 0.9.6 的方式同步尝试一次，
      // 拿到就立刻走同帧流程；只有同步解析真的拿不到（需要等 Vue 异步挂载到新
      // Surface）时才退回多帧轮询兜底，两边都要。
      const syncTarget = runtime.resolveMoveTarget(sid, destination)
      if (syncTarget) {
        proceedWithTarget(sid, syncTarget)
        return
      }
      void runtime.waitForMoveTarget(sid, destination).then(target => proceedWithTarget(sid, target))
    })
    return { accepted: true as const, destination: pendingDrop, ...(invalidReturn ? { emitAction: false } : {}) }
  }

  function onRegrab(regrabEvent: PointerEvent) {
    markProbe('regrab-fired', { objectId, interruptedSessionId: sessionId, sessionState: getSessionState() })
    if (getSessionState() !== 'landing') return
    const proxy = landingProxy
    if (!proxy || !sessionId) return
    const liveEl = resolveDetachRegrabTarget(
      () => runtime.resolveVisualTarget(sessionId!, pendingDrop),
      () => runtime.objects.get(objectId)?.element ?? null,
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
      markProbe('prepare', { objectId, sessionId, sessionState: ctx.session.state })
      pointerMoved = false
      autoScroller = createAutoScroller(ctx.session.cleanup, {
        onScroll: point => updateDropFromPoint(point.x, point.y),
      })
      if (ctx.session.state !== 'prepare') return
      runtime.objects.setElement(objectId, element)
      // 取消回飞可能在下一次抓取前仍处于收尾阶段；新 session 接管时必须
      // 先让 source 重新可见，避免新旧视觉对象同时隐藏或叠加。regrab 打断
      // 的是"落地中"的旧 session：它的 commit() 已经跑过
      // restoreLayoutHidden()，把 pointer-events 也设成了 none（配合
      // visibility:hidden 让 landing proxy 接管交互）。旧 session 被中断时
      // 来不及跑自己的 cancel()/restore() 清掉这份样式，这里如果只重置
      // visibility、不重置 pointer-events，紧接着 acquireSourceVisualLease
      // 会把这份带着 pointer-events:none 的脏样式当成"原始态"存下来，
      // 事务结束后 restore() 精确恢复到这份脏基准，卡片从此再也点不到。
      element.style.visibility = ''
      element.style.pointerEvents = ''
      objectLease = runtime.acquireObject(sessionId!, objectId)
      runtime.takeSurfaces(sessionId!, surfaceIds)
      const { beforePickup } = prepareDetachPickup(element, registeredElements)
      pickupIndex = runtime.getObjectSurfaceIndex(objectId, initialSurfaceId)
      beforeContent = element.cloneNode(true) as HTMLElement
      const moveContext = runtime.getMoveContext(sessionId!)
      const motion = prepareDetachMotion(moveContext, element, event, fromRect)
      const rect = motion.rect
      dragOffset = { x: motion.offsetX, y: motion.offsetY }
      runtime.applyVisualState(objectId, element, {
        phase: 'dragging',
        hovered: element.matches(':hover'),
        selected: element.classList.contains('is-selected'),
        grabbed: true,
      })
      draggingSnapshot = captureDetachDraggingSnapshot((_id: string, el: HTMLElement) => runtime.captureVisualState(objectId, el), objectId, element)
      // 单节点：抓取阶段不建独立 proxy，直接让源节点自己飞（position:fixed 原地
      // 悬浮，不 reparent）。落地阶段仍然走独立 proxy（onUp 里现建），源节点只在
      // "松手→落地"这个窗口才会被隐藏、交给 proxy 接管。
      //
      // 曾经试过在这里把 element 手动 appendChild 到 document.documentElement
      // 逃裁切（跟 landing proxy 一样），但业务侧实测会导致 Vue 重渲染时认不出
      // 这个被搬移过的节点，在新列另外挂一份新的，旧节点没被回收——变成两张卡片
      // 同时存在。手动 reparent 业务 DOM 节点这条路径被证实不安全，已经撤销，
      // 不要再加回来。真要在抓取阶段也逃出玻璃裁切，得走 Vue 自己的 <Teleport>
      // （业务组件自己声明，Vue 的 vnode 追踪能正确处理），不能由 Runtime 在业务
      // 节点身上做无 Vue 感知的 DOM 手术。
      //
      // 必须先拿 lease（快照抓取前的原始 inline style）再让元素浮动，否则
      // restore() 会把"悬浮中"的样式当成原始态存下来。
      sourceLease = acquireSourceVisualLease(element, sessionId!)
      applyFloatingStyle(element, rect)
      // grabbing 期间 transform 由 MotionController 每帧写入，不能再让 CSS transition
      // 对每次物理更新做线性插值，否则角度回正会覆盖弹簧的非线性轨迹（0.9.6 原有的坑）。
      element.style.transition = 'none'
      scheduleLayoutFlip(beforePickup)
      element.dataset.runtimeActive = 'true'
      const floatingProxy = getFloatingProxy(element)!
      dragMotion = createCardMotionController({
        mode: 'follow',
        followRotation: FOLLOW_ROTATION,
        onFrame: frame => {
          if (!floatingProxy.isConnected) return
          floatingProxy.style.left = `${frame.x}px`
          floatingProxy.style.top = `${frame.y}px`
          floatingProxy.style.transform = `perspective(760px) rotateX(${frame.rotateX.toFixed(2)}deg) rotateZ(${frame.rotateZ.toFixed(2)}deg) scale(${frame.scaleX.toFixed(4)}, ${frame.scaleY.toFixed(4)})`
        },
      })
      dragMotion.setProfile(FOLLOW_PROFILE)
      dragMotion.seed({ x: rect.left, y: rect.top, scaleX: 1.03, scaleY: 1.03, rotateX: 5, rotateZ: 0 })
      dragMotion.setTarget({ x: event.clientX - dragOffset.x, y: event.clientY - dragOffset.y })
      dragMotion.start()
      dropState = createDetachDropState(
        findColumnIdOf(objectId),
        (ev: PointerEvent) => runtime.resolveMoveHit(objectId, ev.clientX, ev.clientY),
        (drop: { columnId: string; index: number }, previous: { columnId: string; index: number } | null) => drop.columnId === previous?.columnId && drop.index === previous?.index,
      )
      // regrab 后可能没有新的 pointermove 就立即松手；先用 pointerdown 坐标
      // 初始化当前落点，避免 pendingDrop 为空而被误判为无效取消。
      updateDropFromPoint(event.clientX, event.clientY)
    },
    update(_ctx: any, input: any) { if (input.event instanceof PointerEvent) onMove(input.event) },
    resolveDestination(_ctx: unknown, input) {
      return onUp(input.event instanceof PointerEvent ? input.event : undefined)
    },
    commit: () => {
      // floatingProxy 是 grab 阶段的独立视觉节点；commit 后 landing 会接管视觉，
      // 必须先销毁，否则会和 landing proxy 一起留在屏幕上。
      clearFloatingStyle(element)
      sourceLease?.restoreLayoutHidden()
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
      sourceLease?.restore()
      sourceLease = null
    },
  }

  const lifecycle: MoveVisualLifecycle = {
    layout: createDetachLayoutLifecycle(element, registeredElements),
    ...createDetachLandingLifecycle({
      createGate: () => runtime.createCompletionGate(sessionId!, { completed: false, reason: 'landing-cancelled' }),
      onGate: (gate: RuntimeCompletionGate<LandingResult>) => { landingGate = gate },
      clearDragging: () => document.body.classList.remove('kb-dragging'),
      scheduleLanding: () => { landingPlan?.(); landingPlan = null },
      clearRegrab: () => runtime.clearRegrab(objectId),
      finishReveal: () => {
        markProbe('finish-reveal', { objectId, sessionId })
        if (landingProxy) setProxyInteractive(landingProxy, false)
        // landing 完成后再保险清理一次 floatingProxy，防止 commit 时 element 已
        // 被 Vue 重渲染导致 WeakMap 查不到而漏掉。
        clearFloatingStyle(element)
        sourceLease?.restore()
        sourceLease = null
      },
    }),
  }

  return { driver, lifecycle }
}
