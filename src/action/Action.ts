export interface BaseAction {
  readonly objectId: string
  readonly timestamp: number
}

export interface MoveAction extends BaseAction {
  readonly type: 'move'
  readonly fromSurfaceId: string
  readonly toSurfaceId: string
  /** 目标 Surface 内的插入位置；不是所有业务都有"顺序"概念，可选。 */
  readonly toIndex?: number
  /** 释放时的屏幕坐标，free Surface 可据此换算业务坐标。 */
  readonly point?: { x: number; y: number }
  /** physical 释放策略在松手瞬间的屏幕速度。 */
  readonly releaseVelocity?: { x: number; y: number }
  /** 抓起时捕获的源元素 CSS 尺寸，供跨 Surface 的乐观插入使用。 */
  readonly sourceSize?: { w: number; h: number }
}

export interface MoveGroupAction extends BaseAction {
  readonly type: 'move-group'
  /** 主卡对应的 objectId，保留 BaseAction 兼容现有 Action 消费者。 */
  readonly primaryObjectId: string
  readonly objectIds: readonly string[]
  readonly fromSurfaceId: string
  readonly toSurfaceId: string
  readonly toIndex?: number
}

export interface TransferAction extends BaseAction {
  readonly type: 'transfer'
  readonly fromSurfaceId: string
  readonly toSurfaceId: string
}

export interface SortAction extends BaseAction {
  readonly type: 'sort'
  readonly surfaceId: string
  readonly fromIndex: number
  readonly toIndex: number
}

export interface ResizeAction extends BaseAction {
  readonly type: 'resize'
  readonly width: number
  readonly height: number
}

export interface LinkAction extends BaseAction {
  readonly type: 'link'
  readonly targetObjectId: string
}

export interface ConnectionCreateAction extends BaseAction {
  readonly type: 'connection-create'
  readonly sourceObjectId: string
  readonly sourcePortId: string
  readonly targetObjectId: string
  readonly targetPortId: string
}

export interface ConnectionDeleteAction extends BaseAction {
  readonly type: 'connection-delete'
  readonly connectionId: string
}

export interface ConnectionCancelAction extends BaseAction {
  readonly type: 'connection-cancel'
  readonly sourceObjectId: string
  readonly sourcePortId: string
}

export type Action =
  | MoveAction
  | MoveGroupAction
  | TransferAction
  | SortAction
  | ResizeAction
  | LinkAction
  | ConnectionCreateAction
  | ConnectionDeleteAction
  | ConnectionCancelAction
