import type { RuntimeInput, SessionHandle, StartRequest } from '../core/Interaction'
import type { Session } from '../session/Session'
import { MoveBehavior, type MoveVisualStrategy } from '../behavior/MoveBehavior'
import type { Behavior, BehaviorContext } from '../behavior/Behavior'
import type { Action } from '../action/Action'
import type { MoveActionDestination } from '../behavior/MoveTransaction'
import type { MoveContext } from '../behavior/MoveBehavior'

/** 移动事务功能域入口；Runtime 只通过该入口转发移动阶段操作。 */
export class RuntimeMoveCoordinator {
  constructor(
    private readonly updateCoordinator: MoveUpdateCoordinator,
    private readonly releaseCoordinator: MoveReleaseCoordinator,
    private readonly commitCoordinator: MoveCommitCoordinator,
    private readonly landingCoordinator: MoveLandingCoordinator,
  ) {}

  static fromPorts(
    updatePort: MoveUpdatePort,
    commitCoordinator: MoveCommitCoordinator,
    landingCoordinator: MoveLandingCoordinator,
  ): RuntimeMoveCoordinator {
    return new RuntimeMoveCoordinator(
      new MoveUpdateCoordinator(updatePort),
      new MoveReleaseCoordinator(),
      commitCoordinator,
      landingCoordinator,
    )
  }

  update(sessionId: string, input: RuntimeInput): void {
    this.updateCoordinator.update(sessionId, input)
  }

  prepareRelease(session: Session | undefined, input: RuntimeInput): ReleasePreflight {
    return this.releaseCoordinator.prepare(session, input)
  }

  async commit(session: Session, behavior: MoveBehavior, destination: unknown): Promise<void> {
    return this.commitCoordinator.commit(session, behavior, destination)
  }

  async land(session: Session, behavior: MoveBehavior, destination: unknown): Promise<void> {
    return this.landingCoordinator.run(session, behavior, destination)
  }

  async release(sessionId: string, input: RuntimeInput, port: MoveReleasePort): Promise<void> {
    const candidate = port.getSession(sessionId)
    const preflight = this.prepareRelease(candidate, input)
    if (preflight.kind === 'ignore') return
    if (preflight.kind === 'cancel') {
      if (candidate) port.cancel(candidate.id, preflight.reason)
      return
    }
    const session = preflight.session
    const behavior = port.getBehavior(session.type)
    if (behavior instanceof MoveBehavior) behavior.captureLayout(port.createContext(session))
    let result: unknown
    try {
      result = await behavior?.release?.(port.createContext(session), input)
    } catch (error) {
      port.cancel(session.id, error instanceof Error ? error.message : 'release-failed')
      return
    }
    if (port.getSession(session.id) !== session) return
    const releaseResult = result as { accepted?: boolean; destination?: unknown } | undefined
    if (releaseResult?.accepted === false) {
      port.cancel(session.id, 'no-valid-drop')
      return
    }
    if (session.state === 'release') session.transition('landing')
    if (!(behavior instanceof MoveBehavior)) {
      port.end(session)
      return
    }
    const destination = releaseResult?.destination
    if (destination === undefined) {
      port.cancel(session.id, 'invalid-release-result')
      return
    }
    try {
      await this.commit(session, behavior, destination)
    } catch (error) {
      port.cancel(session.id, error instanceof Error ? error.message : 'commit-failed')
      return
    }
    await this.land(session, behavior, destination)
  }

  start(request: StartRequest, port: MoveStartPort): SessionHandle {
    const behavior = port.getBehavior(request.type)
    if (!behavior) throw new Error(`Unknown interaction behavior: ${request.type}`)
    const session = port.createSession(request.type, request.objectId)
    const strategy = port.getVisualStrategy(request.objectId)
    if (strategy) port.bindLifecycle(session.id, strategy)
    const context = port.createContext(session)
    try {
      const result = behavior.prepare?.(context, request)
      console.log('[RuntimeMove.start] prepare called', { hasResult: !!result, state: session.state })
      if (result && typeof (result as { then?: unknown }).then === 'function') {
        ;(result as Promise<void>).catch(error => {
          if (port.isCurrent(session.id)) port.cancel(session.id, error instanceof Error ? error.message : 'prepare-failed')
        })
      }
    } catch (error) {
      console.log('[RuntimeMove.start] prepare error', error)
      port.cancel(session.id, error instanceof Error ? error.message : 'prepare-failed')
    }
    if (port.isCurrent(session.id) && session.state === 'prepare') session.transition('active')
    return {
      id: session.id,
      get state() { return session.state },
      cancel: reason => port.cancel(session.id, reason ?? 'cancelled'),
      interrupt: reason => port.interrupt(session.id, reason ?? 'interrupted'),
    }
  }
}

export interface MoveStartPort {
  getBehavior(type: string): Behavior | undefined
  createSession(type: string, objectId: string): Session
  getVisualStrategy(objectId: string): MoveVisualStrategy | undefined
  bindLifecycle(sessionId: string, strategy: MoveVisualStrategy): void
  createContext(session: Session): BehaviorContext
  isCurrent(sessionId: string): boolean
  cancel(sessionId: string, reason: string): void
  interrupt(sessionId: string, reason: string): void
}

