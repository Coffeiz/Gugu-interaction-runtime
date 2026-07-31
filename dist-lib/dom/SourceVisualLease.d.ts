export interface SourceVisualLease {
    readonly element: HTMLElement;
    readonly sessionId: string;
    /** 抓取阶段从业务布局中移出本体；可见运动只由 Runtime overlay proxy 承担。 */
    detachFromLayout(): boolean;
    /** 提交后恢复业务布局位置，但保持本体不可见，等待 proxy reveal。 */
    restoreLayoutHidden(): boolean;
    /** 完整恢复抓取前的内联样式。仅当前 owner 有效。 */
    restore(): boolean;
    isOwner(): boolean;
}
export declare function acquireSourceVisualLease(element: HTMLElement, sessionId: string): SourceVisualLease;
