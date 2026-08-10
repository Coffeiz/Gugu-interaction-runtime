import { Owner, Lease } from '../owner/Owner';
import { Cleanup } from '../cleanup/Cleanup';
export type SessionState = 'prepare' | 'active' | 'release' | 'landing' | 'saving' | 'handoff' | 'rollback' | 'interrupt' | 'done' | 'cancelled' | 'disposed';
export type SessionEndReason = 'cancel' | 'finish' | 'regrab';
export declare const allowedSessionTransitions: Record<SessionState, SessionState[]>;
/**
 * 一次完整交互。Session 自己声明“接管范围”——不只是被拖动的对象，还包括
 * 会被联动布局影响到的 Surface（源列、目标列）。
 */
export declare class Session {
    readonly type: string;
    readonly objectId: string;
    private owner;
    readonly id: string;
    state: SessionState;
    endReason: SessionEndReason;
    readonly cleanup: Cleanup;
    private leases;
    constructor(type: string, objectId: string, owner: Owner);
    transition(next: SessionState): void;
    /** 判断对象是否属于本次会话；GroupDragSession 会扩展为多对象判断。 */
    hasObject(objectId: string): boolean;
    takeObject(objectId: string): Lease;
    trackCleanup(dispose: () => void): void;
    takeSurface(surfaceId: string): void;
    handoff(): void;
    dispose(): void;
    cancel(): void;
    interrupt(reason?: SessionEndReason): void;
}
