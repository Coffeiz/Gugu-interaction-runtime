import { reactive } from 'vue'

export interface Card {
  id: string
  title: string
  /** 只有进入完成列才会有值，格式 'YYYY-MM-DD'。完成列按"年 > 月"两层分组
   * 展示——咕咕真实的已完成列就是按年月多层分组的，不是单层"本周/上周"，
   * 这里用真实日期驱动分组，而不是一个扁平的分组名字符串。 */
  doneAt?: string
}

export interface ColumnDef {
  id: string
  title: string
  cardIds: string[]
}

export const columns = reactive<ColumnDef[]>([
  { id: 'todo', title: '待开始', cardIds: ['c1', 'c2', 'c3'] },
  { id: 'doing', title: '进行中', cardIds: ['c4', 'c5'] },
  { id: 'done', title: '已完成', cardIds: ['c6', 'c7', 'c8', 'c9'] },
])

export const cards = reactive<Record<string, Card>>({
  c1: { id: 'c1', title: '设计评审' },
  c2: { id: 'c2', title: '接口联调' },
  c3: { id: 'c3', title: '补充测试用例' },
  c4: { id: 'c4', title: '首页改版' },
  c5: { id: 'c5', title: '性能优化' },
  c6: { id: 'c6', title: '登录流程重构', doneAt: '2026-07-15' },
  c7: { id: 'c7', title: '数据看板 v1', doneAt: '2026-07-10' },
  c8: { id: 'c8', title: '旧版迁移', doneAt: '2026-06-02' },
  c9: { id: 'c9', title: '年度架构评审', doneAt: '2025-12-20' },
})

/** demo 里"现在"固定成这个日期，不用 new Date()——分组结果需要在多次
 * 刷新之间保持一致，才方便复现/验证多层分组的动画。 */
export const DEMO_TODAY = '2026-07-19'

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
  if (toColumnId === 'done' && !cards[cardId].doneAt) cards[cardId].doneAt = DEMO_TODAY
  if (toColumnId !== 'done') delete cards[cardId].doneAt
}
