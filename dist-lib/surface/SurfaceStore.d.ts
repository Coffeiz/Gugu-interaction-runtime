import { Surface, SurfaceUpdate } from './Surface';
export type SurfaceStoreEvent = {
    type: 'surface-added';
    id: string;
} | {
    type: 'surface-removed';
    id: string;
} | {
    type: 'surface-changed';
    id: string;
};
export declare class SurfaceStore {
    private items;
    private generations;
    private readonly events;
    register(surface: Surface): number;
    unregister(id: string, generation?: number): boolean;
    get(id: string): Surface | undefined;
    has(id: string): boolean;
    values(): IterableIterator<Surface>;
    snapshot(): Surface[];
    subscribe(listener: (event: SurfaceStoreEvent) => void): () => void;
    setElement(id: string, element: HTMLElement | null): void;
    update(id: string, patch: SurfaceUpdate): boolean;
    /** 空 accepts 数组表示不限制类型。 */
    accepts(surfaceId: string, objectType: string): boolean;
}
