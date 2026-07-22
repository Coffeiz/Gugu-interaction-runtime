import type { RuntimeInput } from '../core/Interaction'
import type { BehaviorContext } from '../behavior/Behavior'
import type { Behavior } from '../behavior/Behavior'

export interface MoveUpdatePort {
  getSession(sessionId: string): { type: string; state: string } | undefined
  getBehavior(type: string): Behavior | undefined
  createContext(sessionId: string): BehaviorContext
}

/** active 阶段输入分发；不处理 release 或视觉生命周期。 */
export class MoveUpdateCoordinator {
  constructor(private readonly port: MoveUpdatePort) {}

  update(sessionId: string, input: RuntimeInput): void {
    const session = this.port.getSession(sessionId)
    if (!session || session.state !== 'active') return
    this.port.getBehavior(session.type)?.update?.(this.port.createContext(sessionId), input)
  }
}
