import { Owner, Lease } from '../owner/Owner';
import { Session } from './Session';
export interface GroupObjectOffset {
    readonly x: number;
    readonly y: number;
}
export interface GroupDragSessionOptions {
    readonly type?: string;
    readonly offsets?: ReadonlyMap<string, GroupObjectOffset>;
}
/**
 * 多对象拖拽的 Core 会话。
 *
 * 物理上仍只有一个主会话：primaryObjectId 负责指针、速度和落点；其余对象只
 * 共享会话生命周期与相对偏移。底层复用单对象 Session，避免改动既有单卡状态机。
 */
export declare class GroupDragSession extends Session {
    private readonly leasedObjectIds;
    private readonly offsets;
    readonly objectIds: readonly string[];
    readonly primaryObjectId: string;
    constructor(objectIds: readonly string[], primaryObjectId: string, owner: Owner, options?: GroupDragSessionOptions);
    hasObject(objectId: string): boolean;
    offsetFor(objectId: string): GroupObjectOffset | undefined;
    /** 获取 group 内尚未获取的对象 Lease，保证重复调用不会重复登记。 */
    takeObject(objectId: string): Lease;
    takeObjects(): readonly Lease[];
}
