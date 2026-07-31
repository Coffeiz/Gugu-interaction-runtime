import type { ObjectStore } from '../object/ObjectStore'
import type { Surface } from '../surface/Surface'
import type { SurfaceStore } from '../surface/SurfaceStore'
import type { HitPoint, HitResolver } from './Hit'

function containsPoint(element: HTMLElement, point: HitPoint): boolean {
  const rect = element.getBoundingClientRect()
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom
}

function area(surface: Surface): number {
  const rect = surface.element?.getBoundingClientRect()
  return rect ? rect.width * rect.height : Number.POSITIVE_INFINITY
}

/**
 * 由 Runtime 已登记的 Object / Surface 构建默认命中器。
 *
 * 接入方只需交出真实元素；这里不依赖看板 demo 的 data-column / data-card 选择器。
 */
export function createRegisteredHitResolver(
  objects: ObjectStore,
  surfaces: SurfaceStore,
  objectId: string,
): HitResolver<Surface, HTMLElement> {
  const object = objects.get(objectId)
  const candidates = () => surfaces.snapshot()
    .filter(surface => surface.element?.isConnected)
    .filter(surface => object ? surfaces.accepts(surface.id, object.type) : false)

  return {
    findSurface(point) {
      return candidates()
        .filter(surface => containsPoint(surface.element!, point))
        .sort((left, right) => area(left) - area(right))[0] ?? null
    },
    findTarget(surface, point, excludedId) {
      return [...objects.values()]
        .filter(item => item.id !== excludedId && item.surfaceId === surface.id)
        .map(item => item.element)
        .filter((element): element is HTMLElement => Boolean(element?.isConnected))
        .find(element => containsPoint(element, point)) ?? null
    },
    findIndex(surface, point, excludedId) {
      const entries = [...objects.values()]
        .filter(item => item.id !== excludedId && item.surfaceId === surface.id)
        .map(item => item.element)
        .filter((element): element is HTMLElement => Boolean(element?.isConnected))
        .sort((left, right) => {
          const leftRect = left.getBoundingClientRect()
          const rightRect = right.getBoundingClientRect()
          return leftRect.top - rightRect.top || leftRect.left - rightRect.left
        })
      for (let index = 0; index < entries.length; index += 1) {
        const rect = entries[index].getBoundingClientRect()
        if (point.y < rect.top + rect.height / 2) return index
      }
      return entries.length
    },
  }
}
