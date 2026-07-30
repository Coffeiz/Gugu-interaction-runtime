export type ControlMode = 'vue' | 'runtime';
export type Channel = 'position' | 'scale' | 'rotation' | 'opacity' | 'visibility' | 'layout' | 'hover' | 'zIndex';
export interface Lease {
    release(): void;
}
/**
 * 两层控制权：对象/区域级 ControlMode 挡住 Vue；channel Lease 避免 Runtime
 * 内部模块同时写同一属性。
 */
export declare class Owner {
    private controlled;
    private channelOwners;
    private readonly events;
    subscribe(listener: (id: string) => void): () => void;
    takeObject(id: string, sessionId: string): Lease;
    takeSurface(id: string, sessionId: string): Lease;
    isControlled(id: string): boolean;
    isOwnedBy(id: string, sessionId: string): boolean;
    takeChannel(objectId: string, channel: Channel, sessionId: string): Lease;
    ownsChannel(objectId: string, channel: Channel, sessionId: string): boolean;
}
