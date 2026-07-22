import type { RuntimeInput } from '../core/Interaction'
import type { MoveUpdatePort } from './MoveUpdateCoordinator'
import { MoveUpdateCoordinator } from './MoveUpdateCoordinator'

/** 移动事务功能域入口；Runtime 只通过该入口转发移动阶段操作。 */
export class RuntimeMoveCoordinator {
  constructor(private readonly updateCoordinator: MoveUpdateCoordinator) {}

  static fromUpdatePort(port: MoveUpdatePort): RuntimeMoveCoordinator {
    return new RuntimeMoveCoordinator(new MoveUpdateCoordinator(port))
  }

  update(sessionId: string, input: RuntimeInput): void {
    this.updateCoordinator.update(sessionId, input)
  }
}

export { MoveActionCoordinator } from './MoveActionCoordinator'
export { MoveUpdateCoordinator } from './MoveUpdateCoordinator'
export { MoveReleaseCoordinator } from './MoveReleaseCoordinator'
export { MoveCommitCoordinator } from './MoveCommitCoordinator'
export { MoveLandingCoordinator } from './MoveLandingCoordinator'
