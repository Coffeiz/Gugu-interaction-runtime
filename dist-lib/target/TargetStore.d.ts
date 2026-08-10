import { TargetItem, TargetUpdate } from './Target';
export type TargetStoreEvent = {
    type: 'target-added' | 'target-removed' | 'target-changed';
    id: string;
};
/** Runtime 的语义落点注册表；Target 可以独立存在，也可以由 Object 自动拥有。 */
export declare class TargetStore {
    private items;
    private generations;
    private readonly events;
    register(target: TargetItem): number;
    unregister(id: string, generation?: number): boolean;
    get(id: string): TargetItem | undefined;
    values(): IterableIterator<TargetItem>;
    snapshot(): TargetItem[];
    setElement(id: string, element: HTMLElement | null): void;
    update(id: string, patch: TargetUpdate): boolean;
    findForSurface(surfaceId: string, objectType?: string): TargetItem | undefined;
    subscribe(listener: (event: TargetStoreEvent) => void): () => void;
}
