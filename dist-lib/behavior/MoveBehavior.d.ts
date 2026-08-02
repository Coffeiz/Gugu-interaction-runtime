import { Behavior, BehaviorContext } from './Behavior';
import { RuntimeInput, StartRequest } from '../core/Interaction';
import { VisualSnapshot } from '../dom/VisualAdapterTypes';
import { MoveTransaction } from './MoveTransaction';
export interface MoveContext {
    transaction: MoveTransaction;
    sourceElement: HTMLElement | null;
    dragOffset: {
        x: number;
        y: number;
    };
    followElement?: HTMLElement | null;
    visualSnapshot?: VisualSnapshot;
    destination?: unknown;
    landingStarted?: boolean;
    landingCompleted?: boolean;
    revealCommitted?: boolean;
    landingPromise?: Promise<LandingResult | void>;
    /** 由 Runtime 编排的布局快照，不包含业务数据。 */
    layoutSnapshot?: unknown;
}
export interface MoveLayoutLifecycle {
    /** 在业务 commit 前捕获兄弟节点/Surface 的布局。 */
    capture?(context: BehaviorContext): unknown;
    /** 在 commit 后播放或调度布局过渡。 */
    play?(context: BehaviorContext, snapshot: unknown, useRaf?: boolean): void;
    /** 事务取消时清理尚未播放的布局事务。 */
    cancel?(context: BehaviorContext, snapshot: unknown, reason: string): void;
}
export interface MoveSurfaceLifecycle {
    leave?(context: BehaviorContext, surfaceId: string): void | Promise<void>;
    enter?(context: BehaviorContext, surfaceId: string): void | Promise<void>;
    dispose?(context: BehaviorContext): void;
}
export interface MoveBehaviorDriver {
    prepare?(context: BehaviorContext, request: StartRequest): void | Promise<void>;
    update?(context: BehaviorContext, input: RuntimeInput): void;
    /** @deprecated 使用 resolveDestination + commit 替代。 */
    release?(context: BehaviorContext, input: RuntimeInput): MoveReleaseResult | void | Promise<MoveReleaseResult | void>;
    /**
     * 判定落点是否有效。纯函数，不修改 DOM/业务状态。
     * 返回 accepted=false 时 session 被 cancel。
     * 未实现时 fallback 到旧 release()。
     */
    resolveDestination?(context: BehaviorContext, input: RuntimeInput): MoveReleaseResult | void | Promise<MoveReleaseResult | void>;
    /**
     * 提交业务变更（emitAction + FLIP + 清理跟手样式）。
     * 在 resolveDestination 返回 accepted=true 后调用。
     * 未实现时 fallback 到旧 release()。
     */
    commit?(context: BehaviorContext, destination: unknown): void | Promise<void>;
    cancel?(context: BehaviorContext, reason: string): void;
    interrupt?(context: BehaviorContext, reason: string): void;
}
export interface MoveVisualLifecycle {
    layout?: MoveLayoutLifecycle;
    surface?: MoveSurfaceLifecycle;
    beginDrag?(context: BehaviorContext): void | Promise<void>;
    landing?(context: BehaviorContext, destination: unknown): LandingResult | void | Promise<LandingResult | void>;
    reveal?(context: BehaviorContext, destination: unknown): void | Promise<void>;
    cancel?(context: BehaviorContext, reason: string): void;
    dispose?(context: BehaviorContext): void;
}
export type MoveVisualStrategy = MoveVisualLifecycle;
export interface MoveReleaseResult {
    readonly accepted: boolean;
    readonly destination?: unknown;
    /** 无效落点的视觉回归仍走 landing，但不应提交业务 Action。 */
    readonly emitAction?: boolean;
}
export interface LandingResult {
    readonly completed: boolean;
    readonly reason?: string;
    readonly reveal?: () => void | Promise<void>;
}
export declare class MoveBehavior implements Behavior {
    private driver;
    readonly type = "move";
    private readonly sessionDrivers;
    private readonly sessionLifecycles;
    private readonly contexts;
    private readonly landingRegrabs;
    constructor(driver?: MoveBehaviorDriver);
    registerRegrab(objectId: string, handler: (event: PointerEvent) => void): void;
    getRegrab(objectId: string): ((event: PointerEvent) => void) | undefined;
    clearRegrab(objectId: string, handler?: (event: PointerEvent) => void): void;
    setDriver(driver: MoveBehaviorDriver): void;
    bindSession(sessionId: string, driver: MoveBehaviorDriver): void;
    unbindSession(sessionId: string): void;
    bindLifecycle(sessionId: string, lifecycle: MoveVisualLifecycle): void;
    getLifecycle(sessionId: string): MoveVisualLifecycle | undefined;
    captureLayout(context: BehaviorContext): void;
    playLayout(context: BehaviorContext, useRaf?: boolean): void;
    /** 列尾追加专用：等下一帧（Vue patch 落地）再量布局执行 Invert。 */
    playLayoutOnRaf(context: BehaviorContext): void;
    cancelLayout(context: BehaviorContext, reason: string): void;
    getContext(sessionId: string): MoveContext;
    private driverFor;
    prepare(context: BehaviorContext, request: StartRequest): void | Promise<void>;
    update(context: BehaviorContext, input: RuntimeInput): void;
    release(context: BehaviorContext, input: RuntimeInput): MoveReleaseResult | void | Promise<MoveReleaseResult | void>;
    commit(context: BehaviorContext, destination: unknown): void | Promise<void>;
    cancel(context: BehaviorContext, reason: string): void;
    interrupt(context: BehaviorContext, reason: string): void;
    dispose(context: BehaviorContext): void;
    landing(context: BehaviorContext, destination: unknown): LandingResult | void | Promise<LandingResult | void>;
    reveal(context: BehaviorContext, destination: unknown): void | Promise<void>;
}
