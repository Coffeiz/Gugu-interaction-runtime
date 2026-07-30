export interface RuntimeInput {
    readonly kind: string;
    readonly event?: Event;
    readonly x?: number;
    readonly y?: number;
}
export interface StartRequest {
    readonly type: string;
    readonly objectId: string;
    readonly input: RuntimeInput;
}
export interface SessionHandle {
    readonly id: string;
    readonly state: string;
    cancel(reason?: string): void;
    interrupt(reason?: string): void;
}
