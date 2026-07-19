import type { Behavior, BehaviorContext } from './Behavior'
import type { RuntimeInput, StartRequest } from '../core/Interaction'
import type { VisualSnapshot } from '../dom/VisualAdapterTypes'

/**
 * 一次移动交互的上下文——sourceElement/dragOffset/落点这些属于"移动"这
 * 一种行为特有的东西，不应该塞进通用的 Session（Session 以后还要给
 * resize/link 这些完全不碰 DOM 拖拽偏移的行为用）。挂在 MoveBehavior 自己
 * 的 Map 里，跟 sessionDrivers 同一个生命周期，session 结束就一起清空。
 *
 * 阶段 A：先把字段占位定义出来，还没有任何 driver 读写它——这一步之后
 * demo 的行为应该完全不变，纯粹是给后续阶段（把 prepare/update/release
 * 逻辑收进 MoveBehavior 本身）搭地基。
 */
export interface MoveContext {
  sourceElement: HTMLElement | null
  dragOffset: { x: number; y: number }
  /** 跟手期间实际跟着指针跑的那个元素——clone 策略是 proxy，detach 策略
   * 是本体自己。driver 在 prepare 阶段创建好视觉对象后写入这里，之后
   * 每次 pointermove 的位置更新就不用 driver 自己再算一遍。 */
  followElement?: HTMLElement | null
  /** 抓起时的视觉快照（阴影/圆角/背景/透明度），落地时用来渐变到目标样式。 */
  visualSnapshot?: VisualSnapshot
  /** 落点结果，release 阶段写入，landing/reveal 阶段读取。 */
  destination?: unknown
  landingStarted?: boolean
  landingCompleted?: boolean
  revealCommitted?: boolean
  landingPromise?: Promise<LandingResult | void>
}

export interface MoveBehaviorDriver {
  prepare?(context: BehaviorContext, request: StartRequest): void | Promise<void>
  update?(context: BehaviorContext, input: RuntimeInput): void
  release?(context: BehaviorContext, input: RuntimeInput): MoveReleaseResult | void | Promise<MoveReleaseResult | void>
  cancel?(context: BehaviorContext, reason: string): void
  interrupt?(context: BehaviorContext, reason: string): void
}

export interface MoveVisualLifecycle {
  landing?(context: BehaviorContext, destination: unknown): LandingResult | void | Promise<LandingResult | void>
  reveal?(context: BehaviorContext, destination: unknown): void | Promise<void>
}

export interface MoveReleaseResult {
  readonly accepted: boolean
  readonly destination?: unknown
}

export interface LandingResult {
  readonly completed: boolean
  readonly reason?: string
}

/**
 * 通用移动行为的生命周期适配器。它只负责把 Runtime 的行为协议转发给
 * 业务适配器，不读取 DOM、不修改 Store，也不决定 proxy/placeholder 的实现。
 */
export class MoveBehavior implements Behavior {
  readonly type = 'move'
  private readonly sessionDrivers = new Map<string, MoveBehaviorDriver>()
  private readonly sessionLifecycles = new Map<string, MoveVisualLifecycle>()
  private readonly contexts = new Map<string, MoveContext>()
  // 阶段 E（部分）：落地飞行期间"这个对象正在被重新抓起"的登记表，从
  // demo 模块作用域搬到这里——按 objectId 登记，不是 clone 专属概念（只是
  // 目前只有 clone 策略需要用它：detach 全程一个节点，不需要单独登记谁在
  // 处理 regrab，直接对节点本身再来一次 pointerdown 就够了）。挪过来是
  // 因为这本来就是 Runtime 该管的"对象生命周期中间态"，不该是某个 demo
  // 文件自己的模块级变量。
  private readonly landingRegrabs = new Map<string, (event: PointerEvent) => void>()

  constructor(private driver: MoveBehaviorDriver = {}) {}

  registerRegrab(objectId: string, handler: (event: PointerEvent) => void): void {
    this.landingRegrabs.set(objectId, handler)
  }

  getRegrab(objectId: string): ((event: PointerEvent) => void) | undefined {
    return this.landingRegrabs.get(objectId)
  }

  clearRegrab(objectId: string, handler?: (event: PointerEvent) => void): void {
    if (handler && this.landingRegrabs.get(objectId) !== handler) return
    this.landingRegrabs.delete(objectId)
  }

  setDriver(driver: MoveBehaviorDriver): void {
    this.driver = driver
  }

  bindSession(sessionId: string, driver: MoveBehaviorDriver): void {
    this.sessionDrivers.set(sessionId, driver)
  }

  unbindSession(sessionId: string): void {
    this.sessionDrivers.delete(sessionId)
    this.sessionLifecycles.delete(sessionId)
    this.contexts.delete(sessionId)
  }

  /**
   * 注册一次移动事务的视觉生命周期。输入/命中 driver 与 landing/reveal
   * 分开保存，避免 driver 在同一个对象里同时拥有业务判定和视觉收尾。
   */
  bindLifecycle(sessionId: string, lifecycle: MoveVisualLifecycle): void {
    this.sessionLifecycles.set(sessionId, lifecycle)
  }

