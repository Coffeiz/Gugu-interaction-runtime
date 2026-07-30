import { ObjectStore } from '../object/ObjectStore';
import { RuntimeRegistry } from './RuntimeRegistry';
import { Session } from '../session/Session';
import { PointerSessionInputOptions } from '../input/PointerSessionInput';
import { RuntimeInput, SessionHandle, StartRequest } from '../core/Interaction';
export interface RuntimeInputPort {
    objects: ObjectStore;
    registry: RuntimeRegistry;
    startObjectPointer(objectId: string, element: HTMLElement, event: PointerEvent): boolean;
    registerRegrab(objectId: string, handler: (event: PointerEvent) => void): void;
    regrab(objectId: string, event: PointerEvent): boolean;
    update(sessionId: string, input: RuntimeInput): void;
    release(sessionId: string, input: RuntimeInput): void | Promise<void>;
}
/** 输入功能域；负责对象 DOM 绑定。 */
export declare class RuntimeInputCoordinator {
    private readonly port;
    private readonly bindings;
    private readonly disposers;
    constructor(port: RuntimeInputPort);
    bind(objectId: string, element: HTMLElement): () => void;
    sync(objectId: string): void;
    remove(objectId: string): void;
    bindRegrabTarget(session: Session, objectId: string, target: HTMLElement, handler: (event: PointerEvent) => void): void;
    bindSession(session: Session, options?: PointerSessionInputOptions): () => void;
}
export interface RuntimeDispatchHandlers {
    start(request: StartRequest): SessionHandle;
    update(sessionId: string, input: RuntimeInput): void;
    release(sessionId: string, input: RuntimeInput): Promise<void>;
    cancel(sessionId: string, reason?: string): void;
    interrupt(sessionId: string, reason?: string): void;
}
export declare class RuntimeDispatcher {
    private readonly handlers;
    constructor(handlers: RuntimeDispatchHandlers);
    start(request: StartRequest): SessionHandle;
    update(sessionId: string, input: RuntimeInput): void;
    release(sessionId: string, input: RuntimeInput): Promise<void>;
    cancel(sessionId: string, reason?: string): void;
    interrupt(sessionId: string, reason?: string): void;
}
