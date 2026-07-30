export type Listener<T> = (event: T) => void;
/** Core 使用的最小同步事件发射器，不依赖任何 UI 框架。 */
export declare class Emitter<T> {
    private listeners;
    subscribe(listener: Listener<T>): () => void;
    emit(event: T): void;
}
