import { ObjectItem } from './ObjectItem';
export type ObjectStoreEvent = {
    type: 'object-added';
    id: string;
} | {
    type: 'object-removed';
    id: string;
} | {
    type: 'object-changed';
    id: string;
};
/**
 * 注册表本身是 reactive 的：Vue 模板/computed 读取 surfaceId、abilities
 * 等字段能被正常追踪到变化，不需要额外包一层 computed（跟 Owner 的
 * controlled Map 是同一个思路）。
 */
export declare class ObjectStore {
    private items;
    private readonly events;
    /** 每个 id 的注册代次计数器——register 覆盖旧 item 时递增。 */
    private generations;
    register(item: ObjectItem): number;
    unregister(id: string): boolean;
    get(id: string): ObjectItem | undefined;
    has(id: string): boolean;
    values(): IterableIterator<ObjectItem>;
    snapshot(): ObjectItem[];
    subscribe(listener: (event: ObjectStoreEvent) => void): () => void;
    hasAbility(id: string, ability: string): boolean;
    setElement(id: string, element: HTMLElement | null): void;
    setSurface(id: string, surfaceId: string): void;
}
