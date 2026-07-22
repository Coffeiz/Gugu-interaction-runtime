import type { RuntimeInput } from '../core/Interaction'
import type { Session } from '../session/Session'

export type ReleasePreflight =
  | { kind: 'cancel'; reason: string }
  | { kind: 'continue'; session: Session }
  | { kind: 'ignore' }

/** release 主链的状态前置判断；不执行业务提交或视觉动画。 */
export class MoveReleaseCoordinator {
  prepare(session: Session | undefined, input: RuntimeInput): ReleasePreflight {
    if (!session) return { kind: 'ignore' }
    if (input.kind === 'pointercancel' || input.kind === 'blur' || input.kind === 'lostpointercapture') {
      return { kind: 'cancel', reason: input.kind }
    }
    if (session.state === 'prepare') return { kind: 'cancel', reason: 'interaction-not-ready' }
    if (session.state === 'active') session.transition('release')
    if (session.state !== 'release') return { kind: 'ignore' }
    return { kind: 'continue', session }
  }
}
