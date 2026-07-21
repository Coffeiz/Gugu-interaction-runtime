import type { Behavior, BehaviorContext } from './Behavior'
import type { RuntimeInput, StartRequest } from '../core/Interaction'
import type { VisualSnapshot } from '../dom/VisualAdapterTypes'
import { MoveTransaction } from './MoveTransaction'

export interface MoveContext {
  transaction: MoveTransaction
  sourceElement: HTMLElement | null
  dragOffset: { x: number; y: number }
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
  update?(context: BehaviorContext, input: RuntimeInput): void
  /** @deprecated 使用 resolveDestination + commit 替代。 */
  release?(context: BehaviorContext, input: RuntimeInput): MoveReleaseResult | void | Promise<MoveReleaseResult | void>
  /**
   * 判定落点是否有效。纯函数，不修改 DOM/业务状态。
   * 返回 accepted=false 时 session 被 cancel。
   * 未实现时 fallback 到旧 release()。
   */
  resolveDestination?(context: BehaviorContext, input: RuntimeInput): MoveReleaseResult | void | Promise<MoveReleaseResult | void>
  /**
   * 提交业务变更（emitAction + FLIP + 清理跟手样式）。
   * 在 resolveDestination 返回 accepted=true 后调用。
   * 未实现时 fallback 到旧 release()。
   */
  commit?(context: BehaviorContext, destination: unknown): void | Promise<void>
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
      context = {
        transaction: new MoveTransaction(),
        sourceElement: null,
        dragOffset: { x: 0, y: 0 },
      }
      this.contexts.set(sessionId, context)
    }
    return context
  }

  private driverFor(sessionId: string): MoveBehaviorDriver {
    return this.sessionDrivers.get(sessionId) ?? this.driver
  }

  prepare(context: BehaviorContext, request: StartRequest): void | Promise<void> {
    const moveContext = this.getContext(context.session.id)
    moveContext.transaction.setPhase('prepare')
    const sourceElement = context.visual?.resolveSource?.(request.objectId) ?? null
    moveContext.sourceElement = sourceElement
    moveContext.transaction.source = sourceElement
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
    if (context.session.state !== 'active') return
    const moveContext = this.getContext(context.session.id)
    moveContext.transaction.setPhase('active')
    const pointerEvent = input.event instanceof PointerEvent ? input.event : null
    if (pointerEvent && moveContext.followElement) {
      moveContext.followElement.style.left = `${pointerEvent.clientX - moveContext.dragOffset.x}px`
      moveContext.followElement.style.top = `${pointerEvent.clientY - moveContext.dragOffset.y}px`
    }
    this.driverFor(context.session.id).update?.(context, input)
  }

  release(context: BehaviorContext, input: RuntimeInput): MoveReleaseResult | void | Promise<MoveReleaseResult | void> {
    const moveContext = this.getContext(context.session.id)
    moveContext.transaction.setPhase('release')
    const driver = this.driverFor(context.session.id)
    // 优先使用新 resolveDestination 流程
    if (driver.resolveDestination) {
      return Promise.resolve(driver.resolveDestination(context, input)).then(result => {
        if (result?.accepted && result.destination !== undefined) {
          moveContext.destination = result.destination
          moveContext.transaction.destination = result.destination
        }
        return result
      })
    }
    // fallback: 旧 release
    const result = driver.release?.(context, input)
    return Promise.resolve(result).then(releaseResult => {
      if (releaseResult?.accepted && releaseResult.destination !== undefined) {
        moveContext.destination = releaseResult.destination
        moveContext.transaction.destination = releaseResult.destination
      }
      return releaseResult
    })
  }

  commit(context: BehaviorContext, destination: unknown): void | Promise<void> {
    this.getContext(context.session.id).transaction.setPhase('landing')
    const driver = this.driverFor(context.session.id)
    if (driver.commit) {
      return driver.commit(context, destination)
    }
    // 没有 commit 实现时，旧 release 已经做了 commit 的工作，无需额外操作
  }

  cancel(context: BehaviorContext, reason: string): void {
    const transaction = this.getContext(context.session.id).transaction
    transaction.invalidate()
    transaction.setPhase('cancelled')
    this.driverFor(context.session.id).cancel?.(context, reason)
  }

  interrupt(context: BehaviorContext, reason: string): void {
    const transaction = this.getContext(context.session.id).transaction
    transaction.invalidate()
    transaction.setPhase('cancelled')
    this.driverFor(context.session.id).interrupt?.(context, reason)
  }

  dispose(context: BehaviorContext): void {
    const transaction = this.getContext(context.session.id).transaction
    if (transaction.phase !== 'cancelled') transaction.setPhase('disposed')
    this.unbindSession(context.session.id)
  }

  landing(context: BehaviorContext, destination: unknown): LandingResult | void | Promise<LandingResult | void> {
    const moveContext = this.getContext(context.session.id)
    moveContext.transaction.setPhase('landing')
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
    moveContext.transaction.setPhase('handoff')
    return this.sessionLifecycles.get(context.session.id)?.reveal?.(context, destination)
  }
}
