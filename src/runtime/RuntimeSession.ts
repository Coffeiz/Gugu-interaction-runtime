import type { Behavior, BehaviorContext } from '../behavior/Behavior'
import type { Session } from '../session/Session'
import { SessionCoordinator } from './SessionCoordinator'

/** Session 功能域入口。 */
export class RuntimeSessionCoordinator {
  constructor(private readonly sessions: SessionCoordinator) {}

  finalize(
    session: Session,
    behavior: Behavior | undefined,
    context: BehaviorContext,
    disposeVisualProxy: (sessionId: string) => void,
    disposeBehavior: (behavior: Behavior | undefined, context: BehaviorContext) => void,
  ): void {
    try {
      this.sessions.finalize(session.id, current => disposeVisualProxy(current.id))
    } finally {
      disposeBehavior(behavior, context)
    }
  }
}

export { SessionCoordinator } from './SessionCoordinator'
export type { SessionCompletionGate } from './SessionCoordinator'