export interface MoveReleasePort {
  getSession(sessionId: string): Session | undefined
  getBehavior(type: string): Behavior | undefined
  createContext(session: Session): BehaviorContext
  cancel(sessionId: string, reason: string): void
  end(session: Session): void
}

export interface MoveActionPort { getObjectSurface(objectId: string): string | undefined; emit(action: Action): void }

export interface MoveUpdatePort { getSession(id: string): { type: string; state: string } | undefined; getBehavior(type: string): Behavior | undefined; createContext(id: string): BehaviorContext }
export class MoveUpdateCoordinator {
  constructor(private readonly port: MoveUpdatePort) {}
  update(sessionId: string, input: RuntimeInput): void {
    const session = this.port.getSession(sessionId)
    if (!session || session.state !== 'active') return
    this.port.getBehavior(session.type)?.update?.(this.port.createContext(sessionId), input)
  }
}

export type ReleasePreflight = { kind: 'cancel'; reason: string } | { kind: 'continue'; session: Session } | { kind: 'ignore' }
export class MoveReleaseCoordinator {
  prepare(session: Session | undefined, input: RuntimeInput): ReleasePreflight {
    if (!session) return { kind: 'ignore' }
    if (input.kind === 'pointercancel' || input.kind === 'blur' || input.kind === 'lostpointercapture') return { kind: 'cancel', reason: input.kind }
    if (session.state === 'prepare') return { kind: 'cancel', reason: 'interaction-not-ready' }
    if (session.state === 'active') session.transition('release')
    return session.state === 'release' ? { kind: 'continue', session } : { kind: 'ignore' }
  }
}

export interface MoveCommitPort { createContext(session: Session): BehaviorContext; getLifecycle(id: string): import('../behavior/MoveBehavior').MoveVisualLifecycle | undefined; normalize(objectId: string, destination: unknown): MoveActionDestination | null }
export class MoveCommitCoordinator {
  constructor(private readonly port: MoveCommitPort, private readonly actions: MoveActionCoordinator) {}
  async commit(session: Session, behavior: MoveBehavior, destination: unknown): Promise<void> {
    const context = this.port.createContext(session)
    await behavior.commit(context, destination)
    behavior.playLayout(context)
    const lifecycle = this.port.getLifecycle(session.id)
    const normalized = this.port.normalize(session.objectId, destination)
    if (normalized) await lifecycle?.surface?.leave?.(context, normalized.fromSurfaceId)
    this.actions.emit(session.objectId, behavior.getContext(session.id).destination, behavior.getContext(session.id).transaction)
    if (normalized) await lifecycle?.surface?.enter?.(context, normalized.toSurfaceId)
  }
}

export interface MoveLandingPort { createContext(session: Session): BehaviorContext; getSession(id: string): Session | undefined; cancel(id: string, reason: string): void; end(session: Session): void }
export class MoveLandingCoordinator {
  constructor(private readonly port: MoveLandingPort) {}
  async run(session: Session, behavior: MoveBehavior, destination: unknown): Promise<void> {
    try {
      const result = await behavior.landing(this.port.createContext(session), destination)
      const live = this.port.getSession(session.id)
      if (live !== session || live.state === 'disposed' || live.state === 'interrupt') return
      if (result && !result.completed) return this.port.cancel(session.id, result.reason ?? 'landing-failed')
      result?.reveal?.()
      session.handoff()
      if (behavior.reveal) await behavior.reveal(this.port.createContext(session), destination)
      if (this.port.getSession(session.id) === session) this.port.end(session)
    } catch (error) {
      if (this.port.getSession(session.id) === session) this.port.cancel(session.id, error instanceof Error ? error.message : 'landing-failed')
    }
  }
}

export class MoveActionCoordinator {
  constructor(private readonly port: MoveActionPort) {}
  normalize(objectId: string, value: unknown): MoveActionDestination | null {
    if (this.isDestination(value)) return value
    if (!value || typeof value !== 'object') return null
    const candidate = value as { columnId?: unknown; index?: unknown }
    if (typeof candidate.columnId !== 'string') return null
    const fromSurfaceId = this.port.getObjectSurface(objectId)
    if (!fromSurfaceId) return null
    return { fromSurfaceId, toSurfaceId: candidate.columnId.startsWith('column:') ? candidate.columnId : `column:${candidate.columnId}`, ...(typeof candidate.index === 'number' ? { toIndex: candidate.index } : {}) }
  }
  emit(objectId: string, destination: unknown, transaction: MoveContext['transaction']): boolean {
    if (transaction.actionEmitted) return false
    const normalized = this.normalize(objectId, destination)
    if (!normalized) return false
    transaction.actionEmitted = true
    this.port.emit({ type: 'move', objectId, fromSurfaceId: normalized.fromSurfaceId, toSurfaceId: normalized.toSurfaceId, ...(normalized.toIndex === undefined ? {} : { toIndex: normalized.toIndex }), timestamp: Date.now() })
    return true
  }
  private isDestination(value: unknown): value is MoveActionDestination {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<MoveActionDestination>
    return typeof candidate.fromSurfaceId === 'string' && typeof candidate.toSurfaceId === 'string'
  }
}
