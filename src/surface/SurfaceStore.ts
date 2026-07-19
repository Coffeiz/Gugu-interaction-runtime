import { reactive } from 'vue'
import type { Surface } from './Surface'

export class SurfaceStore {
  private items = reactive(new Map<string, Surface>())

  register(surface: Surface) {
    this.items.set(surface.id, surface)
  }

  unregister(id: string) {
    this.items.delete(id)
  }

  get(id: string): Surface | undefined {
    return this.items.get(id)
  }

  has(id: string): boolean {
    return this.items.has(id)
  }

  setElement(id: string, element: HTMLElement | null) {
    const surface = this.items.get(id)
    if (surface) surface.element = element
  }

  /** 空 accepts 数组表示不限制类型。 */
  accepts(surfaceId: string, objectType: string): boolean {
    const surface = this.items.get(surfaceId)
    if (!surface) return false
    return surface.accepts.length === 0 || surface.accepts.includes(objectType)
  }
}
