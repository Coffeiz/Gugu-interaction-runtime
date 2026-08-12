export type MoveTransactionPhase = 'prepare' | 'active' | 'release' | 'landing' | 'handoff' | 'done' | 'cancelled' | 'disposed';
export interface MoveActionDestination {
    readonly fromSurfaceId: string;
    readonly toSurfaceId: string;
    readonly toIndex?: number;
    readonly point?: {
        x: number;
        y: number;
    };
    readonly releaseVelocity?: {
        x: number;
        y: number;
    };
}
/**
 * 一次移动事务的最小状态容器。
 *
 * 它只保存编排所需的数据，不负责命中、业务提交或具体动画。
 * token 在事务失效时递增，视觉策略和异步回调可据此拒绝旧结果。
 */
export declare class MoveTransaction {
    phase: MoveTransactionPhase;
    source: unknown;
    destination: unknown;
    target: unknown;
    actionEmitted: boolean;
    private tokenValue;
    get token(): number;
    setPhase(phase: MoveTransactionPhase): void;
    invalidate(): number;
    isCurrent(token: number): boolean;
}
