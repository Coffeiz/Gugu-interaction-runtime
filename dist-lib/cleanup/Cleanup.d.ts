/** 统一登记一个 Session 使用的监听器、RAF、Timer 和临时 DOM 清理函数。 */
export type Disposer = () => void;
export declare function getActiveCleanupCount(): number;
export declare class Cleanup {
    private disposers;
    private disposed;
    /** 是否已执行清理。 */
    get isDisposed(): boolean;
    track(disposer: Disposer): void;
    /**
     * 登记 Window 事件监听器。
     * 清理时自动 removeEventListener。
     */
    trackListener<K extends keyof WindowEventMap>(target: Window, type: K, listener: (event: WindowEventMap[K]) => void): void;
    /**
     * 登记任意 EventTarget 上的事件监听器。
     * 清理时自动 removeEventListener。
     */
    trackTargetListener(target: EventTarget, type: string, listener: EventListenerOrEventListenerObject, options?: AddEventListenerOptions): void;
    /** 登记 requestAnimationFrame ID，清理时自动 cancelAnimationFrame。 */
    trackRaf(id: number): void;
    /** 登记 setTimeout ID，清理时自动 clearTimeout。 */
    trackTimeout(id: number): void;
    /** 登记 setInterval ID，清理时自动 clearInterval。 */
    trackInterval(id: number): void;
    disposeAll(): void;
}
