/**
 * A per-layout-pass geometry cache plus a transaction-scoped geometry fact stream.
 *
 * Rect values are NEVER reused across passes: every createLayoutMeasurement() call owns a
 * fresh WeakMap because capture/play are separated by DOM mutations. The optional context
 * only gives all passes in the same layout transaction a stable identity and publishes the
 * fresh measurements that Runtime already had to perform. Landing can subscribe to those
 * facts instead of polling the DOM again.
 */
export interface LayoutMeasurementStats {
  readonly reads: number
  readonly cacheHits: number
}

export interface LayoutMeasurement {
  readonly context: LayoutMeasurementContext
  readonly stats: LayoutMeasurementStats
  rect(element: HTMLElement): DOMRect
}

export interface LayoutGeometryRevision {
  readonly contextId: string
  readonly sequence: number
  readonly element: HTMLElement
  readonly rect: DOMRect
}

type GeometryListener = (revision: LayoutGeometryRevision) => void

let contextSequence = 0
let geometrySequence = 0
const contextByRoot = new WeakMap<ParentNode, LayoutMeasurementContext>()
const latestGeometry = new WeakMap<HTMLElement, LayoutGeometryRevision>()
const geometryListeners = new WeakMap<HTMLElement, Set<GeometryListener>>()

function copyRect(rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>): DOMRect {
  return new DOMRect(rect.left, rect.top, rect.width, rect.height)
}

function resolveRoot(element: HTMLElement): ParentNode {
  const root = element.getRootNode()
  return root instanceof Document || root instanceof ShadowRoot ? root : element.ownerDocument
}

export class LayoutMeasurementContext {
  readonly id: string
  private readonly latest = new WeakMap<HTMLElement, LayoutGeometryRevision>()

  constructor(id = `layout-measurement-${++contextSequence}`) {
    this.id = id
  }

  publish(element: HTMLElement, rect: DOMRect): LayoutGeometryRevision {
    const revision: LayoutGeometryRevision = {
      contextId: this.id,
      sequence: ++geometrySequence,
      element,
      rect: copyRect(rect),
    }
    this.latest.set(element, revision)
    latestGeometry.set(element, revision)
    const listeners = geometryListeners.get(element)
    if (listeners) {
      // Snapshot the listeners: a landing cleanup may unsubscribe itself while handling a
      // revision and must not disturb delivery to other sessions watching the same target.
      for (const listener of [...listeners]) listener(revision)
    }
    return revision
  }

  latestFor(element: HTMLElement): LayoutGeometryRevision | undefined {
    return this.latest.get(element)
  }
}

export function createLayoutMeasurementContext(id?: string): LayoutMeasurementContext {
  return new LayoutMeasurementContext(id)
}

/**
 * Associate a document/layout root with the latest transaction context. The association is
 * intentionally kept until a newer transaction replaces it: deferred microtask/rAF FLIP
 * playback still belongs to the transaction that captured it, while every pass keeps a fresh
 * rect cache so no stale geometry is reused.
 */
export function bindLayoutMeasurementContext(root: ParentNode, context: LayoutMeasurementContext): void {
  contextByRoot.set(root, context)
}

export function getLayoutMeasurementContext(root: ParentNode): LayoutMeasurementContext | undefined {
  return contextByRoot.get(root)
}

export function readLatestLayoutGeometry(element: HTMLElement): LayoutGeometryRevision | undefined {
  return latestGeometry.get(element)
}

export function subscribeLayoutGeometry(element: HTMLElement, listener: GeometryListener): () => void {
  let listeners = geometryListeners.get(element)
  if (!listeners) {
    listeners = new Set()
    geometryListeners.set(element, listeners)
  }
  listeners.add(listener)
  return () => {
    const current = geometryListeners.get(element)
    if (!current) return
    current.delete(listener)
    if (current.size === 0) geometryListeners.delete(element)
  }
}

export function createLayoutMeasurement(context?: LayoutMeasurementContext): LayoutMeasurement {
  const cache = new WeakMap<HTMLElement, DOMRect>()
  let resolvedContext = context
  let reads = 0
  let cacheHits = 0
  return {
    get context() {
      return resolvedContext ??= createLayoutMeasurementContext()
    },
    get stats() {
      return { reads, cacheHits }
    },
    rect(element) {
      const cached = cache.get(element)
      if (cached) {
        cacheHits += 1
        return cached
      }
      const rect = element.getBoundingClientRect()
      reads += 1
      cache.set(element, rect)
      // When a LayoutTransactionCoordinator has bound a context for this root, attach the
      // pass to that transaction. Standalone pickup/return FLIP gets its own context instead.
      resolvedContext ??= contextByRoot.get(resolveRoot(element)) ?? createLayoutMeasurementContext()
      resolvedContext.publish(element, rect)
      return rect
    },
  }
}