  /** 取或建这个 Session 的移动上下文——不存在就用空值初始化一个。 */
  getContext(sessionId: string): MoveContext {
    let context = this.contexts.get(sessionId)
    if (!context) {
      context = { sourceElement: null, dragOffset: { x: 0, y: 0 } }
      this.contexts.set(sessionId, context)
    }
    return context
  }

  private driverFor(sessionId: string): MoveBehaviorDriver {
    return this.sessionDrivers.get(sessionId) ?? this.driver
  }

  prepare(context: BehaviorContext, request: StartRequest): void | Promise<void> {
    // 阶段 B：sourceElement 解析和 dragOffset 计算是 clone/detach 两条
    // driver 完全重复的代码，先在这里统一算好、写进 MoveContext，driver
    // 不用各自再读一遍 DOM/算一遍偏移。proxy/placeholder 这类"跟手时用
    // 什么视觉对象"仍然留给 driver 自己决定——clone 和 detach 在这一点
    // 上是真的不同策略，不该强行拉平。
    const moveContext = this.getContext(context.session.id)
    const sourceElement = context.visual?.resolveSource?.(request.objectId) ?? null
    moveContext.sourceElement = sourceElement
    const pointerEvent = request.input.event instanceof PointerEvent ? request.input.event : null
    if (sourceElement && pointerEvent) {
      const rect = sourceElement.getBoundingClientRect()
      moveContext.dragOffset = {
        x: pointerEvent.clientX - rect.left,
        y: pointerEvent.clientY - rect.top,
      }
    }
    return this.driverFor(context.session.id).prepare?.(context, request)
  }

  update(context: BehaviorContext, input: RuntimeInput): void {
    // 阶段 C：让"跟手对象跟着指针跑"这个纯视觉动作在这里统一做——不管
    // 这个对象是 clone 的 proxy 还是 detach 的本体自己，跟手逻辑都是同一
    // 个"指针位置减去抓起时的偏移量"，没有理由让两条 driver 各写一遍。
    // 命中判定（进了哪个 Surface、第几个位置）留给 driver：那部分需要
    // 认识具体的落点数据形状（比如看板的 columnId/index），不是这一层
    // 该管的东西。
    // pointerup 后 window 上已注册的 pointermove 可能还会补到一两帧；landing
    // 阶段绝不能再让这类事件覆写 proxy 的目标 left/top，否则动画会继续追随
    // 鼠标并最终以错误位置 reveal。跟手只属于 active 阶段。
    if (context.session.state !== 'active') return
    const moveContext = this.getContext(context.session.id)
    const pointerEvent = input.event instanceof PointerEvent ? input.event : null
    if (pointerEvent && moveContext.followElement) {
      moveContext.followElement.style.left = `${pointerEvent.clientX - moveContext.dragOffset.x}px`
      moveContext.followElement.style.top = `${pointerEvent.clientY - moveContext.dragOffset.y}px`
    }
    this.driverFor(context.session.id).update?.(context, input)
  }

  release(context: BehaviorContext, input: RuntimeInput): MoveReleaseResult | void | Promise<MoveReleaseResult | void> {
    const result = this.driverFor(context.session.id).release?.(context, input)
    return Promise.resolve(result).then(releaseResult => {
      if (releaseResult?.accepted && releaseResult.destination !== undefined) {
        this.getContext(context.session.id).destination = releaseResult.destination
      }
      return releaseResult
    })
  }

  cancel(context: BehaviorContext, reason: string): void {
    this.driverFor(context.session.id).cancel?.(context, reason)
    this.unbindSession(context.session.id)
  }

  interrupt(context: BehaviorContext, reason: string): void {
    this.driverFor(context.session.id).interrupt?.(context, reason)
    this.unbindSession(context.session.id)
  }

  landing(context: BehaviorContext, destination: unknown): LandingResult | void | Promise<LandingResult | void> {
    const moveContext = this.getContext(context.session.id)
    if (moveContext.landingStarted) {
      return moveContext.landingPromise ?? { completed: moveContext.landingCompleted === true }
    }
    moveContext.landingStarted = true
    moveContext.destination = destination
    const lifecycle = this.sessionLifecycles.get(context.session.id)
    const result = lifecycle?.landing?.(context, destination)
    const landingPromise = Promise.resolve(result).then(landingResult => {
      if (!landingResult || landingResult.completed) moveContext.landingCompleted = true
      return landingResult
    })
    moveContext.landingPromise = landingPromise
    return landingPromise
  }

  reveal(context: BehaviorContext, destination: unknown): void | Promise<void> {
    const moveContext = this.getContext(context.session.id)
    if (moveContext.revealCommitted) return
    if (moveContext.landingStarted && !moveContext.landingCompleted) return
    moveContext.revealCommitted = true
    return this.sessionLifecycles.get(context.session.id)?.reveal?.(context, destination)
  }
}
