import type { Surface } from './Surface'
import { Emitter } from '../core/Emitter'

export type SurfaceStoreEvent =
  | { type: 'surface-added'; id: string }
  | { type: 'surface-removed'; id: string }
  | { type: 'surface-changed'; id: string }

export class SurfaceStore {
  private items = new Map<string, Surface>()
  private readonly events = new Emitter<SurfaceStoreEvent>()

  register(surface: Surface): void {
    this.items.set(surface.id, surface)
    this.events.emit({ type: 'surface-added', id: surface.id })
  }

  unregister(id: string): boolean {
    const removed = this.items.delete(id)
    if (removed) this.events.emit({ type: 'surface-removed', id })
    return removed
  }

  get(id: string): Surface | undefined {
    return this.items.get(id)
  }

  has(id: string): boolean {
    return this.items.has(id)
  }

  values(): IterableIterator<Surface> {
    return this.items.values()
  }

  snapshot(): Surface[] {
    return [...this.items.values()]
  }

  subscribe(listener: (event: SurfaceStoreEvent) => void): () => void {
    return this.events.subscribe(listener)
  }

  setElement(id: string, element: HTMLElement | null) {
    const surface = this.items.get(id)
    if (surface && surface.element !== element) {
      surface.element = element
      this.events.emit({ type: 'surface-changed', id })
    }
  }

  /** 空 accepts 数组表示不限制类型。 */
  accepts(surfaceId: string, objectType: string): boolean {
    const surface = this.items.get(surfaceId)
    if (!surface) return false
    return surface.accepts.length === 0 || surface.accepts.includes(objectType)
  }
}
