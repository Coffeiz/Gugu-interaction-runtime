import { Session } from '../session/Session';
import { Owner, Lease } from '../owner/Owner';
import { Behavior, BehaviorContext } from '../behavior/Behavior';
export interface SessionCompletionGate<T> {
    readonly promise: Promise<T>;
    complete(value: T): void;
    fail(): void;
}
/** Session 索引、Lease、Gate 与终态清理的统一功能域。 */
export declare class SessionCoordinator {
    private readonly sessions;
    private readonly completionGates;
    create(type: string, objectId: string, owner: Owner): Session;
    get(id: string): Session | undefined;
    set(session: Session): void;
    delete(id: string): void;
    addGate(sessionId: string, gate: SessionCompletionGate<unknown>): void;
    removeGate(sessionId: string, gate: SessionCompletionGate<unknown>): void;
    failGates(sessionId: string): void;
    acquireObject(sessionId: string, objectId: string): Lease | null;
    track(sessionId: string, dispose: () => void): void;
    finalize(sessionId: string, beforeDispose?: (session: Session) => void): Session | undefined;
    cancel(sessionId: string, beforeDispose?: (session: Session) => void): Session | undefined;
    interrupt(sessionId: string, reason: 'cancel' | 'regrab', beforeDispose?: (session: Session) => void): Session | undefined;
}
/** Runtime Session 终态编排入口。 */
export declare class RuntimeSessionCoordinator {
    private readonly sessions;
    constructor(sessions: SessionCoordinator);
    finalize(session: Session, behavior: Behavior | undefined, context: BehaviorContext, disposeVisualProxy: (sessionId: string) => void, disposeBehavior: (behavior: Behavior | undefined, context: BehaviorContext) => void): void;
    terminate(session: Session, behavior: Behavior | undefined, context: BehaviorContext, reason: string, mode: 'cancel' | 'interrupt', cancelBehavior: (behavior: Behavior | undefined, context: BehaviorContext, reason: string) => void, beforeSession: (session: Session) => void, disposeBehavior: (behavior: Behavior | undefined, context: BehaviorContext) => void): void;
}
