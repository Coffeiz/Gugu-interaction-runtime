/**
 * A per-layout-transaction geometry cache.
 *
 * Layout reads are intentionally cached only for the lifetime of one capture
 * or play pass. DOM mutations must create a new cache; sharing it across
 * mutations would return stale geometry.
 */
export interface LayoutMeasurement {
    rect(element: HTMLElement): DOMRect;
}
export declare function createLayoutMeasurement(): LayoutMeasurement;
