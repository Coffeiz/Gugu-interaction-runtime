import type { RuntimeInput } from '../core/Interaction'
import type { MoveUpdatePort } from './MoveUpdateCoordinator'
import { MoveUpdateCoordinator } from './MoveUpdateCoordinator'
import type { ReleasePreflight } from './MoveReleaseCoordinator'
import { MoveReleaseCoordinator } from './MoveReleaseCoordinator'
import type { Session } from '../session/Session'
import type { MoveBehavior } from '../behavior/MoveBehavior'
import type { MoveCommitCoordinator } from './MoveCommitCoordinator'
import type { MoveLandingCoordinator } from './MoveLandingCoordinator'

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
}

export { MoveActionCoordinator } from './MoveActionCoordinator'
export { MoveUpdateCoordinator } from './MoveUpdateCoordinator'
export { MoveReleaseCoordinator } from './MoveReleaseCoordinator'
export { MoveCommitCoordinator } from './MoveCommitCoordinator'
export { MoveLandingCoordinator } from './MoveLandingCoordinator'
