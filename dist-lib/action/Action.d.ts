export interface BaseAction {
    readonly objectId: string;
    readonly timestamp: number;
}
export interface MoveAction extends BaseAction {
    readonly type: 'move';
    readonly fromSurfaceId: string;
    readonly toSurfaceId: string;
    /** 目标 Surface 内的插入位置；不是所有业务都有"顺序"概念，可选。 */
    readonly toIndex?: number;
}
export interface MoveGroupAction extends BaseAction {
    readonly type: 'move-group';
    /** 主卡对应的 objectId，保留 BaseAction 兼容现有 Action 消费者。 */
    readonly primaryObjectId: string;
    readonly objectIds: readonly string[];
    readonly fromSurfaceId: string;
    readonly toSurfaceId: string;
    readonly toIndex?: number;
}
export interface TransferAction extends BaseAction {
    readonly type: 'transfer';
    readonly fromSurfaceId: string;
    readonly toSurfaceId: string;
}
export interface SortAction extends BaseAction {
    readonly type: 'sort';
    readonly surfaceId: string;
    readonly fromIndex: number;
    readonly toIndex: number;
}
export interface ResizeAction extends BaseAction {
    readonly type: 'resize';
    readonly width: number;
    readonly height: number;
}
export interface LinkAction extends BaseAction {
    readonly type: 'link';
    readonly targetObjectId: string;
}
export type Action = MoveAction | MoveGroupAction | TransferAction | SortAction | ResizeAction | LinkAction;
