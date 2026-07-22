import type { RuntimeInput } from '../core/Interaction'
import type { MoveUpdatePort } from './MoveUpdateCoordinator'
import { MoveUpdateCoordinator } from './MoveUpdateCoordinator'
import type { ReleasePreflight } from './MoveReleaseCoordinator'
import { MoveReleaseCoordinator } from './MoveReleaseCoordinator'
import type { Session } from '../session/Session'

/** 移动事务功能域入口；Runtime 只通过该入口转发移动阶段操作。 */
export class RuntimeMoveCoordinator {
  constructor(
    private readonly updateCoordinator: MoveUpdateCoordinator,
    private readonly releaseCoordinator: MoveReleaseCoordinator,
  ) {}

  static fromPorts(updatePort: MoveUpdatePort): RuntimeMoveCoordinator {
    return new RuntimeMoveCoordinator(
      new MoveUpdateCoordinator(updatePort),
      new MoveReleaseCoordinator(),
    )
  }

  update(sessionId: string, input: RuntimeInput): void {
    this.updateCoordinator.update(sessionId, input)
  }

  prepareRelease(session: Session | undefined, input: RuntimeInput): ReleasePreflight {
    return this.releaseCoordinator.prepare(session, input)
  }
}

export { MoveActionCoordinator } from './MoveActionCoordinator'
export { MoveUpdateCoordinator } from './MoveUpdateCoordinator'
export { MoveReleaseCoordinator } from './MoveReleaseCoordinator'
export { MoveCommitCoordinator } from './MoveCommitCoordinator'
export { MoveLandingCoordinator } from './MoveLandingCoordinator'
