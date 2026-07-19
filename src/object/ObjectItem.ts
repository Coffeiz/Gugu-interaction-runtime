/**
 * 一个可交互对象的最小描述——只回答"我是谁、DOM 在哪、当前在哪个 Surface、
 * 能参与哪些 Session 类型"，不持有业务数据本身。见 docs/DESIGN.md 原则 4。
 */
export interface ObjectItem {
  id: string
  /** 'project-card' / 'file-item' / 'mind-note' / 'kanban-card' ... */
  type: string
  /** 当前所在的 Surface id，随业务数据变化而变化。 */
  surfaceId: string
  element: HTMLElement | null
  /** 'move' / 'sort' / 'resize' / 'link' ...——决定这个对象能参与哪些 Session 类型。 */
  abilities: string[]
}
