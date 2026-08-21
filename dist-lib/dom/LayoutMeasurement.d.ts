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
    readonly reads: number;
    readonly cacheHits: number;
}
export interface LayoutMeasurement {
    readonly context: LayoutMeasurementContext;
    readonly stats: LayoutMeasurementStats;
    rect(element: HTMLElement): DOMRect;
}
export interface LayoutGeometryRevision {
    readonly contextId: string;
    readonly sequence: number;
    readonly element: HTMLElement;
    readonly rect: DOMRect;
}
type GeometryListener = (revision: LayoutGeometryRevision) => void;
export declare class LayoutMeasurementContext {
    readonly id: string;
    private readonly latest;
    constructor(id?: string);
    publish(element: HTMLElement, rect: DOMRect): LayoutGeometryRevision;
    latestFor(element: HTMLElement): LayoutGeometryRevision | undefined;
}
export declare function createLayoutMeasurementContext(id?: string): LayoutMeasurementContext;
/**
 * Associate a document/layout root with the latest transaction context. The association is
 * intentionally kept until a newer transaction replaces it: deferred microtask/rAF FLIP
 * playback still belongs to the transaction that captured it, while every pass keeps a fresh
 * rect cache so no stale geometry is reused.
 */
export declare function bindLayoutMeasurementContext(root: ParentNode, context: LayoutMeasurementContext): void;
export declare function getLayoutMeasurementContext(root: ParentNode): LayoutMeasurementContext | undefined;
export declare function readLatestLayoutGeometry(element: HTMLElement): LayoutGeometryRevision | undefined;
export declare function subscribeLayoutGeometry(element: HTMLElement, listener: GeometryListener): () => void;
export declare function createLayoutMeasurement(context?: LayoutMeasurementContext): LayoutMeasurement;
export {};
