import { reactive } from 'vue'
import type { ObjectItem } from './ObjectItem'

/**
 * 注册表本身是 reactive 的：Vue 模板/computed 读取 surfaceId、abilities
 * 等字段能被正常追踪到变化，不需要额外包一层 computed（跟 Owner 的
 * controlled Map 是同一个思路）。
 */
export class ObjectStore {
  private items = reactive(new Map<string, ObjectItem>())

  register(item: ObjectItem) {
    this.items.set(item.id, item)
  }

  unregister(id: string) {
    this.items.delete(id)
  }

  get(id: string): ObjectItem | undefined {
    return this.items.get(id)
  }

  has(id: string): boolean {
    return this.items.has(id)
  }

  hasAbility(id: string, ability: string): boolean {
    return this.items.get(id)?.abilities.includes(ability) ?? false
  }

  setElement(id: string, element: HTMLElement | null) {
    const item = this.items.get(id)
    if (item) item.element = element
  }

  setSurface(id: string, surfaceId: string) {
    const item = this.items.get(id)
    if (item && item.surfaceId !== surfaceId) item.surfaceId = surfaceId
  }
}
