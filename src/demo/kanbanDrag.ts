import { runtime } from '../Runtime'
import { createDragPlaceholder, createDragProxy, destroyAllDragProxies, destroyDragPlaceholder, destroyDragProxy, destroyDragProxiesByCardId, landDragProxy, moveDragProxy, setProxyInteractive } from '../dom/Visual'
import { preserveProxyVisualContext } from '../dom/ProxyVisualContext'
import { captureLayoutFlip, scheduleLayoutFlip } from '../dom/GroupLayout'
import { createDomHitResolver, hitWithResolver } from '../dom/Hit'
import { columns } from './store'

const LANDING_DURATION = 220
const kanbanHitResolver = createDomHitResolver({ surfaceSelector: '[data-column]', targetSelector: '[data-card]' })
runtime.setHitResolver(kanbanHitResolver)

// regrab 登记表（落地飞行期间"这个对象正在被谁接管、入口在哪"）阶段 E
// 已经搬进 Runtime/MoveBehavior 了（runtime.registerRegrab/getRegrab/
// clearRegrab），不再是这个文件自己的模块级变量——原因见那边的注释：
// 只有 proxy 自己的 pointerdown 知道这件事是不够的，startCardDrag 自己的
// 入口也要先查一下这张卡是不是正在被接管，是的话转发成一次 regrab。

function hideLiveCard(cardId: string): void {
  document.querySelectorAll<HTMLElement>(`[data-card="${cardId}"]`).forEach(el => {
    if (el.dataset.runtimeProxy === 'true') return
    el.style.visibility = 'hidden'
  })
}

function showLiveCard(cardId: string): void {
  document.querySelectorAll<HTMLElement>(`[data-card="${cardId}"]`).forEach(el => {
    if (el.dataset.runtimeProxy !== 'true') el.style.visibility = ''
  })
}

function resolveLiveCard(cardId: string): HTMLElement | null {
  return Array.from(document.querySelectorAll<HTMLElement>(`[data-card="${cardId}"]`))
    .filter(el => el.dataset.runtimeProxy !== 'true' && el.isConnected)
    .find(el => {
      const rect = el.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0
    }) ?? null
}

/**
 * 一次卡片拖拽 = 一个 Session。接管范围覆盖"这条交互会联动布局的一切"——
 * 三个列的 Surface 全部接管，而不是只接管被拖动的卡片本身，对应
 * docs/DESIGN.md 原则 2（否则会出现新模型接管卡片、旧模型还在控制列容器
 * 的混合态）。
 *
 * 落地（landing）不是瞬间发生的：松手后代理还要飞回真实卡片的位置，这段
 * 飞行期间允许被重新抓起（regrab）——这正是 Gugu-web clone2 落地中途被
 * 重新抓起那类 bug 的最小复现场景，用来验证"旧 Session 不会清理新 Session
 * 的样式"这条规则。
 */
