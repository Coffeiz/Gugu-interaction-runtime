import type { Surface, SurfaceUpdate } from './Surface'
import { Emitter } from '../core/Emitter'

export type SurfaceStoreEvent =
  | { type: 'surface-added'; id: string }
  | { type: 'surface-removed'; id: string }
  | { type: 'surface-changed'; id: string }

export class SurfaceStore {
  private items = new Map<string, Surface>()
  private generations = new Map<string, number>()
  private readonly events = new Emitter<SurfaceStoreEvent>()

  register(surface: Surface): number {
    const generation = (this.generations.get(surface.id) ?? 0) + 1
    this.generations.set(surface.id, generation)
    this.items.set(surface.id, { ...surface, generation })
    this.events.emit({ type: 'surface-added', id: surface.id })
    return generation
  }

  unregister(id: string, generation?: number): boolean {
    const current = this.items.get(id)
    if (generation !== undefined && current?.generation !== generation) return false
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

  update(id: string, patch: SurfaceUpdate): boolean {
    const surface = this.items.get(id)
    if (!surface) return false
    const changed = Object.entries(patch).some(([key, value]) => surface[key as keyof SurfaceUpdate] !== value)
    if (!changed) return true
    Object.assign(surface, patch)
    this.events.emit({ type: 'surface-changed', id })
    return true
  }

  /** 空 accepts 数组表示不限制类型。 */
  accepts(surfaceId: string, objectType: string): boolean {
    const surface = this.items.get(surfaceId)
    if (!surface) return false
    return surface.accepts.length === 0 || surface.accepts.includes(objectType)
  }
}
