export type Listener<T> = (event: T) => void | Promise<void>;
/** Core 使用的最小同步事件发射器，不依赖任何 UI 框架。 */
export declare class Emitter<T> {
    private listeners;
    subscribe(listener: Listener<T>): () => void;
    emit(event: T): void;
    /**
     * 与同步广播保持并存的事务广播。业务可以返回框架渲染完成的 Promise，
     * 让调用方在读取新 DOM 前等待；没有返回值的既有订阅仍然是同步兼容的。
     */
    emitAsync(event: T): Promise<void>;
}
