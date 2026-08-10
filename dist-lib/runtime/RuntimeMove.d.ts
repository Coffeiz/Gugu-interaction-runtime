import { RuntimeInput, SessionHandle, StartRequest } from '../core/Interaction';
import { Session } from '../session/Session';
import { MoveBehavior, MoveVisualStrategy, MoveContext } from '../behavior/MoveBehavior';
import { Behavior, BehaviorContext } from '../behavior/Behavior';
import { Action } from '../action/Action';
import { MoveActionDestination } from '../behavior/MoveTransaction';
/** 移动事务功能域入口；Runtime 只通过该入口转发移动阶段操作。 */
export declare class RuntimeMoveCoordinator {
    private readonly updateCoordinator;
    private readonly releaseCoordinator;
    private readonly commitCoordinator;
    private readonly landingCoordinator;
    constructor(updateCoordinator: MoveUpdateCoordinator, releaseCoordinator: MoveReleaseCoordinator, commitCoordinator: MoveCommitCoordinator, landingCoordinator: MoveLandingCoordinator);
    static fromPorts(updatePort: MoveUpdatePort, commitCoordinator: MoveCommitCoordinator, landingCoordinator: MoveLandingCoordinator): RuntimeMoveCoordinator;
    update(sessionId: string, input: RuntimeInput): void;
    prepareRelease(session: Session | undefined, input: RuntimeInput): ReleasePreflight;
    commit(session: Session, behavior: MoveBehavior, destination: unknown, emitAction?: boolean): Promise<void>;
    land(session: Session, behavior: MoveBehavior, destination: unknown): Promise<void>;
    release(sessionId: string, input: RuntimeInput, port: MoveReleasePort): Promise<void>;
    private finishRelease;
    start(request: StartRequest, port: MoveStartPort): SessionHandle;
}
export interface MoveStartPort {
    getBehavior(type: string): Behavior | undefined;
    createSession(type: string, objectId: string): Session;
    getVisualStrategy(objectId: string): MoveVisualStrategy | undefined;
    bindLifecycle(sessionId: string, strategy: MoveVisualStrategy): void;
    createContext(session: Session): BehaviorContext;
    isCurrent(sessionId: string): boolean;
    cancel(sessionId: string, reason: string): void;
    interrupt(sessionId: string, reason: string): void;
}
export interface MoveReleasePort {
    getSession(sessionId: string): Session | undefined;
    getBehavior(type: string): Behavior | undefined;
    createContext(session: Session): BehaviorContext;
    captureLayout(sessionId: string): void;
    playLayout(sessionId: string, useRaf?: boolean): void;
    cancel(sessionId: string, reason: string): void;
    end(session: Session): void;
}
export interface MoveActionPort {
    getObjectSurface(objectId: string): string | undefined;
    emit(action: Action): void | Promise<void>;
}
export interface MoveUpdatePort {
    getSession(id: string): {
        type: string;
        state: string;
    } | undefined;
    getBehavior(type: string): Behavior | undefined;
    createContext(id: string): BehaviorContext;
}
export declare class MoveUpdateCoordinator {
    private readonly port;
    constructor(port: MoveUpdatePort);
    update(sessionId: string, input: RuntimeInput): void;
}
export type ReleasePreflight = {
    kind: 'cancel';
    reason: string;
} | {
    kind: 'continue';
    session: Session;
} | {
    kind: 'ignore';
};
export declare class MoveReleaseCoordinator {
    prepare(session: Session | undefined, input: RuntimeInput): ReleasePreflight;
}
export interface MoveCommitPort {
    createContext(session: Session): BehaviorContext;
    getLifecycle(id: string): import('../behavior/MoveBehavior').MoveVisualLifecycle | undefined;
    playLayout(sessionId: string, useRaf?: boolean): void;
    normalize(objectId: string, destination: unknown): MoveActionDestination | null;
    /** 目标 Surface 当前的对象数（用于列尾判定兜底：toIndex >= count 即追加）。 */
    getSurfaceObjectCount?(surfaceId: string): number;
    /** Surface 内存在非对象的布局锚点时，列尾也可能发生位移，必须即时写入 Invert。 */
    hasLayoutAnchor?(surfaceId: string): boolean;
    /**
     * 对象在目标 Surface 里真实的、按屏幕布局排序算出的索引（不依赖拖拽落点
     * 算出的 toIndex）。业务可能对目标列有自己的排序/分组规则（比如已完成列
     * 按日期分年月分组），拖拽落点算出的 toIndex 未必是卡片最终真实停留的
     * 位置——用这个量到的才是"卡片实际会不会在最后一个位置"的真相。
     */
    getObjectIndex?(objectId: string, surfaceId: string): number | undefined;
}
export declare class MoveCommitCoordinator {
    private readonly port;
    private readonly actions;
    constructor(port: MoveCommitPort, actions: MoveActionCoordinator);
    private resolveIsAppend;
    commit(session: Session, behavior: MoveBehavior, destination: unknown, emitAction?: boolean): Promise<void>;
}
export interface MoveLandingPort {
    createContext(session: Session): BehaviorContext;
    getSession(id: string): Session | undefined;
    cancel(id: string, reason: string): void;
    end(session: Session): void;
}
export declare class MoveLandingCoordinator {
    private readonly port;
    constructor(port: MoveLandingPort);
    run(session: Session, behavior: MoveBehavior, destination: unknown): Promise<void>;
}
export declare class MoveActionCoordinator {
    private readonly port;
    constructor(port: MoveActionPort);
    normalize(objectId: string, value: unknown): MoveActionDestination | null;
    emit(objectId: string, destination: unknown, transaction: MoveContext['transaction']): Promise<boolean>;
    private isDestination;
}
