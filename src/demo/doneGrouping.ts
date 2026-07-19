import type { Card } from './store'

export interface MonthGroup {
  key: string
  label: string
  cardIds: string[]
}

export interface YearGroup {
  key: string
  label: string
  months: MonthGroup[]
  cardIds: string[]
}

/**
 * 完成列按"年 > 月"两层分组——咕咕真实的已完成列是这样的多层结构，不是
 * 单层的"本周/上周"标签。分组完全由 `doneAt`（真实日期）推导，不依赖
 * 手工维护的分组名，卡片一旦有日期就自动落进正确的年/月分组。
 */
export function buildDoneGroups(cardIds: readonly string[], cards: Record<string, Card>): YearGroup[] {
  const years = new Map<string, Map<string, string[]>>()
  for (const id of cardIds) {
    const doneAt = cards[id]?.doneAt
    if (!doneAt) continue
    const year = doneAt.slice(0, 4)
    const month = doneAt.slice(0, 7)
    if (!years.has(year)) years.set(year, new Map())
    const months = years.get(year)!
    if (!months.has(month)) months.set(month, [])
    months.get(month)!.push(id)
  }
  return Array.from(years, ([year, months]) => {
    const monthGroups = Array.from(months, ([month, ids]) => ({
      key: month,
      label: `${Number(month.slice(5, 7))}月`,
      cardIds: ids,
    })).sort((a, b) => b.key.localeCompare(a.key))
    return {
      key: year,
      label: `${year}年`,
      months: monthGroups,
      cardIds: monthGroups.flatMap(m => m.cardIds),
    }
  }).sort((a, b) => b.key.localeCompare(a.key))
}
