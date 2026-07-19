/**
 * 一个可以容纳对象的区域——列/文件夹/日期格/画布/垃圾桶……见 docs/DESIGN.md。
 */
export interface Surface {
  id: string
  /** 'list' / 'canvas' / 'trash' ... */
  type: string
  element: HTMLElement | null
  /** 接受哪些 object type，空数组表示不限制。 */
  accepts: string[]
}
