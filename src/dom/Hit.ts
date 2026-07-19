export interface HitResult {
  columnId: string
  index: number
}

export interface HitPoint {
  readonly x: number
  readonly y: number
}

export interface HitResolver<TSurface = HTMLElement, TTarget = HTMLElement> {
  findSurface(point: HitPoint): TSurface | null
  findTarget(surface: TSurface, point: HitPoint, excludedId?: string): TTarget | null
  findIndex(surface: TSurface, point: HitPoint, excludedId?: string): number
}

function containsPoint(element: HTMLElement, point: HitPoint): boolean {
  const rect = element.getBoundingClientRect()
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom
}

/** 通用 DOM 命中器；业务只需替换选择器或提供自己的 resolver。 */
export function createDomHitResolver(options: {
  surfaceSelector: string
  targetSelector: string
}): HitResolver {
  return {
    findSurface(point) {
      return Array.from(document.querySelectorAll<HTMLElement>(options.surfaceSelector))
        .find(element => containsPoint(element, point)) ?? null
    },
    findTarget(surface, point, excludedId) {
      return Array.from(surface.querySelectorAll<HTMLElement>(options.targetSelector))
        .filter(element => element.dataset.card !== excludedId)
        .find(element => containsPoint(element, point)) ?? null
    },
    findIndex(surface, point, excludedId) {
      const targets = Array.from(surface.querySelectorAll<HTMLElement>(options.targetSelector))
        .filter(element => element.dataset.card !== excludedId)
      for (let index = 0; index < targets.length; index += 1) {
        const rect = targets[index].getBoundingClientRect()
        if (point.y < rect.top + rect.height / 2) return index
      }
      return targets.length
    },
  }
}

/**
 * 看板 demo 的 DOM 命中判定。它只读取 DOM 几何，不修改业务数组，
 * 因此 clone 和 detach 两种视觉策略可以共享同一套落点语义。
 */
export function hitKanbanColumn(
  x: number,
  y: number,
  cardId: string,
): HitResult | null {
  const resolver = createDomHitResolver({ surfaceSelector: '[data-column]', targetSelector: '[data-card]' })
  return hitWithResolver(resolver, x, y, cardId)
}

export function hitWithResolver(
  resolver: HitResolver,
  x: number,
  y: number,
  cardId: string,
): HitResult | null {
  const columnEl = resolver.findSurface({ x, y })
  if (!columnEl) return null

  const columnId = columnEl.dataset.column
  if (!columnId) return null

  const index = resolver.findIndex(columnEl, { x, y }, cardId)
  return { columnId, index }
}
