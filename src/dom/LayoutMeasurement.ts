/**
 * A per-layout-transaction geometry cache.
 *
 * Layout reads are intentionally cached only for the lifetime of one capture
 * or play pass. DOM mutations must create a new cache; sharing it across
 * mutations would return stale geometry.
 */
export interface LayoutMeasurement {
  rect(element: HTMLElement): DOMRect
}

export function createLayoutMeasurement(): LayoutMeasurement {
  const cache = new WeakMap<HTMLElement, DOMRect>()
  return {
    rect(element) {
      const cached = cache.get(element)
      if (cached) return cached
      const rect = element.getBoundingClientRect()
      cache.set(element, rect)
      return rect
    },
  }
}
