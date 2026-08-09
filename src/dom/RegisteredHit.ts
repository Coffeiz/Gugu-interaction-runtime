import type { ObjectStore } from '../object/ObjectStore'
import type { Surface } from '../surface/Surface'
import type { SurfaceStore } from '../surface/SurfaceStore'
import { TargetStore } from '../target/TargetStore'
import type { HitPoint, HitResolver } from './Hit'

function containsRect(rect: DOMRect, point: HitPoint): boolean {
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom
}

/**
 * 由 Runtime 已登记的 Object / Surface 构建默认命中器。
 *
 * 接入方只需交出真实元素；这里不依赖看板 demo 的 data-column / data-card 选择器。
 *
 * findSurface/findIndex 都先把候选元素的 rect 一次性量好缓存下来，过滤/排序/遍历
 * 都只读这份缓存——sort 的比较器会被调用 O(n log n) 次，如果每次都现测
 * getBoundingClientRect，同一个元素在一次命中判定里会被反复强制布局，
 * pointermove 密集触发时测出来是实打实的卡顿（见 dragging jank 排查记录）。
 */
export function createRegisteredHitResolver(
  objects: ObjectStore,
  surfaces: SurfaceStore,
  targets: TargetStore,
  objectId: string,
): HitResolver<Surface, HTMLElement> {
  const object = objects.get(objectId)
  const candidates = () => surfaces.snapshot()
    .filter(surface => surface.element?.isConnected)
    .filter(surface => object ? surfaces.accepts(surface.id, object.type) : false)

  return {
    findSurface(point) {
      const semanticSurface = targets.snapshot()
        .filter(target => target.element?.isConnected)
        .filter(target => target.accepts.length === 0 || target.accepts.includes(object?.type ?? ''))
        .filter(target => containsRect(target.element!.getBoundingClientRect(), point))
        .sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0))
        .map(target => surfaces.get(target.surfaceId))
        .find((surface): surface is Surface => Boolean(surface && surfaces.accepts(surface.id, object?.type ?? '')))
      if (semanticSurface) return semanticSurface
      const measured = candidates().map(surface => ({
        surface,
        rect: surface.element!.getBoundingClientRect(),
      }))
      return measured
        .filter(({ rect }) => containsRect(rect, point))
        .sort((left, right) => (left.rect.width * left.rect.height) - (right.rect.width * right.rect.height))[0]
        ?.surface ?? null
    },
    findTarget(surface, point, excludedId) {
      const objectType = objects.get(objectId)?.type
      const semanticTarget = targets.snapshot()
        .filter(target => target.surfaceId === surface.id && target.id !== `object-target:${excludedId}`)
        .filter(target => target.accepts.length === 0 || target.accepts.includes(objectType ?? ''))
        .filter(target => target.element?.isConnected)
        .sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0))
        .find(target => containsRect(target.element!.getBoundingClientRect(), point))
      if (semanticTarget?.element) return semanticTarget.element
      return [...objects.values()]
        .filter(item => item.id !== excludedId && item.surfaceId === surface.id)
        .map(item => item.element)
        .filter((element): element is HTMLElement => Boolean(element?.isConnected))
        .find(element => containsRect(element.getBoundingClientRect(), point)) ?? null
    },
    findIndex(surface, point, excludedId) {
      const entries = [...objects.values()]
        .filter(item => item.id !== excludedId && item.surfaceId === surface.id)
        .map(item => item.element)
        .filter((element): element is HTMLElement => Boolean(element?.isConnected))
        .map(element => ({ element, rect: element.getBoundingClientRect() }))
        .sort((left, right) => left.rect.top - right.rect.top || left.rect.left - right.rect.left)
      for (let index = 0; index < entries.length; index += 1) {
        const { rect } = entries[index]
        if (point.y < rect.top + rect.height / 2) return index
      }
      return entries.length
    },
  }
}
