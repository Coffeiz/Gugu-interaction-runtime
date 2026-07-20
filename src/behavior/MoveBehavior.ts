import type { Behavior, BehaviorContext } from './Behavior'
import type { RuntimeInput, StartRequest } from '../core/Interaction'
import type { VisualSnapshot } from '../dom/VisualAdapterTypes'

export interface MoveContext {
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

  private driverFor(sessionId: string): MoveBehaviorDriver {
    return this.sessionDrivers.get(sessionId) ?? this.driver
  }

  prepare(context: BehaviorContext, request: StartRequest): void | Promise<void> {
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
