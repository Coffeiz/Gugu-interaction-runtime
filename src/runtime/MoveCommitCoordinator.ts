import type { BehaviorContext } from '../behavior/Behavior'
import type { MoveBehavior, MoveVisualLifecycle } from '../behavior/MoveBehavior'
import type { Session } from '../session/Session'
import type { MoveActionCoordinator } from './MoveActionCoordinator'

export interface MoveCommitPort {
  createContext(session: Session): BehaviorContext
  getLifecycle(sessionId: string): MoveVisualLifecycle | undefined
  normalize(objectId: string, destination: unknown): { fromSurfaceId: string; toSurfaceId: string; toIndex?: number } | null
}

/** release 后的业务提交与布局阶段；不负责 landing/reveal。 */
export class MoveCommitCoordinator {
  constructor(private readonly port: MoveCommitPort, private readonly actions: MoveActionCoordinator) {}

  async commit(session: Session, behavior: MoveBehavior, destination: unknown): Promise<void> {
    const context = this.port.createContext(session)
    await behavior.commit(context, destination)
    behavior.playLayout(context)
    const lifecycle = this.port.getLifecycle(session.id)
    const normalized = this.port.normalize(session.objectId, destination)
    if (normalized) await lifecycle?.surface?.leave?.(context, normalized.fromSurfaceId)
    const moveContext = behavior.getContext(session.id)
    this.actions.emit(session.objectId, moveContext.destination, moveContext.transaction)
    if (normalized) await lifecycle?.surface?.enter?.(context, normalized.toSurfaceId)
  }
}
