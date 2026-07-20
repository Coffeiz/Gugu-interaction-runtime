import type { Behavior, BehaviorContext } from './Behavior'
import type { RuntimeInput, StartRequest } from '../core/Interaction'
import type { VisualSnapshot } from '../dom/VisualAdapterTypes'

export interface MoveContext {
  sourceElement: HTMLElement | null
  dragOffset: { x: number; y: number }
  initialized?: boolean
  followElement?: HTMLElement | null
  visualSnapshot?: VisualSnapshot
  destination?: unknown
  landingStarted?: boolean
  landingCompleted?: boolean
  revealCommitted?: boolean
  landingPromise?: Promise<LandingResult | void>
}

export interface MoveBehaviorDriver {
  prepare?(context: BehaviorContext, request: StartRequest): void | Promise<void>
  /**
   * 把 pointer 输入转换成空间落点。返回 undefined 表示沿用上一次有效落点，
   * null 表示显式清空，其余值写入 MoveContext.destination。
   */
  resolveDestination?(context: BehaviorContext, input: RuntimeInput): unknown | null | undefined
  /** 命中结果已经稳定后提交 Action / 布局事务；不直接负责 landing 视觉。 */
  commit?(context: BehaviorContext, destination: unknown, input: RuntimeInput): void | Promise<void>
  /** legacy 兼容入口；存在时优先于 resolveDestination + commit。 */
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

export class MoveBehavior implements Behavior {
  readonly type = 'move'
  private readonly sessionDrivers = new Map<string, MoveBehaviorDriver>()
  private readonly sessionLifecycles = new Map<string, MoveVisualLifecycle>()
  private readonly contexts = new Map<string, MoveContext>()
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

  bindLifecycle(sessionId: string, lifecycle: MoveVisualLifecycle): void {
    this.sessionLifecycles.set(sessionId, lifecycle)
  }

  getContext(sessionId: string): MoveContext {
    let context = this.contexts.get(sessionId)
    if (!context) {
      context = { sourceElement: null, dragOffset: { x: 0, y: 0 } }
      this.contexts.set(sessionId, context)
    }
    return context
  }

  /**
   * DOM source 与抓取偏移是 start() 返回后视觉策略立即要读的同步数据；
   * driver.prepare 仍留在异步 prepare 阶段，允许调用方先绑定 session driver。
   */
  initialize(context: BehaviorContext, request: StartRequest): void {
    const moveContext = this.getContext(context.session.id)
    if (moveContext.initialized) return
    moveContext.initialized = true
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
  }

  private driverFor(sessionId: string): MoveBehaviorDriver {
    return this.sessionDrivers.get(sessionId) ?? this.driver
  }

  prepare(context: BehaviorContext, request: StartRequest): void | Promise<void> {
    this.initialize(context, request)
    return this.driverFor(context.session.id).prepare?.(context, request)
  }

  update(context: BehaviorContext, input: RuntimeInput): void {
    if (context.session.state !== 'active') return
    const moveContext = this.getContext(context.session.id)
    const pointerEvent = input.event instanceof PointerEvent ? input.event : null
    if (pointerEvent && moveContext.followElement) {
      moveContext.followElement.style.left = `${pointerEvent.clientX - moveContext.dragOffset.x}px`
      moveContext.followElement.style.top = `${pointerEvent.clientY - moveContext.dragOffset.y}px`
    }

    const driver = this.driverFor(context.session.id)
    const destination = driver.resolveDestination?.(context, input)
    if (destination === null) moveContext.destination = undefined
    else if (destination !== undefined) moveContext.destination = destination

    driver.update?.(context, input)
  }

  release(context: BehaviorContext, input: RuntimeInput): MoveReleaseResult | void | Promise<MoveReleaseResult | void> {
    const driver = this.driverFor(context.session.id)
    if (driver.release) {
      const result = driver.release(context, input)
      return Promise.resolve(result).then(releaseResult => {
        if (releaseResult?.accepted && releaseResult.destination !== undefined) {
          this.getContext(context.session.id).destination = releaseResult.destination
        }
        return releaseResult
      })
    }

    const destination = this.getContext(context.session.id).destination
    if (destination === undefined) return { accepted: false }
    return Promise.resolve(driver.commit?.(context, destination, input)).then(() => ({
      accepted: true,
      destination,
    }))
  }

  cancel(context: BehaviorContext, reason: string): void {
    this.driverFor(context.session.id).cancel?.(context, reason)
  }

  interrupt(context: BehaviorContext, reason: string): void {
    this.driverFor(context.session.id).interrupt?.(context, reason)
  }

  dispose(context: BehaviorContext): void {
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
