export type NodePortSide = 'left' | 'right'

export interface NodePortConfig {
  id: string
  side: NodePortSide
  /** 端点在对象高度上的归一化位置，0 是顶部，1 是底部。 */
  position?: number
  /** 可选的端口命中半径；未传时由 Runtime 使用默认值。 */
  hitRadius?: number
  accepts?: readonly string[]
}

export interface NodeConfig {
  ports: readonly NodePortConfig[]
}

export interface NodePortSnapshot extends NodePortConfig {
  objectId: string
  point: { x: number; y: number }
  rect: DOMRect
}

export interface NodeConnectionState {
  sourceObjectId: string
  sourcePortId: string
  source: NodePortSnapshot
  currentPoint: { x: number; y: number }
}
