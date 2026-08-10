import type { ObjectItem, ObjectUpdate } from './ObjectItem'
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

  unregister(id: string, generation?: number): boolean {
    const current = this.items.get(id)
    if (generation !== undefined && current?.generation !== generation) return false
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
    this.update(id, { surfaceId })
  }

  update(id: string, patch: ObjectUpdate): boolean {
    const item = this.items.get(id)
    if (!item) return false
    const changed = Object.entries(patch).some(([key, value]) => item[key as keyof ObjectUpdate] !== value)
    if (!changed) return true
    Object.assign(item, patch)
    this.events.emit({ type: 'object-changed', id })
    return true
  }
}
