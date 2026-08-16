export type LayoutTransactionReason = 'move' | 'group-toggle' | 'surface-observer';
export type LayoutTransactionPriority = 'observer' | 'interaction';
export interface LayoutMutation {
    readonly type: string;
    readonly [key: string]: unknown;
}
export interface LayoutTransactionSnapshot {
    readonly id: string;
    readonly participantId: string;
    readonly root: ParentNode;
    readonly reasons: readonly LayoutTransactionReason[];
    readonly priority: LayoutTransactionPriority;
    readonly mutations: readonly LayoutMutation[];
    readonly plans: readonly LayoutPlanSnapshot[];
}
export type LayoutPlanStatus = 'queued' | 'running' | 'completed' | 'cancelled' | 'failed';
export interface LayoutPlanSnapshot {
    readonly id: string;
    readonly transactionId: string;
    readonly participantId: string;
    readonly type: string;
    readonly status: LayoutPlanStatus;
}
export interface LayoutPlan {
    readonly id: string;
    readonly transactionId: string;
    readonly participantId: string;
    readonly type: string;
    status: LayoutPlanStatus;
    readonly isCurrent: () => boolean;
    readonly run: (plan: LayoutPlan) => void;
}
/**
 * 同一布局根节点的事务收集器。
 *
 * Phase 1 只负责收集和合并，不负责 DOM 测量或动画播放；后续组切换、落地
 * 和 Surface observer 都通过这里共享事务边界，再由统一提交器执行布局。
 */
export declare class LayoutTransactionCoordinator {
    private sequence;
    private participantSequence;
    private planSequence;
    private readonly active;
    private readonly latestTransaction;
    begin(root: ParentNode, reason: LayoutTransactionReason, priority?: LayoutTransactionPriority): LayoutTransactionSnapshot;
    request(root: ParentNode, mutation: LayoutMutation): LayoutTransactionSnapshot;
    commit(root: ParentNode, participantId?: string): LayoutTransactionSnapshot | null;
    cancel(root: ParentNode, participantId?: string): LayoutTransactionSnapshot | null;
    isActive(root: ParentNode): boolean;
    getSnapshot(root: ParentNode): LayoutTransactionSnapshot | null;
    defer(root: ParentNode, participantId: string, plan: (plan: LayoutPlan) => void, type?: string): LayoutPlan | null;
    private mergeReason;
    private finalizeIfComplete;
    private snapshot;
}
