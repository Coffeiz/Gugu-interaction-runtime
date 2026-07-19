import { runtime } from '../Runtime'
import {
  applyFloatingStyle,
  clearFloatingStyle,
  createDragProxy,
  destroyDragProxy,
  landDragProxy,
  moveFloating,
} from '../dom/Visual'
import { captureLayoutFlip, scheduleLayoutFlip } from '../dom/GroupLayout'
import { createDomHitResolver, hitWithResolver } from '../dom/Hit'
import type { VisualSnapshot } from '../dom/VisualAdapterTypes'
import { columns } from './store'

const LANDING_DURATION = 220

/**
 * detach 跟手阶段只有一个真实对象；但松手后它必须回到 Vue 的真实列表，因而
 * 会再次进入 Surface 的裁剪树。落地交接改用 Runtime overlay 中短暂存在的
 * visual proxy，本体全程由 Vue 管理且保持隐藏，动画结束后再揭示本体。
 */
function createDetachLandingVisual(
  target: HTMLElement,
  beforeRect: DOMRect,
  dragSnapshot: VisualSnapshot | undefined,
  targetSnapshot: VisualSnapshot | undefined,
  duration = LANDING_DURATION,
): { readonly finished: Promise<void>; readonly dispose: () => void } {
  const targetRect = target.getBoundingClientRect()
  const proxy = createDragProxy(target, beforeRect)
  const previousVisibility = target.style.visibility
  let disposed = false
  const dispose = () => {
    if (disposed) return
    disposed = true
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
  const finished = landDragProxy(proxy, targetRect, {
    duration,
    targetShadow: targetSnapshot?.boxShadow,
    targetRadius: targetSnapshot?.borderRadius,
    targetBackground: targetSnapshot?.background,
    targetOpacity: targetSnapshot?.opacity,
  }).finally(() => {
    dispose()
  })
  return { finished, dispose }
}
const kanbanHitResolver = createDomHitResolver({ surfaceSelector: '[data-column]', targetSelector: '[data-card]' })
runtime.setHitResolver(kanbanHitResolver)

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
export function startCardDragDetach(event: PointerEvent, cardId: string, sourceEl: HTMLElement) {
  // 对象声明了自己不能参与 'move' 类型的 Session，直接拒绝。
  if (!runtime.objects.hasAbility(cardId, 'move')) return
  event.preventDefault()
  const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-card]'))
    .filter(el => el !== sourceEl && el.dataset.runtimeProxy !== 'true')
  const beforePickup = captureLayoutFlip(cards)
  // 立即登记、下一帧播放。若这一帧内已经放下，新事务会接管此快照，
  // 不会先播一笔收束再瞬间清空。
  scheduleLayoutFlip(beforePickup)
  runtime.objects.setElement(cardId, sourceEl)
  // 如果这张卡此刻正在做落地 FLIP 回弹（transform/transition 还没播完，
  // 但已经不受 Runtime 控制），把残留的过渡状态清掉再开始新的一轮。
  sourceEl.style.transition = 'none'
  sourceEl.style.transform = ''

  const handle = runtime.start({
    type: 'move',
    objectId: cardId,
    input: { kind: 'pointerdown', event },
  })
  const session = runtime.getSession(handle.id)!
  const visualAdapter = runtime.getVisualAdapter(runtime.objects.get(cardId)?.type ?? 'project-card')
  // 对象的 Lease 单独持有（不放进 session 的 leases 数组）：落地时需要先
  // 单独释放它（触发 Teleport 把节点放回真实位置），同时继续拿着 Surface
  // 的 Lease 直到落地动画结束，让 Vue 的 TransitionGroup 全程保持关闭。
  const objectLease = runtime.owner.takeObject(cardId, session.id)
  columns.forEach(col => session.takeSurface(`column:${col.id}`))

  // sourceElement/dragOffset 的常规算法已经在 MoveBehavior.prepare() 里
  // 统一算好了（阶段 B）——detach 没有 clone 那种 regrab 特殊起点，直接用。
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
  const draggingSnapshotBase = visualAdapter.captureVisualState?.(sourceEl)
  const draggingSnapshot = draggingSnapshotBase && {
    ...draggingSnapshotBase,
    boxShadow: sourceEl.style.boxShadow || draggingSnapshotBase.boxShadow,
    transform: sourceEl.style.transform || draggingSnapshotBase.transform,
  }
  sourceEl.dataset.runtimeActive = 'true'
  moveFloating(sourceEl, startX, startY, offsetX, offsetY)
  // 阶段 C：往后每次 pointermove 的跟手定位由 MoveBehavior.update() 统一
  // 做（读这里写的 followElement + dragOffset）。detach 的跟手对象就是
  // 本体自己。
  moveContext.followElement = sourceEl
  // Teleport 会在 ownership 更新后把本体移出列表；已登记的事务会在下一帧
  // 用接管前快照补上平滑收束，或被同帧的放下事务接管。

  let currentColumnId = findColumnIdOf(cardId)
  const initialColumnId = currentColumnId
  let currentIndex = -1
  let pendingDrop: { columnId: string; index: number } | null = null
  let landingPlan: (() => void) | null = null
  let resolveLanding: (() => void) | null = null
  let revealPlan: (() => void) | null = null

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
      // 本列原位松手不是“不需要布局动画”：抓起时本体已经被 Teleport
      // 移出列表，兄弟卡正处于收束 FLIP。恢复本体前必须捕获这一帧的视觉
      // 位置，恢复后再反向 FLIP，否则旧 transform 被清空时会瞬间展开。
      const returnCards = Array.from(document.querySelectorAll<HTMLElement>('[data-card]'))
        .filter(el => el !== sourceEl && el.dataset.runtimeProxy !== 'true')
      const returnBefore = captureLayoutFlip(returnCards)
      runtime.cancel(session.id, 'no-valid-drop')
      clearFloatingStyle(sourceEl)
      delete sourceEl.dataset.runtimeActive
      objectLease.release()
      scheduleLayoutFlip(returnBefore)
      return null
    }
    const beforeRect = sourceEl.getBoundingClientRect()
    const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-card]'))
      .filter(el => el !== sourceEl && el.dataset.runtimeProxy !== 'true')
    const before = captureLayoutFlip(cards)
    // 必须在提交业务状态前登记：若 pickup 的 rAF 尚未执行，这一笔会直接
    // 替换它并继承抓起前的视觉快照。
    scheduleLayoutFlip(before)
    // 阶段 D：不直接调 moveCard，改走 Action——顺序不能变：必须在
    // objectLease.release() 之前完成，因为 Teleport 重新插入本体时读的
    // 是"此刻" columns 数据算出来的位置，emitAction 是同步的，订阅方会
    // 在这一行原地同步执行 moveCard，跟直接调用时序一致。
    if (initialColumnId) {
      runtime.emitAction({
        type: 'move',
        objectId: cardId,
        fromSurfaceId: `column:${initialColumnId}`,
        toSurfaceId: `column:${pendingDrop.columnId}`,
        toIndex: pendingDrop.index,
        timestamp: Date.now(),
      })
    }
    clearFloatingStyle(sourceEl)
    delete sourceEl.dataset.runtimeActive
    // 只放开这一个对象的 Lease：Vue 下一帧会把它摆回真实列表位置。
    // Surface 的 Lease（TransitionGroup 总闸）留到落地动画结束才一起释放。
    objectLease.release()
    landingPlan = () => requestAnimationFrame(() => {
      // 注意：这里不能继续用闭包里的 sourceEl。同列内重排时 Vue 确实会
      // 复用同一个节点（同一个 v-for 数组内 diff），但跨列拖拽时源列和
      // 目标列是两个独立的 v-for/TransitionGroup 实例，Vue 只能在源列里
      // 销毁旧节点、在目标列里创建一个新节点——Teleport 只能搬运"还活着
      // 的"vnode，搬不动"数组之间跳转"这件事本身。所以要重新查询一次
      // 当前真正渲染出来的节点：同列场景下查到的就是 sourceEl 本身，跨列
      // 场景下查到的是目标列刚创建的新节点——不管是哪种，用它当 FLIP 的
      // "to"，看起来都是同一个对象飞过去。
      const landedEl = visualAdapter.resolveTarget?.(cardId, pendingDrop)
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
        landedEl,
        beforeRect,
        draggingSnapshot,
        targetSnapshot,
      )
      session.cleanup.track(landingVisual.dispose)
      void landingVisual.finished.then(() => {
        if (session.state !== 'landing') return
        resolveLanding?.()
        resolveLanding = null
        revealPlan = () => undefined
      })
    })
    return pendingDrop
  }

  runtime.bindMoveSession(session.id, {
    update: (_context, input) => {
      if (input.event instanceof PointerEvent) onMove(input.event)
    },
    release: () => {
      // Action 已经在 onUp() 里、moveCard 原本被调用的那一行原地发出去了。
      const drop = onUp()
      return drop ? { accepted: true, destination: drop } : { accepted: false }
    },
  })
  runtime.bindMoveLifecycle(session.id, {
    landing: () => new Promise<void>(resolve => {
      resolveLanding = resolve
      landingPlan?.()
      landingPlan = null
    }),
    reveal: () => {
      revealPlan?.()
      revealPlan = null
    },
  })
  session.cleanup.trackListener(window, 'pointermove', event => {
    runtime.update(session.id, { kind: 'pointermove', event })
  })
  session.cleanup.trackListener(window, 'pointerup', event => {
    void runtime.release(session.id, { kind: 'pointerup', event })
  })
}
