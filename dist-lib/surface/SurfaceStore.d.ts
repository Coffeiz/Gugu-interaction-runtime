import { Surface } from './Surface';
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
    private readonly events;
    register(surface: Surface): void;
    unregister(id: string): boolean;
    get(id: string): Surface | undefined;
    has(id: string): boolean;
    values(): IterableIterator<Surface>;
    snapshot(): Surface[];
    subscribe(listener: (event: SurfaceStoreEvent) => void): () => void;
    setElement(id: string, element: HTMLElement | null): void;
    /** 空 accepts 数组表示不限制类型。 */
    accepts(surfaceId: string, objectType: string): boolean;
}
