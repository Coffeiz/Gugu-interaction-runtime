import type { Action } from '../action/Action'
import type { MoveActionDestination } from '../behavior/MoveTransaction'
import type { MoveContext } from '../behavior/MoveBehavior'

export interface MoveActionPort {
  getObjectSurface(objectId: string): string | undefined
  emit(action: Action): void
}

/** 统一移动目标规范化与 Action 去重提交。 */
export class MoveActionCoordinator {
  constructor(private readonly port: MoveActionPort) {}

  normalize(objectId: string, value: unknown): MoveActionDestination | null {
    if (this.isDestination(value)) return value
    if (!value || typeof value !== 'object') return null
    const candidate = value as { columnId?: unknown; index?: unknown }
    if (typeof candidate.columnId !== 'string') return null
    const fromSurfaceId = this.port.getObjectSurface(objectId)
    if (!fromSurfaceId) return null
    return {
      fromSurfaceId,
      toSurfaceId: candidate.columnId.startsWith('column:')
        ? candidate.columnId : `column:${candidate.columnId}`,
      ...(typeof candidate.index === 'number' ? { toIndex: candidate.index } : {}),
    }
  }

  emit(objectId: string, destination: unknown, transaction: MoveContext['transaction']): boolean {
    if (transaction.actionEmitted) return false
    const normalized = this.normalize(objectId, destination)
    if (!normalized) return false
    transaction.actionEmitted = true
    this.port.emit({
      type: 'move', objectId,
      fromSurfaceId: normalized.fromSurfaceId,
      toSurfaceId: normalized.toSurfaceId,
      ...(normalized.toIndex === undefined ? {} : { toIndex: normalized.toIndex }),
      timestamp: Date.now(),
    })
    return true
  }

  private isDestination(value: unknown): value is MoveActionDestination {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<MoveActionDestination>
    return typeof candidate.fromSurfaceId === 'string' && typeof candidate.toSurfaceId === 'string'
  }
}
