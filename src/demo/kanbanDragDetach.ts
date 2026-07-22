import { runtime, type RuntimeCompletionGate } from '../Runtime'
import {
  clearFloatingStyle,
  moveFloating,
  releaseVisibilityOwnership,
  setProxyInteractive,
  settleFloatingLayout,
} from '../dom/Visual'
import { captureLayoutFlip, scheduleLayoutFlip } from '../dom/GroupLayout'
import { createDomHitResolver, hitWithResolver } from '../dom/Hit'
import type { VisualSnapshot } from '../dom/VisualAdapterTypes'
import { columns } from './store'
import type { LandingResult } from '../behavior/MoveBehavior'
import {
  captureDetachDraggingSnapshot,
  applyDetachPickupVisual,
  createDetachLayoutLifecycle,
  createDetachMoveRequest,
  createDetachMoveDriver,
  createDetachVisualLifecycle,
  prepareDetachMotion,
  prepareDetachPickup,
  prepareDetachSession,
  startDetachSession as startRuntimeDetachSession,
} from '../runtime/DetachMoveDriver'

function startDetachSession(cardId: string, event: PointerEvent) {
  return startRuntimeDetachSession(
    () => runtime.start(createDetachMoveRequest(cardId, event)),
    id => runtime.getSession(id),
    id => prepareDetachSession(
      (sessionId, objectId) => runtime.acquireObject(sessionId, objectId),
      (sessionId, surfaceIds) => runtime.takeSurfaces(sessionId, surfaceIds),
      id,
      cardId,
      columns.map(column => `column:${column.id}`),
    ),
  )
}

/** 把抓起前的内容和兄弟布局快照冻结下来，供 Runtime Move 创建阶段消费。 */
/**
 * detach 跟手阶段只有一个真实对象；但松手后它必须回到 Vue 的真实列表，因而
 * 会再次进入 Surface 的裁剪树。落地交接改用 Runtime overlay 中短暂存在的
 * visual proxy，本体全程由 Vue 管理且保持隐藏，动画结束后再揭示本体。
 */
const kanbanHitResolver = createDomHitResolver({ surfaceSelector: '[data-column]', targetSelector: '[data-card]' })
runtime.setHitResolver(kanbanHitResolver)

