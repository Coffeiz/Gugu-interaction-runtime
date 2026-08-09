import type { TargetItem } from './Target'
import { Emitter } from '../core/Emitter'

export type TargetStoreEvent =
  | { type: 'target-added' | 'target-removed' | 'target-changed'; id: string }

/** Runtime 的语义落点注册表；Target 可以独立存在，也可以由 Object 自动拥有。 */
export class TargetStore {
  private items = new Map<string, TargetItem>()
  private readonly events = new Emitter<TargetStoreEvent>()

  register(target: TargetItem): void {
    this.items.set(target.id, { ...target })
    this.events.emit({ type: 'target-added', id: target.id })
  }

  unregister(id: string): boolean {
    const removed = this.items.delete(id)
    if (removed) this.events.emit({ type: 'target-removed', id })
    return removed
  }

  get(id: string): TargetItem | undefined {
    return this.items.get(id)
  }

  values(): IterableIterator<TargetItem> {
    return this.items.values()
  }

  snapshot(): TargetItem[] {
    return [...this.items.values()]
  }

  setElement(id: string, element: HTMLElement | null): void {
    const target = this.items.get(id)
    if (target && target.element !== element) {
      target.element = element
      this.events.emit({ type: 'target-changed', id })
    }
  }

  findForSurface(surfaceId: string, objectType?: string): TargetItem | undefined {
    return this.snapshot()
      .filter(target => target.surfaceId === surfaceId)
      .filter(target => !objectType || target.accepts.length === 0 || target.accepts.includes(objectType))
      .filter(target => target.element?.isConnected)
      .sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0))[0]
  }

  subscribe(listener: (event: TargetStoreEvent) => void): () => void {
    return this.events.subscribe(listener)
  }
}
