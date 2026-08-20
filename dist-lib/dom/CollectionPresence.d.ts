import { LayoutMeasurement } from './LayoutMeasurement';
export interface CollectionPresenceSnapshot {
    readonly root: ParentNode;
    readonly selector: string;
    /** key -> 所属 collection 标识（data-layout-collection 的值），不只是存不存在。 */
    readonly collectionByKey: ReadonlyMap<string, string>;
    readonly entries: ReadonlyArray<{
        key: string;
        element: HTMLElement;
        rect: {
            left: number;
            top: number;
            width: number;
            height: number;
        };
        /** Serialized lazily materialized ghost content for true exits. */
        contentHTML: string;
    }>;
    /** capture 时登记的忽略判断，play 阶段必须用同一份，否则两边判断口径不一致。 */
    readonly ignore?: (element: HTMLElement) => boolean;
    /** participant policy：不需要动画的卡片在 capture/play 两侧都不做几何解析。 */
    readonly include?: (element: HTMLElement) => boolean;
    /** capture 时按稳定 key 固化 participant 选择，避免节点重挂载后引用失效。 */
    readonly includeKeys?: ReadonlySet<string>;
    /** 只在受影响的 Surface 内比较 collection，避免扫描整个页面。 */
    readonly scopeSurfaces?: readonly HTMLElement[];
}
export interface CollectionPresenceOptions {
    readonly duration?: number;
    readonly easing?: string;
    readonly key?: (element: HTMLElement) => string;
}
export declare function captureCollectionPresence(root: ParentNode, selector: string, key?: (element: HTMLElement) => string, ignore?: (element: HTMLElement) => boolean, scopeSurfaces?: readonly HTMLElement[], measurement?: LayoutMeasurement, include?: (element: HTMLElement) => boolean): CollectionPresenceSnapshot;
export declare function playCollectionPresence(snapshot: CollectionPresenceSnapshot, options?: CollectionPresenceOptions, measurement?: LayoutMeasurement): void;
