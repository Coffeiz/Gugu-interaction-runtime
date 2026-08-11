/**
 * 一个可交互对象的最小描述——只回答"我是谁、DOM 在哪、当前在哪个 Surface、
 * 能参与哪些 Session 类型"，不持有业务数据本身。见 docs/DESIGN.md 原则 4。
 */
import type { TargetItem } from '../target/Target'
import type { NodeConfig } from '../node/Node'

export interface ObjectItem {
  id: string
  /** 'project-card' / 'file-item' / 'mind-note' / 'kanban-card' ... */
  type: string
  /** 当前所在的 Surface id，随业务数据变化而变化。 */
  surfaceId: string
  element: HTMLElement | null
  /** 'move' / 'sort' / 'resize' / 'link' ...——决定这个对象能参与哪些 Session 类型。 */
  abilities: string[]
  /** 当前是否参与多选；Runtime 会在主卡被抓取时自动收集同 Surface 的已选对象。 */
  selected?: boolean
  /** 可选视觉适配器名；未提供时由对象类型默认配置决定。 */
  visual?: string
  /** 未提供时默认使用 detach。 */
  visualMode?: string
  /** 对象级视觉缩放；用于脱离画布缩放祖先后的拖拽代理。 */
  contentScale?: number | (() => number)
  /** Object 同时作为接收目标时的声明；Runtime 会自动同步到 TargetStore。 */
  target?: Omit<TargetItem, 'id' | 'element' | 'generation'> & { id?: string; element?: HTMLElement | null }
  /** 可选的画布节点端口声明；端点位置由 Runtime 按实时 DOMRect 计算。 */
  node?: NodeConfig
  /**
   * 注册代次（register 时自增）。同一 id 被新实例重新 register 后，
   * 旧实例卸载时凭 generation 判断"当前 item 是否还是自己注册的"，
   * 避免把新实例的注册误删（跨列挂载/卸载竞态）。
   */
  generation?: number
}

export type ObjectUpdate = Partial<Pick<ObjectItem, 'type' | 'surfaceId' | 'abilities' | 'selected' | 'visual' | 'visualMode' | 'contentScale' | 'target' | 'node'>>
