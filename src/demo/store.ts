import { reactive } from 'vue'

export interface Card {
  id: string
  title: string
  /** 只有进入完成列才会有值，决定完成列里按哪个分组展示——模拟 Gugu 项目
   * 看板完成列按月份/最近分组，是"跟普通列结构不同的对象"这一验收点。 */
  doneGroup?: string
}

export interface ColumnDef {
  id: string
  title: string
  cardIds: string[]
}

export const columns = reactive<ColumnDef[]>([
  { id: 'todo', title: '待开始', cardIds: ['c1', 'c2', 'c3'] },
  { id: 'doing', title: '进行中', cardIds: ['c4', 'c5'] },
  { id: 'done', title: '已完成', cardIds: ['c6', 'c7', 'c8'] },
])

export const cards = reactive<Record<string, Card>>({
  c1: { id: 'c1', title: '设计评审' },
  c2: { id: 'c2', title: '接口联调' },
  c3: { id: 'c3', title: '补充测试用例' },
  c4: { id: 'c4', title: '首页改版' },
  c5: { id: 'c5', title: '性能优化' },
  c6: { id: 'c6', title: '登录流程重构', doneGroup: '本周' },
  c7: { id: 'c7', title: '数据看板 v1', doneGroup: '本周' },
  c8: { id: 'c8', title: '旧版迁移', doneGroup: '上周' },
})

export function findColumn(cardId: string): ColumnDef | undefined {
  return columns.find(col => col.cardIds.includes(cardId))
}

export function moveCard(cardId: string, toColumnId: string, toIndex: number) {
  const from = findColumn(cardId)
  if (!from) return
  const to = columns.find(col => col.id === toColumnId)
  if (!to) return
  const fromIndex = from.cardIds.indexOf(cardId)
  if (from === to && fromIndex === toIndex) return
  from.cardIds.splice(fromIndex, 1)
  const insertAt = from === to && fromIndex < toIndex ? toIndex - 1 : toIndex
  to.cardIds.splice(insertAt, 0, cardId)
  if (toColumnId === 'done' && !cards[cardId].doneGroup) cards[cardId].doneGroup = '本周'
  if (toColumnId !== 'done') delete cards[cardId].doneGroup
}
