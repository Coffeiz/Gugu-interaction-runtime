import { applyFloatingStyle, clearFloatingStyle, getFloatingProxy, setProxyInteractive, takeFloatingProxy } from '../../dom/Visual'
import { acquireSourceVisualLease, type SourceVisualLease } from '../../dom/SourceVisualLease'
import { createCardMotionController, type CardMotionController } from '../../motion/CardMotionController'
import { FOLLOW_PROFILE, FOLLOW_ROTATION } from '../../motion/MotionProfile'
import { shapeReleaseVelocity } from '../../motion/ReleaseMotion'
import { captureDetachDraggingSnapshot, prepareDetachMotion, prepareDetachPickup, createDetachDropState, updateDetachDrop, resolveDetachLandingTarget, captureDetachTargetSnapshot, createDetachVisualContext, startDetachLandingVisual, completeDetachLanding, resolveDetachRegrabTarget, interruptDetachRegrab, scheduleDetachLandingFrame, createDetachLayoutLifecycle, createDetachLandingLifecycle } from '../DetachMoveDriver'
import type { Runtime, RuntimeCompletionGate } from '../../Runtime'
import type { LandingResult, MoveBehaviorDriver, MoveVisualLifecycle } from '../../behavior/MoveBehavior'

export function createDetachMoveFromAdapter(config: {
  runtime: Runtime
  objectId: string
  element: HTMLElement
  event: PointerEvent
  fromRect?: DOMRect
  returnRect?: DOMRect
  /** clone 保留源节点的布局占位，并用独立代理跟手。 */
  clone?: boolean
}): { driver: MoveBehaviorDriver; lifecycle: MoveVisualLifecycle } {
  const { runtime, objectId, element, event, fromRect, clone = false } = config
  // surfaceIds 和 findColumnIdOf 从 Runtime 注册表获取，不需要用户传
  const objectItem = runtime.objects.get(objectId)
  const allSurfaces = runtime.surfaces.snapshot()
  const surfaceIds = allSurfaces.map(s => s.id)
  const findColumnIdOf = (oid: string) => runtime.objects.get(oid)?.surfaceId
  const initialSurfaceId = objectItem?.surfaceId ?? allSurfaces[0]?.id
  // 折叠的年/月分组（data-layout-content 容器 data-layout-open="false"）里的
  // 卡片本来就不可见，节点却仍然挂在 DOM 里（折叠只是收起高度，不卸载）。
  // 让它们继续参与 FLIP 快照会白白测量、处理一整个折叠分组的卡片——已完成列
  // 分组多、卡片多时，这部分完全无意义的开销能占到单次落地 captureLayoutFlip
  // 总耗时的大头（见 landing 卡顿排查，trace 里单次 118ms）。用 closest 检查
  // 有没有被某一层折叠祖先包住，包住了就不参与这次 FLIP。
  const isInsideCollapsedGroup = (element: HTMLElement): boolean =>
    element.closest('[data-layout-content][data-layout-open="false"]') !== null
  const registeredElements = (): HTMLElement[] => {
    const objects = [...runtime.objects.values()]
      .map(item => item.element)
      .filter((candidate): candidate is HTMLElement => Boolean(candidate?.isConnected))
    // 布局锚点（例如列表末尾的“新建项目”）不是可拖拽物，不会注册为
    // Runtime object，但必须和兄弟卡片共享同一份 FLIP 快照，否则它仍由
    // Vue TransitionGroup 单独移动，release 时会与卡片错拍。
    const anchors = Array.from(document.querySelectorAll<HTMLElement>('[data-flip-target]'))
    return Array.from(new Set([...objects, ...anchors]))
      .filter(candidate => !isInsideCollapsedGroup(candidate))
  }
  let beforeContent: HTMLElement | undefined
  let draggingSnapshot: ReturnType<typeof captureDetachDraggingSnapshot> | undefined
  let dropState: ReturnType<typeof createDetachDropState<{ columnId: string; index: number }>> | undefined
  let pendingDrop: { columnId: string; index: number; invalidReturn?: boolean } | null = null
  let landingPlan: (() => void) | null = null
  let landingGate: RuntimeCompletionGate<LandingResult> | null = null
  let landingProxy: HTMLElement | null = null
  let released = false
  let sessionId: string | null = null
  let objectLease: { release: () => void } | null = null
  let sourceLease: SourceVisualLease | null = null
  let autoScroller: { update: (container: HTMLElement | null, point: { x: number; y: number }) => void; stop: () => void } | null = null
  let dragMotion: CardMotionController | null = null
  let releaseMotionState: { x: number; y: number; vx: number; vy: number; scaleX: number; scaleY: number; rotateX: number; rotateZ: number } | undefined
  let dragOffset = { x: 0, y: 0 }
  let pickupIndex: number | null = null
  let pointerMoved = false

  // 布局 FLIP 只需要比较当前源 Surface 与最后命中的目标 Surface。
  // 这样已完成列之外的大量项目不会参与每次拖拽的分组、Surface 和
  // collection presence 测量；没有有效目标时自然只保留源 Surface。
  const layoutScopeSurfaces = (): readonly HTMLElement[] => {
    const ids = new Set<string>()
    if (initialSurfaceId) ids.add(initialSurfaceId)
    if (pendingDrop?.columnId) ids.add(pendingDrop.columnId)
    return runtime.surfaces.snapshot()
      .filter(surface => ids.has(surface.id))
      .map(surface => surface.element)
      .filter((surface): surface is HTMLElement => Boolean(surface?.isConnected))
  }

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
        invalidReturn: true,
      }
    }
    if (!pendingDrop) return { accepted: false as const }
    // 抓取阶段的浮动 proxy 在这里交给 landing proxy 接管；有效落点继续让源节点
    // 脱离布局，避免业务节点先恢复占位把兄弟卡片顶回去。
    // 即使落点仍是同列同 index，也不能清除 release 阶段捕获的布局快照：
    // 抓起时兄弟卡片已经收位，放回后它们需要用这份快照播放回位 FLIP。
    const destination = pendingDrop
    const beforeRect = landingProxy?.getBoundingClientRect()
      ?? runtime.getVisualProxy(sessionId!)?.element.getBoundingClientRect()
      ?? getFloatingProxy(element)?.getBoundingClientRect()
      ?? element.getBoundingClientRect()
    delete element.dataset.runtimeActive
    // objectLease 释放时机分两种情况：
    // - 无效落点（invalidReturn）：destination 就是原位置，没有 emit，业务
    //   <Teleport> 传送回去的本来就是正确位置，这里立刻释放没有风险，也不能
    //   拖到 surface.enter——那个钩子只在有 emitAction 时才会触发，无效落点
    //   永远等不到。
    // - 有效落点：这里立刻释放会让 <Teleport :disabled="!isDetached(...)">
    //   在 emit() 真正把卡片挪到新位置之前就把它传送回原列（store 还没变），
    //   等 emit 生效后又要再传送一次——两次传送中间隔着至少一次 Vue 渲染
    //   节拍，足够露出"原位占位符突然出现、兄弟卡收位"这一帧。这种情况改到
    //   emit() 成功之后触发的 lifecycle.surface.enter 里释放（见下方
    //   lifecycle 定义），这时 store 已经落地，传送回来的就是最终位置。
    //   （曾经试过挪到 finishReveal——landing 动画结束才释放——结果太晚：
    //   landing 阶段解析真实落点目标的 resolveMoveTarget/waitForMoveTarget
    //   本身就要等卡片被 Teleport 传送回真实 DOM 才能找到它，一直不释放会
    //   直接找不到目标，表现为飞向页面默认兜底位置。）
    if (invalidReturn) {
      sourceLease?.restoreLayoutHidden()
      objectLease?.release()
    }
    const proceedWithTarget = (sid: string, target: HTMLElement | null) => {
      if (getSessionState() !== 'landing') return
      const landedEl = resolveDetachLandingTarget({
        resolve: () => target,
        applyState: (target: HTMLElement) => runtime.applyVisualState(objectId, target, { phase: 'revealing', hovered: false, selected: target.classList.contains('is-selected'), grabbed: false }),
      })
      if (!landedEl) {
        landingGate?.complete({ completed: false, reason: 'target-not-registered' }); landingGate = null; return
      }
      runtime.keepSurfaceTargetVisible(destination.columnId, landedEl)
      const targetSnapshot = captureDetachTargetSnapshot((el: HTMLElement) => runtime.captureVisualState(objectId, el), landedEl)
      const visualContext = createDetachVisualContext({
        createContext: () => runtime.createVisualLifecycleContext(sid, destination, landedEl, beforeContent!),
        source: element, sourceRect: beforeRect, visualSnapshot: draggingSnapshot!, targetSnapshot,
        motionState: releaseMotionState,
      })
      landingProxy = startDetachLandingVisual({
        // 抓取阶段已登记统一 proxy，landing 直接接管它；getVisualProxy 缺失时
        // 才在这里补建，覆盖异常中断或 regrab 后代理已被清理的情况。
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
      void runtime.resolveLandingTarget(sid, destination).then(target => proceedWithTarget(sid, target))
    })
    return { accepted: true as const, destination: pendingDrop, ...(invalidReturn ? { emitAction: false } : {}) }
  }

  function onRegrab(regrabEvent: PointerEvent) {
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
      interrupt: () => runtime.takeoverRegrab(sessionId!),
      clearRegrab: () => runtime.clearRegrab(objectId),
    })
    const targetRect = liveEl.getBoundingClientRect()
    // proxyRect 是带缩放/旋转的视觉外接框，不能作为新 session 的布局尺寸。
    // Runtime 已将代理位置与真实节点的未变换尺寸合成为 regrabRect，避免
    // regrab 时再次叠加 3D 姿态导致卡片变高、底部出现空白。
    runtime.startObjectPointer(objectId, liveEl, regrabEvent, regrabContext.regrabRect, targetRect)
  }

  const driver: MoveBehaviorDriver = {
    prepare(ctx) {
      sessionId = ctx.session.id
      pointerMoved = false
      autoScroller = runtime.createAutoScroller(sessionId!, {
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
      const { beforePickup } = prepareDetachPickup(element, registeredElements, layoutScopeSurfaces)
      pickupIndex = runtime.getObjectSurfaceIndex(objectId, initialSurfaceId)
      beforeContent = element.cloneNode(true) as HTMLElement
      const moveContext = runtime.getMoveContext(sessionId!)
      const motion = prepareDetachMotion(moveContext, element, event, fromRect, runtime.getObjectGrabAlign(objectId))
      const rect = motion.rect
      dragOffset = { x: motion.offsetX, y: motion.offsetY }
      // 拖拽期间浮动本体 pointer-events:none，指针事件穿透到下方真实卡片——
      // 划过路径上的兄弟卡片会触发它们各自的原生 :hover 过渡（如 box-shadow，
      // 强制重绘、不走合成层），密集触发会掉帧。这个全局类给业务方一个统一
      // 信号，在 CSS 里关掉拖拽期间的 hover 过渡；commit()/cancel() 已经在移除
      // 它，这里补上添加，把信号接回来。
      document.body.classList.add('kb-dragging')
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
      // clone 和 detach 共用同一个抓取 proxy 工厂与 handoff 形式，保证 grabbing
      // 的姿态、过渡和 release 动量一致；唯一差别是 detach 立即移除源占位。
      applyFloatingStyle(element, rect)
      const adoptedProxy = takeFloatingProxy(element)
      if (adoptedProxy) runtime.registerVisualProxy(sessionId!, { element: adoptedProxy })
      element.style.pointerEvents = 'none'
      if (!clone) {
        // 让兄弟卡片立即看到源节点已离开布局流，随后复用同一份 beforePickup
        // 快照播放收位 FLIP；可见主体仍由 floating proxy 承担。
        sourceLease.detachFromLayout()
      }
      // grabbing 期间 transform 由 MotionController 每帧写入，不能再让 CSS transition
      // 对每次物理更新做线性插值，否则角度回正会覆盖弹簧的非线性轨迹（0.9.6 原有的坑）。
      element.style.transition = 'none'
      runtime.scheduleLayout(beforePickup)
      element.dataset.runtimeActive = 'true'
      const floatingProxy = runtime.getVisualProxy(sessionId!)?.element
        ?? getFloatingProxy(element)
      if (!floatingProxy) return
      // floatingProxy 的 left/top 由 createDragProxy 一次性定死在 rect.left/rect.top
      // （position:fixed），此后每帧只用 transform 的 translate3d 叠加位移量——
      // left/top 是会触发布局的属性，每帧写会弄脏布局；紧跟着的命中判定
      // （RegisteredHit.ts）要读 getBoundingClientRect，逼着浏览器把脏布局同步
      // 刷新掉才能给出准确值，也就是强制重排。改成只写 transform（纯合成层，
      // 不碰布局）后，跟手动画和命中判定互不打扰（见跨列卡顿排查：DevTools 的
      // “强制自动重排”警告点名过 CardMotionController 这里的 onFrame）。
      const anchorLeft = rect.left
      const anchorTop = rect.top
      dragMotion = createCardMotionController({
        mode: 'follow',
        followRotation: FOLLOW_ROTATION,
        onFrame: frame => {
          if (!floatingProxy.isConnected) return
          const dx = frame.x - anchorLeft
          const dy = frame.y - anchorTop
          floatingProxy.style.transform = `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0) perspective(760px) rotateX(${frame.rotateX.toFixed(2)}deg) rotateZ(${frame.rotateZ.toFixed(2)}deg) scale(${frame.scaleX.toFixed(4)}, ${frame.scaleY.toFixed(4)})`
        },
      })
      dragMotion.setProfile(FOLLOW_PROFILE)
      dragMotion.seed({ x: rect.left, y: rect.top, scaleX: 1.03, scaleY: 1.03, rotateX: FOLLOW_ROTATION.tilt, rotateZ: 0 })
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
    commit: (_ctx, destination) => {
      // grab 阶段的 proxy 已经登记到 Runtime，commit 只让源节点继续保持隐藏，
      // 由同一个 proxy 直接进入 landing，不创建第二个视觉对象。
      if (!runtime.getVisualProxy(sessionId!)) clearFloatingStyle(element)
      // 有效落点保持 display:none，直到 surface.enter 让业务节点进入最终
      // Surface；无效回位已在 onUp() 恢复布局隐藏状态。
      const invalidReturn = typeof destination === 'object'
        && destination !== null
        && (destination as { invalidReturn?: unknown }).invalidReturn === true
      const destinationSurface = typeof destination === 'object'
        && destination !== null
        ? ((destination as { columnId?: unknown; toSurfaceId?: unknown }).toSurfaceId
          ?? (destination as { columnId?: unknown }).columnId)
        : undefined
      const sameSurfaceLanding = !invalidReturn
        && typeof destinationSurface === 'string'
        && destinationSurface === initialSurfaceId
      // 同 Surface 重排时，源节点必须恢复为“隐藏但占位”。Vue 更新索引后，
      // landing 才能从同一个业务节点读到最终布局矩形；display:none 会让它
      // 变成 0x0，代理随后被错误收缩成细条。跨 Surface 仍保持脱离布局，
      // 等目标 Surface 完成渲染后再交接。
      if (invalidReturn || sameSurfaceLanding) sourceLease?.restoreLayoutHidden()
      else sourceLease?.detachFromLayout()
      document.body.classList.remove('kb-dragging')
    },
    cancel(_ctx: any, _reason: string) {
      released = true
      dragMotion?.stop()
      dragMotion = null
      if (runtime.getVisualProxy(sessionId!)) runtime.disposeVisualProxy(sessionId!)
      else if (landingProxy) { runtime.disposeVisualProxy(sessionId!); landingProxy = null }
      else clearFloatingStyle(element)
      runtime.clearRegrab(objectId)
      document.body.classList.remove('kb-dragging')
      delete element.dataset.runtimeActive
      clearFloatingStyle(element)
      sourceLease?.restore()
      sourceLease = null
    },
  }

  const lifecycle: MoveVisualLifecycle = {
    layout: createDetachLayoutLifecycle(element, registeredElements, layoutScopeSurfaces),
    surface: {
      // emit() 成功之后触发（见 RuntimeMove.ts MoveCommitCoordinator.commit），
      // 此时业务 store 已经落地在新 Surface，这里释放 ownership，业务
      // <Teleport :disabled="!isDetached(...)"> 传送回来的就是最终正确位置，
      // 不会有"先传送回原列、emit 生效后再传送一次"的中间态闪烁。
      // 无效落点（没有 emit）不会走到这里，在 onUp 里已经立刻释放过了。
      enter: () => objectLease?.release(),
    },
    ...createDetachLandingLifecycle({
      createGate: () => runtime.createCompletionGate(sessionId!, { completed: false, reason: 'landing-cancelled' }),
      onGate: (gate: RuntimeCompletionGate<LandingResult>) => { landingGate = gate },
      clearDragging: () => document.body.classList.remove('kb-dragging'),
      scheduleLanding: () => { landingPlan?.(); landingPlan = null },
      clearRegrab: () => runtime.clearRegrab(objectId),
      finishReveal: () => {
        if (landingProxy) setProxyInteractive(landingProxy, false)
        // landing 完成后再保险清理旧 floating registry；正常 handoff 后这里是
        // 空操作，真正的 proxy 由 Runtime 的统一 dispose 边界销毁。
        clearFloatingStyle(element)
        sourceLease?.restore()
        sourceLease = null
      },
    }),
  }

  return { driver, lifecycle }
}

/** Runtime 内建 clone 策略；生命周期与 detach 共用，差异只在抓取阶段的占位语义。 */
export function createCloneMoveFromAdapter(config: {
  runtime: Runtime
  objectId: string
  element: HTMLElement
  event: PointerEvent
  fromRect?: DOMRect
  returnRect?: DOMRect
}): { driver: MoveBehaviorDriver; lifecycle: MoveVisualLifecycle } {
  return createDetachMoveFromAdapter({ ...config, clone: true })
}