function performDetachRegrab(args: {
  event: PointerEvent
  cardId: string
  sessionId: string
  proxy: HTMLElement
  source: HTMLElement
  proxyRect: DOMRect
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
  startCardDragDetach(args.event, args.cardId, args.source, args.proxyRect)
}

/**
 * "detach" 策略：全程只有一个对象——不克隆 proxy，本体自己脱离文档流。
 * 配合 KanbanBoard.vue 里的 `<Teleport :disabled="!isDetached(cardId)">`：
 * Runtime 一接管这个对象，Vue 就把它搬去 body；Runtime 松手，Vue 就把它
 * 摆回真实列表位置——DOM 搬运全程由 Vue 自己做，Runtime 只在"已经不受
 * Vue 管"的这段窗口里改它的内联定位样式。
 *
 * 跟 "clone" 策略（kanbanDrag.ts）比，这里不需要维护 landingRegrabs 登记
 * 表：这个节点全程只有一份，重新抓起就是对它再来一次 pointerdown，
 * getBoundingClientRect() 拿到的天然就是它当前的视觉位置——不管这个位置
 * 是"正在跟手"还是"正在 FLIP 回弹"。
 */
export function startCardDragDetach(event: PointerEvent, cardId: string, sourceEl: HTMLElement, fromRect?: DOMRect) {
  // 对象声明了自己不能参与 'move' 类型的 Session，直接拒绝。
  if (!runtime.objects.hasAbility(cardId, 'move')) return
  event.preventDefault()
  // 检查是否有正在飞行中的 regrab 登记。
  const activeRegrab = runtime.getRegrab(cardId)
  if (activeRegrab) {
    activeRegrab(event)
    return
  }
  // 落地代理要从抓起时的内容渐变到落点状态，先冻结内容和兄弟布局快照。
  const { beforeContent, beforePickup } = prepareDetachPickup(sourceEl)
  // 立即登记、下一帧播放。若这一帧内已经放下，新事务会接管此快照，
  // 不会先播一笔收束再瞬间清空。
  scheduleLayoutFlip(beforePickup)
  runtime.objects.setElement(cardId, sourceEl)
  const { session, objectLease } = startDetachSession(cardId, event)
  // 对象的 Lease 单独持有（不放进 session 的 leases 数组）：落地时需要先
  // 单独释放它（触发 Teleport 把节点放回真实位置），同时继续拿着 Surface
  // 的 Lease 直到落地动画结束，让 Vue 的 TransitionGroup 全程保持关闭。
  // sourceElement/dragOffset 的常规算法已经在 MoveBehavior.prepare() 里
  // 统一算好了（阶段 B）——detach 没有 clone 那种 regrab 特殊起点，直接用。
  // regrab 场景（fromRect 存在）例外：起点是代理飞到一半的插值位置。
  const moveContext = runtime.getMoveContext(session.id)
  const motion = prepareDetachMotion(moveContext, sourceEl, event, fromRect)
  const rect = motion.rect
  const startX = event.clientX
  const startY = event.clientY
  const offsetX = motion.offsetX
  const offsetY = motion.offsetY
  applyDetachPickupVisual(
    (id, element, state) => runtime.applyVisualState(id, element, state),
    cardId,
    sourceEl,
    rect,
    fromRect,
  )
  // 落地时要从"跟手时的样子"（这里，抬起阴影 + 放大）渐变到目标真实样式，
  // 而不是 clearFloatingStyle 瞬间抹掉——跟手状态之后不会再变，这里定住
  // 之后就能供 onUp() 里的落地补间使用。
  //
  // 不能直接用 getComputedStyle 读：applyFloatingStyle 是在同一帧里连着写
  // transition 和目标 box-shadow/transform 的，浏览器会把这当成一次真实的
  // .15s 过渡去播放，这里同步读到的是"过渡刚开始、还没插值到位"的中间值，
  // 不是抬起后的最终样子。border-radius/background 没被 applyFloatingStyle
  // 碰过，用 computed 读没问题；box-shadow/transform 这两个要读 el.style
  // 本身（也就是"刚被赋的目标值"），绕开过渡中的插值。
  const draggingSnapshot = captureDetachDraggingSnapshot(
    (id, element) => runtime.captureVisualState(id, element), cardId, sourceEl,
  )
  sourceEl.dataset.runtimeActive = 'true'
  moveFloating(sourceEl, startX, startY, offsetX, offsetY)
  // 阶段 C：往后每次 pointermove 的跟手定位由 MoveBehavior.update() 统一
  // 做（通过 orchestrateMoveSession 的 followElement 选项 + dragOffset）。
  // detach 的跟手对象就是本体自己。

  let currentColumnId = findColumnIdOf(cardId)
  let currentIndex = -1
  let pendingDrop: { columnId: string; index: number } | null = null
  let landingPlan: (() => void) | null = null
  let landingGate: RuntimeCompletionGate<LandingResult> | null = null
  let landingProxy: HTMLElement | null = null

  function findColumnIdOf(id: string) {
    return columns.find(col => col.cardIds.includes(id))?.id
  }

  function onMove(moveEvent: PointerEvent) {
    if (session.state !== 'active') return
    // 跟手定位已经在 MoveBehavior.update() 里做过了，这里只做命中判定。
    const hit = hitWithResolver(runtime.getHitResolver() ?? kanbanHitResolver, moveEvent.clientX, moveEvent.clientY, cardId)
    if (!hit) return
    if (hit.columnId === currentColumnId && hit.index === currentIndex) return
    currentColumnId = hit.columnId
    currentIndex = hit.index
    // detach 模式下拖动阶段不提交业务数组。否则鼠标经过哪一列，列计数和
    // Vue 节点归属就会立即改变，Teleport 可能在跟手过程中卸载本体。
    // 这里只记录候选落点，松手时一次性提交。
    pendingDrop = hit
  }

  function onUp(): { columnId: string; index: number } | null {
    if (session.state !== 'active' && session.state !== 'release') return null
    if (!pendingDrop) {
      document.body.classList.remove('kb-dragging')
      // 本列原位松手不是“不需要布局动画”：抓起时本体已经被 Teleport
      // 移出列表，兄弟卡正处于收束 FLIP。恢复本体前必须捕获这一帧的视觉
      // 位置，恢复后再反向 FLIP，否则旧 transform 被清空时会瞬间展开。
      const returnCards = Array.from(document.querySelectorAll<HTMLElement>('[data-card]'))
        .filter(el => el !== sourceEl && el.dataset.runtimeProxy !== 'true')
      const returnBefore = captureLayoutFlip(returnCards)
      runtime.cancel(session.id, 'no-valid-drop')
      clearFloatingStyle(sourceEl)
      delete sourceEl.dataset.runtimeActive
  objectLease?.release()
      scheduleLayoutFlip(returnBefore)
      return null
    }
    const beforeRect = sourceEl.getBoundingClientRect()
    // 必须在提交业务状态前登记：若 pickup 的 rAF 尚未执行，这一笔会直接
    // 替换它并继承抓起前的视觉快照。
    // 必须在 scheduleLayoutFlip 实际测量之前解除——本体此刻仍是
    // applyFloatingStyle 设的 position:fixed，不占父级正常布局空间，
    // 不解除的话 surface 高度动画会算出"少一张卡"的错误目标（见
    // dom/Visual.ts settleFloatingLayout 的注释）。保持不可见，真正的
    // 揭示仍然留给下面 landingPlan 里的 clearFloatingStyle。
    settleFloatingLayout(sourceEl)
    delete sourceEl.dataset.runtimeActive
    // 只放开这一个对象的 Lease：Vue 下一帧会把它摆回真实列表位置。
    // Surface 的 Lease（TransitionGroup 总闸）留到落地动画结束才一起释放。
      objectLease?.release()
    landingPlan = () => requestAnimationFrame(() => {
      // clearFloatingStyle 不能在 onUp() 里同步调用：那样会在这一帧同步抹掉
      // sourceEl 的抬起阴影/位置样式，但接管视觉的落地代理要等到这个 rAF 才
      // 创建——中间至少有一帧，浏览器会先画出"样式已经被清空、但代理还没
      // 顶上"的本体，表现为松手瞬间样式突然跳变、阴影没有过渡直接消失。
      // position:fixed 元素的渲染位置只认内联 left/top，不受 Teleport 换父级
      // 影响，所以拖到这里才清也不会看见位置跳动——延后清除跟延后隐藏必须
      // 在同一个 rAF 里完成，才能让"跟手样式"和"落地代理"无缝衔接。
      clearFloatingStyle(sourceEl)
      // 注意：这里不能继续用闭包里的 sourceEl。同列内重排时 Vue 确实会
      // 复用同一个节点（同一个 v-for 数组内 diff），但跨列拖拽时源列和
      // 目标列是两个独立的 v-for/TransitionGroup 实例，Vue 只能在源列里
      // 销毁旧节点、在目标列里创建一个新节点——Teleport 只能搬运"还活着
      // 的"vnode，搬不动"数组之间跳转"这件事本身。所以要重新查询一次
      // 当前真正渲染出来的节点：同列场景下查到的就是 sourceEl 本身，跨列
      // 场景下查到的是目标列刚创建的新节点——不管是哪种，用它当 FLIP 的
      // "to"，看起来都是同一个对象飞过去。
      const landedEl = runtime.resolveMoveTarget(
        session.id,
        pendingDrop,
        () => document.querySelector<HTMLElement>(`[data-card="${cardId}"]`) ?? sourceEl,
      )
      if (!landedEl) {
        landingGate?.complete({ completed: true, reason: '' })
        landingGate = null
        return
      }
      runtime.applyVisualState(cardId, landedEl, {
        phase: 'revealing',
        hovered: false,
        selected: landedEl.classList.contains('is-selected'),
        grabbed: false,
      })
      // clearFloatingStyle 刚刚移除了抓起样式，但业务 transition 可能还在
      // 播放“抓起阴影 → 普通阴影”。如果此刻直接 capture，读到的是中间帧，
      // 会把抓起阴影误记成 landing 的终点，导致 proxy 落地后一直保留深阴影。
      // 临时冻结 transition 并强制完成一次 layout，只捕获稳定的业务终态；
      // 读取后恢复原 transition，真实本体揭示时仍保留正常 hover 过渡。
      const targetTransition = landedEl.style.transition
      landedEl.dataset.runtimeLandingCapture = 'true'
      landedEl.style.transition = 'none'
      void landedEl.offsetWidth
      const targetSnapshot = runtime.captureVisualState(cardId, landedEl)
      landedEl.style.transition = targetTransition
      delete landedEl.dataset.runtimeLandingCapture
      const visualContext = {
        ...runtime.createVisualLifecycleContext(session.id, pendingDrop, landedEl, beforeContent),
        sourceElement: sourceEl,
        sourceRect: beforeRect,
        visualSnapshot: draggingSnapshot,
        targetSnapshot,
      }
      const visualProxy = runtime.createVisualProxy(session.id, visualContext)
      if (!visualProxy) {
        landingGate?.complete({ completed: false, reason: 'visual-proxy-missing' })
        landingGate = null
        return
      }
      landingProxy = visualProxy.element
      setProxyInteractive(visualProxy.element, true)
      runtime.bindRegrabTarget(session.id, cardId, visualProxy.element, onRegrab)
      void runtime.landVisualProxy(session.id, landedEl, visualContext).then(landingResult => {
        if (session.state !== 'landing') return
        landingGate?.complete({
          completed: landingResult.completed,
          reason: landingResult.reason ?? '',
          reveal: () => { void runtime.revealVisualProxy(session.id, landedEl, visualContext) },
        })
        landingGate = null
      })
    })
    return pendingDrop
  }

  runtime.orchestrateMoveSession({
    type: 'move',
    objectId: cardId,
    input: { kind: 'pointerdown', event },
  }, {
    sessionId: session.id,
    followElement: sourceEl,
    driver: createDetachMoveDriver(onMove, onUp),
    visualStrategy: {
      layout: createDetachLayoutLifecycle(sourceEl),
      ...createDetachVisualLifecycle(() => runtime.clearRegrab(cardId), () => {
        const gate = runtime.createCompletionGate(session.id, { completed: false, reason: 'landing-cancelled' })
        // 松手后立即恢复其它卡片 hover；landing 代理自身仍由视觉策略接管。
        document.body.classList.remove('kb-dragging')
        landingGate = gate
        landingPlan?.()
        landingPlan = null
        return gate.promise
      }, () => {
        if (landingProxy) setProxyInteractive(landingProxy, false)
      }),
    },
  })

  /**
   * regrab：落地飞行途中重新抓起这张卡片，起点是代理当前的插值位置。
   */
  function onRegrab(regrabEvent: PointerEvent) {
    if (session.state !== 'landing') return
    const proxy = landingProxy
    if (!proxy) return

    // 1. 先捕获视觉状态
    const liveEl = runtime.resolveVisualTarget(session.id, pendingDrop)
      ?? document.querySelector<HTMLElement>(`[data-card="${cardId}"]`)
    if (!liveEl) return
    const regrabContext = runtime.createRegrabContext(session.id, regrabEvent, proxy, liveEl)
    if (!regrabContext) return
    const proxyRect = regrabContext.proxyRect

    performDetachRegrab({
      event: regrabContext.event,
      cardId,
      sessionId: session.id,
      proxy,
      source: liveEl,
      proxyRect,
      interrupt: () => regrabContext.interrupt('regrab'),
      clearRegrab: () => runtime.clearRegrab(cardId),
      disposeProxy: () => runtime.disposeVisualProxy(session.id),
    })
  }
}
