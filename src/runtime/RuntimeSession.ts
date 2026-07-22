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

  terminate(
    session: Session,
    behavior: Behavior | undefined,
    context: BehaviorContext,
    reason: string,
    mode: 'cancel' | 'interrupt',
    cancelBehavior: (behavior: Behavior | undefined, context: BehaviorContext, reason: string) => void,
    beforeSession: (session: Session) => void,
    disposeBehavior: (behavior: Behavior | undefined, context: BehaviorContext) => void,
  ): void {
    try {
      cancelBehavior(behavior, context, reason)
    } catch (error) {
      console.error(`Behavior ${mode} failed`, error)
    } finally {
      try {
        beforeSession(session)
        if (mode === 'cancel') {
          this.sessions.cancel(session.id)
        } else {
          this.sessions.interrupt(session.id, reason === 'regrab' ? 'regrab' : 'cancel')
        }
      } finally {
        disposeBehavior(behavior, context)
      }
    }
  }
}

export { SessionCoordinator } from './SessionCoordinator'
export type { SessionCompletionGate } from './SessionCoordinator'