export function startCardDrag(event: PointerEvent, cardId: string, sourceEl: HTMLElement, fromRect?: DOMRect) {
  // 对象声明了自己不能参与 'move' 类型的 Session，直接拒绝——不需要
  // 业务组件自己判断"这张卡能不能拖"，注册的时候声明一次就够了。
  if (!runtime.objects.hasAbility(cardId, 'move')) return
  event.preventDefault()
  runtime.objects.setElement(cardId, sourceEl)
  const activeRegrab = runtime.getRegrab(cardId)
  if (activeRegrab) {
    activeRegrab(event)
    return
  }
  destroyDragProxiesByCardId(cardId)
  const handle = runtime.start({
    type: 'move',
    objectId: cardId,
    input: { kind: 'pointerdown', event },
  })
  const session = runtime.getSession(handle.id)!
  const visualAdapter = runtime.getVisualAdapter(runtime.objects.get(cardId)?.type ?? 'project-card')
  // clone 策略的源卡片仍由 Vue 留在列表中（仅隐藏并由 placeholder
  // 保留布局）；只有 detach 策略才通过对象 Lease 触发 Teleport。这里
  // 不能接管 object，否则 Vue 会把源卡片搬到 body，落地目标会变成一张
  // 宽度撑满页面的异常节点。
  columns.forEach(col => session.takeSurface(`column:${col.id}`))

  // sourceElement/dragOffset 的常规算法已经在 MoveBehavior.prepare() 里
  // 统一算好了（阶段 B），这里不用重复读 DOM/算一遍——除了 regrab
  // （fromRect 存在）这一种例外：起点不是本体当前的 DOM 位置，是代理飞
  // 到一半的插值位置，这个偏移量只有这里知道，driver 自己算。
  const moveContext = runtime.getMoveContext(session.id)
  const rect = fromRect ?? sourceEl.getBoundingClientRect()
  const startX = event.clientX
  const startY = event.clientY
  const offsetX = fromRect ? startX - rect.left : moveContext.dragOffset.x
  const offsetY = fromRect ? startY - rect.top : moveContext.dragOffset.y
  // regrab 场景下真实偏移量跟 MoveBehavior.prepare() 算出来的不一样（起点
  // 是代理插值位置，不是本体当前 DOM 位置）——写回去，MoveBehavior.update()
  // 里统一做的跟手定位才会用对偏移量，不会在 regrab 时跳一下。
  moveContext.dragOffset = { x: offsetX, y: offsetY }

  sourceEl.classList.add('kb-card-dragging-source')
  sourceEl.dataset.runtimeActive = 'true'
  // 拖动期间禁用其他卡片的 hover 效果
  document.body.classList.add('kb-dragging')
  const placeholder = createDragPlaceholder(sourceEl, rect)
  sourceEl.style.display = 'none'
  const proxy = createDragProxy(sourceEl, rect)
  // proxy 被挂到 documentElement 下的 Runtime overlay 后会脱离原祖先继承链。
  // 在任何 dragging state 覆写之前先固化文本视觉上下文，避免字体、字重、
  // 行高等继承属性变化，导致字符（例如完成徽章的 ✓）与本体长得不一样。
  preserveProxyVisualContext(sourceEl, proxy)

  visualAdapter.applyState?.(proxy, {
    phase: 'dragging',
    hovered: sourceEl.matches(':hover'),
    selected: sourceEl.classList.contains('is-selected'),
    grabbed: true,
  })
  session.cleanup.track(() => destroyDragProxy(proxy))
  session.cleanup.track(() => destroyDragPlaceholder(placeholder))
  moveDragProxy(proxy, startX, startY, offsetX, offsetY)
  // 阶段 C：往后每次 pointermove 的跟手定位由 MoveBehavior.update() 统一
  // 做（通过 orchestrateMoveSession 的 followElement 选项 + dragOffset），
  // onMove 只剩命中判定。

  let currentColumnId = findColumnIdOf(cardId)
  let currentIndex = -1
  let pendingDrop: { columnId: string; index: number } | null = null
  let resolveLanding: (() => void) | null = null
  let revealPlan: (() => void) | null = null

  function findColumnIdOf(id: string) {
    return columns.find(col => col.cardIds.includes(id))?.id
  }

  function onMove(moveEvent: PointerEvent) {
    if (session.state !== 'active') return
    // 跟手定位已经在 MoveBehavior.update() 里做过了（读 followElement +
    // dragOffset），这里只做命中判定。
    const hit = hitWithResolver(runtime.getHitResolver() ?? kanbanHitResolver, moveEvent.clientX, moveEvent.clientY, cardId)
    if (!hit) return
    if (hit.columnId === currentColumnId && hit.index === currentIndex) return
    currentColumnId = hit.columnId
    currentIndex = hit.index

    pendingDrop = hit
  }

  function onUp(): { columnId: string; index: number } | null {
    if (session.state !== 'active' && session.state !== 'release') return null
    if (!pendingDrop) {
      document.body.classList.remove('kb-dragging')
      runtime.cancel(session.id, 'no-valid-drop')
      sourceEl.style.display = ''
      sourceEl.classList.remove('kb-card-dragging-source')
      delete sourceEl.dataset.runtimeActive
      showLiveCard(cardId)
      destroyDragProxy(proxy)
      return null
    }
    destroyDragPlaceholder(placeholder)
    // 同列重排时 Vue 可能复用当前 sourceEl；如果它仍是 display:none，
    // 复用后的 landing target 会得到 0×0 rect，代理就会飞到左上角。
    sourceEl.style.display = ''
    hideLiveCard(cardId)
    return pendingDrop
  }

  function beginLanding() {
    session.transition('landing')
    // 松手后代理仍继续落地，但其它真实卡片应立即恢复 hover；拖动态只
    // 屏蔽 active 阶段，不能把整段 landing 也当成拖动。
    document.body.classList.remove('kb-dragging')
    setProxyInteractive(proxy, true)
    sourceEl.classList.remove('kb-card-dragging-source')
    delete sourceEl.dataset.runtimeActive
    hideLiveCard(cardId)
    runtime.registerRegrab(cardId, onRegrab)
    requestAnimationFrame(async () => {
      const targetEl = await runtime.waitForMoveTarget(session.id, pendingDrop, () => resolveLiveCard(cardId))
      if (!targetEl || session.state !== 'landing') {
        resolveLanding?.()
        resolveLanding = null
        revealPlan = finish
        return
      }
      // 兄弟 FLIP 和 Vue 的同步更新可能在 release 后才完成；松手瞬间捕获的
      // rect 可能仍是旧布局。landing 开始时 target 已经是当前可见布局，必须
      // 以这一帧的真实 rect 为准，否则 proxy 会先吸到旧位置再回到新位置。
      const targetRect = targetEl.getBoundingClientRect()
      visualAdapter.applyState?.(targetEl, {
        phase: 'landing',
        hovered: false,
        selected: targetEl.classList.contains('is-selected'),
        grabbed: false,
      })
      const targetSnapshot = visualAdapter.captureVisualState?.(targetEl)
      const targetStyle = getComputedStyle(targetEl)
      targetEl.style.visibility = 'hidden'
      const { finished, retarget } = landDragProxy(proxy, targetRect, {
        duration: LANDING_DURATION,
        targetShadow: targetSnapshot?.boxShadow ?? targetStyle.boxShadow,
        targetRadius: targetSnapshot?.borderRadius ?? targetStyle.borderRadius,
        targetBackground: targetSnapshot?.background ?? targetStyle.backgroundColor,
        targetOpacity: targetSnapshot?.opacity ?? targetStyle.opacity,
        // 落点内容本身可能跟源不一样（比如"已完成"列多一个徽章）——纯样式
        // 插值解决不了这种真实 DOM 结构差异，交给内容交叉淡变。
        targetContent: targetEl,
      })
      // 目标和祖先链的 ResizeObserver/retarget 由 Runtime 统一登记进 Cleanup；
      // 动画正常完成时主动停止，中断/regrab 时由 Session dispose 兜底。
      const stopTargetTracking = runtime.trackLandingTarget(session.id, targetEl, retarget)
      void finished.then(() => {
        // landing 的完成必须以 proxy 的真实几何位置为准。此前独立 timer 会
        // 在 CSS transition 尚未抵达目标时提前 reveal，造成二次吸入或闪现。
        if (session.state !== 'landing') return
        resolveLanding?.()
        resolveLanding = null
        revealPlan = finish
      }).finally(stopTargetTracking)
    })
  }

  function finish() {
    if (session.state === 'done' || session.state === 'cancelled') return
    runtime.clearRegrab(cardId, onRegrab)
    setProxyInteractive(proxy, false)
    showLiveCard(cardId)
    delete sourceEl.dataset.runtimeActive
    sourceEl.style.display = ''
    destroyDragProxy(proxy)
    landing(session)
  }

  /**
   * regrab：落地飞行途中重新抓起这张卡片，起点是代理当前的插值位置。
   * 入口既可能是 proxy 自己的 pointerdown，也可能是 startCardDrag 顶部
   * 查表转发过来的（用户直接点了本体卡片）。
   */
  function onRegrab(regrabEvent: PointerEvent) {
    if (session.state !== 'landing') return
    setProxyInteractive(proxy, false)
    regrabEvent.stopPropagation()
    runtime.clearRegrab(cardId)
    // 1. 先捕获视觉状态
    const proxyRect = proxy.getBoundingClientRect()
    // 2. interrupt('regrab') — 跳过视觉 cleanup，只释放 leases
    runtime.interrupt(session.id, 'regrab')
    // 3. 手动销毁旧 proxy
    destroyDragProxy(proxy)
    // 4. 新 session 接管
    startCardDrag(regrabEvent, cardId, sourceEl, proxyRect)
  }

  runtime.orchestrateMoveSession({
    type: 'move',
    objectId: cardId,
    input: { kind: 'pointerdown', event },
  }, {
    sessionId: session.id,
    followElement: proxy,
    driver: {
      update: (_context, input) => {
        if (input.event instanceof PointerEvent) onMove(input.event)
      },
      resolveDestination: () => {
        const drop = onUp()
        return drop ? { accepted: true, destination: drop } : { accepted: false }
      },
      commit: () => {
        // onUp() 中的 emitAction + FLIP + 清理逻辑已由 resolveDestination
        // 中的 onUp() 执行完毕，commit 阶段无需额外操作。
        // 后续迁移可将 onUp() 中的业务变更逻辑移至此处。
      },
    },
    visualStrategy: {
      beforeAction: () => hideLiveCard(cardId),
      layout: {
        capture: () => captureLayoutFlip(Array.from(document.querySelectorAll<HTMLElement>('[data-card]'))
          .filter(el => el.dataset.card !== cardId && el !== proxy && el.dataset.runtimeProxy !== 'true')),
        play: (_context, snapshot) => scheduleLayoutFlip(snapshot as ReturnType<typeof captureLayoutFlip>),
      },
      landing: () => new Promise<void>(resolve => {
        resolveLanding = resolve
        beginLanding()
      }),
      reveal: () => {
        revealPlan?.()
        revealPlan = null
      },
    },
  })
  const dispatchRegrab = (event: PointerEvent) => { runtime.regrab(cardId, event) }
  proxy.addEventListener('pointerdown', dispatchRegrab)
  session.cleanup.trackTargetListener(proxy, 'pointerdown', dispatchRegrab as EventListener)
}

/**
 * 显式 handoff：业务状态已经稳定（moveCard 已经落定），下一帧再把控制权
 * 交还 Vue，避免 Vue 在恢复的这一帧又补播一次 enter/move 动画——见规则 7。
 */
function landing(session: ReturnType<typeof runtime.startSession>) {
  session.handoff()
}
