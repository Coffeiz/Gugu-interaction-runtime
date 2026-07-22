import type { RuntimeInput, SessionHandle, StartRequest } from '../core/Interaction'
import type { MoveUpdatePort } from './MoveUpdateCoordinator'
import { MoveUpdateCoordinator } from './MoveUpdateCoordinator'
import type { ReleasePreflight } from './MoveReleaseCoordinator'
import { MoveReleaseCoordinator } from './MoveReleaseCoordinator'
import type { Session } from '../session/Session'
import type { MoveBehavior } from '../behavior/MoveBehavior'
import type { MoveCommitCoordinator } from './MoveCommitCoordinator'
import type { MoveLandingCoordinator } from './MoveLandingCoordinator'
import type { Behavior, BehaviorContext } from '../behavior/Behavior'

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

  start(request: StartRequest, port: MoveStartPort): SessionHandle {
    const behavior = port.getBehavior(request.type)
    if (!behavior) throw new Error(`Unknown interaction behavior: ${request.type}`)
    const session = port.createSession(request.type, request.objectId)
    const strategy = port.getVisualStrategy(request.objectId)
    if (strategy) port.bindLifecycle(session.id, strategy)
    const context = port.createContext(session)
    try {
      const result = behavior.prepare?.(context, request)
      if (result && typeof (result as { then?: unknown }).then === 'function') {
        ;(result as Promise<void>).catch(error => {
          if (port.isCurrent(session.id)) port.cancel(session.id, error instanceof Error ? error.message : 'prepare-failed')
        })
      }
    } catch (error) {
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
  getVisualStrategy(objectId: string): import('../behavior/MoveBehavior').MoveVisualStrategy | undefined
  bindLifecycle(sessionId: string, strategy: import('../behavior/MoveBehavior').MoveVisualStrategy): void
  createContext(session: Session): BehaviorContext
  isCurrent(sessionId: string): boolean
  cancel(sessionId: string, reason: string): void
  interrupt(sessionId: string, reason: string): void
}

export { MoveActionCoordinator } from './MoveActionCoordinator'
export { MoveUpdateCoordinator } from './MoveUpdateCoordinator'
export { MoveReleaseCoordinator } from './MoveReleaseCoordinator'
export { MoveCommitCoordinator } from './MoveCommitCoordinator'
export { MoveLandingCoordinator } from './MoveLandingCoordinator'
