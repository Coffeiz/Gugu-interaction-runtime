import type { ObjectItem } from './ObjectItem'
import { Emitter } from '../core/Emitter'

export type ObjectStoreEvent =
  | { type: 'object-added'; id: string }
  | { type: 'object-removed'; id: string }
  | { type: 'object-changed'; id: string }

/**
 * 注册表本身是 reactive 的：Vue 模板/computed 读取 surfaceId、abilities
 * 等字段能被正常追踪到变化，不需要额外包一层 computed（跟 Owner 的
 * controlled Map 是同一个思路）。
 */
export class ObjectStore {
  private items = new Map<string, ObjectItem>()
  private readonly events = new Emitter<ObjectStoreEvent>()
  /** 每个 id 的注册代次计数器——register 覆盖旧 item 时递增。 */
  private generations = new Map<string, number>()

  register(item: ObjectItem): number {
    const generation = (this.generations.get(item.id) ?? 0) + 1
    this.generations.set(item.id, generation)
    this.items.set(item.id, { ...item, generation })
    this.events.emit({ type: 'object-added', id: item.id })
    return generation
  }

  unregister(id: string): boolean {
    const removed = this.items.delete(id)
    if (removed) this.events.emit({ type: 'object-removed', id })
    return removed
  }

  get(id: string): ObjectItem | undefined {
    return this.items.get(id)
  }

  has(id: string): boolean {
    return this.items.has(id)
  }

  values(): IterableIterator<ObjectItem> {
    return this.items.values()
  }

  snapshot(): ObjectItem[] {
    return [...this.items.values()]
  }

  subscribe(listener: (event: ObjectStoreEvent) => void): () => void {
    return this.events.subscribe(listener)
  }

  hasAbility(id: string, ability: string): boolean {
    return this.items.get(id)?.abilities.includes(ability) ?? false
  }

  setElement(id: string, element: HTMLElement | null) {
    const item = this.items.get(id)
    if (item && item.element !== element) {
      item.element = element
      this.events.emit({ type: 'object-changed', id })
    }
  }

  setSurface(id: string, surfaceId: string) {
    const item = this.items.get(id)
    if (item && item.surfaceId !== surfaceId) {
      item.surfaceId = surfaceId
      this.events.emit({ type: 'object-changed', id })
    }
  }
}
