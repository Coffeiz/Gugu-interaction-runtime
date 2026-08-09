import type { Behavior, BehaviorContext } from './Behavior'
import type { RuntimeInput, StartRequest } from '../core/Interaction'
import type { VisualSnapshot } from '../dom/VisualAdapterTypes'
import { MoveTransaction } from './MoveTransaction'

function isPromiseLike<T>(value: unknown): value is PromiseLike<T> {
  return Boolean(value && typeof (value as { then?: unknown }).then === 'function')
}

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
  /** 由 Runtime 编排的布局快照，不包含业务数据。 */
  layoutSnapshot?: unknown
}

export interface MoveLayoutLifecycle {
  /** 在业务 commit 前捕获兄弟节点/Surface 的布局。 */
  capture?(context: BehaviorContext): unknown
  /** 在 commit 后播放或调度布局过渡。 */
  play?(context: BehaviorContext, snapshot: unknown, useRaf?: boolean): void
  /** 事务取消时清理尚未播放的布局事务。 */
  cancel?(context: BehaviorContext, snapshot: unknown, reason: string): void
}

export interface MoveSurfaceLifecycle {
  leave?(context: BehaviorContext, surfaceId: string): void | Promise<void>
  enter?(context: BehaviorContext, surfaceId: string): void | Promise<void>
  dispose?(context: BehaviorContext): void
}

export interface MoveBehaviorDriver {
  prepare?(context: BehaviorContext, request: StartRequest): void | Promise<void>
  update?(context: BehaviorContext, input: RuntimeInput): void
  /**
   * 判定落点是否有效。纯函数，不修改 DOM/业务状态。
   * 返回 accepted=false 时 session 被 cancel。
   */
  resolveDestination?(context: BehaviorContext, input: RuntimeInput): MoveReleaseResult | void | Promise<MoveReleaseResult | void>
  /** 提交业务变更（emitAction + FLIP + 清理跟手样式）。 */
  commit?(context: BehaviorContext, destination: unknown): void | Promise<void>
  cancel?(context: BehaviorContext, reason: string): void
  interrupt?(context: BehaviorContext, reason: string): void
}

export interface MoveVisualLifecycle {
  layout?: MoveLayoutLifecycle
  surface?: MoveSurfaceLifecycle
  beginDrag?(context: BehaviorContext): void | Promise<void>
  landing?(context: BehaviorContext, destination: unknown): LandingResult | void | Promise<LandingResult | void>
  reveal?(context: BehaviorContext, destination: unknown): void | Promise<void>
  cancel?(context: BehaviorContext, reason: string): void
  dispose?(context: BehaviorContext): void
}

export type MoveVisualStrategy = MoveVisualLifecycle

export interface MoveReleaseResult {
  readonly accepted: boolean
  readonly destination?: unknown
  /** 无效落点的视觉回归仍走 landing，但不应提交业务 Action。 */
  readonly emitAction?: boolean
}

export interface LandingResult {
  readonly completed: boolean
  readonly reason?: string
  readonly reveal?: () => void | Promise<void>
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

  getLifecycle(sessionId: string): MoveVisualLifecycle | undefined {
    return this.sessionLifecycles.get(sessionId)
  }

  captureLayout(context: BehaviorContext): void {
    const moveContext = this.getContext(context.session.id)
    const snapshot = this.sessionLifecycles.get(context.session.id)?.layout?.capture?.(context)
    moveContext.layoutSnapshot = snapshot
  }

  playLayout(context: BehaviorContext, useRaf = false): void {
    const moveContext = this.getContext(context.session.id)
    const lifecycle = this.sessionLifecycles.get(context.session.id)
    if (moveContext.layoutSnapshot !== undefined) {
      lifecycle?.layout?.play?.(context, moveContext.layoutSnapshot, useRaf)
    }
  }

  /** 列尾追加专用：等下一帧（Vue patch 落地）再量布局执行 Invert。 */
  playLayoutOnRaf(context: BehaviorContext): void {
    this.playLayout(context, true)
  }

  cancelLayout(context: BehaviorContext, reason: string): void {
    const moveContext = this.getContext(context.session.id)
    const snapshot = moveContext.layoutSnapshot
    if (snapshot !== undefined) {
      this.sessionLifecycles.get(context.session.id)?.layout?.cancel?.(context, snapshot, reason)
    }
    moveContext.layoutSnapshot = undefined
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
    const result = this.driverFor(context.session.id).prepare?.(context, request)
    const lifecycle = this.sessionLifecycles.get(context.session.id)
    if (result && typeof (result as { then?: unknown }).then === 'function') {
      return Promise.resolve(result).then(async () => lifecycle?.beginDrag?.(context))
    }
    return lifecycle?.beginDrag?.(context)
  }

  update(context: BehaviorContext, input: RuntimeInput): void {
    if (context.session.state !== 'active') return
    const moveContext = this.getContext(context.session.id)
    moveContext.transaction.setPhase('active')
    const pointerEvent = input.event instanceof PointerEvent ? input.event : null
    // 先让行为读取命中结果，再写入跟手节点的 left/top。命中解析可能读取
    // Surface/Card 的几何；把 DOM 写入放在前面会在同一 pointer frame 内强制
    // 浏览器同步布局，拖动越快越容易放大成整列重排。
    this.driverFor(context.session.id).update?.(context, input)
    if (pointerEvent && moveContext.followElement) {
      moveContext.followElement.style.left = `${pointerEvent.clientX - moveContext.dragOffset.x}px`
      moveContext.followElement.style.top = `${pointerEvent.clientY - moveContext.dragOffset.y}px`
    }
  }

  release(context: BehaviorContext, input: RuntimeInput): MoveReleaseResult | void | Promise<MoveReleaseResult | void> {
    const moveContext = this.getContext(context.session.id)
    moveContext.transaction.setPhase('release')
    const driver = this.driverFor(context.session.id)
    const result = driver.resolveDestination?.(context, input)
    if (isPromiseLike<MoveReleaseResult | void>(result)) {
      return result.then((releaseResult: MoveReleaseResult | void) => {
        if (releaseResult && releaseResult.accepted && releaseResult.destination !== undefined) {
          moveContext.destination = releaseResult.destination
          moveContext.transaction.destination = releaseResult.destination
        }
        return releaseResult
      })
    }
    if (result && result.accepted && result.destination !== undefined) {
      moveContext.destination = result.destination
      moveContext.transaction.destination = result.destination
    }
    return result
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
    this.sessionLifecycles.get(context.session.id)?.cancel?.(context, reason)
    this.driverFor(context.session.id).cancel?.(context, reason)
  }

  interrupt(context: BehaviorContext, reason: string): void {
    const transaction = this.getContext(context.session.id).transaction
    transaction.invalidate()
    transaction.setPhase('cancelled')
    this.sessionLifecycles.get(context.session.id)?.cancel?.(context, reason)
    this.driverFor(context.session.id).interrupt?.(context, reason)
  }

  dispose(context: BehaviorContext): void {
    const transaction = this.getContext(context.session.id).transaction
    if (transaction.phase !== 'cancelled') transaction.setPhase('disposed')
    this.sessionLifecycles.get(context.session.id)?.dispose?.(context)
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
