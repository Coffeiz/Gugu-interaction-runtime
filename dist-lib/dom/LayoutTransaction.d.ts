import { LayoutMeasurementContext } from './LayoutMeasurement';
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
    /**
     * Stable identity/fact stream for every geometry pass belonging to this transaction.
     * Individual capture/play LayoutMeasurement objects still own separate rect caches.
     */
    readonly measurement: LayoutMeasurementContext;
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
 * 事务拥有稳定的 measurement context，但不跨 DOM mutation 复用 rect：真正的
 * capture/play pass 仍各自创建 LayoutMeasurement。context 只把这些已经发生的
 * DOM 测量归到同一事务，并向 landing 发布精确的 geometry revision。
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
