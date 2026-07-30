export interface HitResult {
    columnId: string;
    index: number;
}
export interface HitPoint {
    readonly x: number;
    readonly y: number;
}
export interface HitResolver<TSurface = HTMLElement, TTarget = HTMLElement> {
    findSurface(point: HitPoint): TSurface | null;
    findTarget(surface: TSurface, point: HitPoint, excludedId?: string): TTarget | null;
    findIndex(surface: TSurface, point: HitPoint, excludedId?: string): number;
}
/** 通用 DOM 命中器；业务只需替换选择器或提供自己的 resolver。 */
export declare function createDomHitResolver(options: {
    surfaceSelector: string;
    targetSelector: string;
}): HitResolver;
/**
 * 看板 demo 的 DOM 命中判定。它只读取 DOM 几何，不修改业务数组，
 * 因此 clone 和 detach 两种视觉策略可以共享同一套落点语义。
 */
export declare function hitKanbanColumn(x: number, y: number, cardId: string): HitResult | null;
export declare function hitWithResolver(resolver: HitResolver, x: number, y: number, cardId: string): HitResult | null;
