import { reactive } from 'vue'

export interface Card {
  id: string
  title: string
  doneAt?: string
}

export interface ColumnDef {
  id: string
  title: string
  cardIds: string[]
}

// 待开始: 18 张
const todoIds = [
  'c1','c2','c3','c10','c11','c12',
  'c20','c21','c22','c23','c24','c25',
  'c40','c41','c42','c43','c44','c45',
]

// 进行中: 16 张
const doingIds = [
  'c4','c5','c30','c31','c32','c33','c34','c35',
  'c50','c51','c52','c53','c54','c55','c56','c57',
]

// 审核中: 12 张
const reviewIds = [
  'c60','c61','c62','c63','c64','c65',
  'c70','c71','c72','c73','c74','c75',
]

// 已完成: 24 张，跨2025-2026多个月
const doneIds = [
  'c6','c7','c8','c9',
  'c80','c81','c82','c83','c84','c85',
  'c90','c91','c92','c93','c94','c95',
  'c100','c101','c102','c103','c104','c105',
  'c110','c111',
]

export const columns = reactive<ColumnDef[]>([
  { id: 'todo', title: '待开始', cardIds: [...todoIds] },
  { id: 'doing', title: '进行中', cardIds: [...doingIds] },
  { id: 'review', title: '审核中', cardIds: [...reviewIds] },
  { id: 'done', title: '已完成', cardIds: [...doneIds] },
])

const cardTitles: Record<string, string> = {
  c1: '设计评审', c2: '接口联调', c3: '补充测试用例（不可拖动）',
  c4: '首页改版', c5: '性能优化',
  c6: '登录流程重构', c7: '数据看板 v1', c8: '旧版迁移', c9: '年度架构评审',
  // todo
  c10:'用户画像分析',c11:'消息推送优化',c12:'暗色模式适配',
  c20:'API 文档补全',c21:'国际化方案调研',c22:'SSR 接入评估',c23:'错误监控升级',c24:'灰度发布方案',c25:'缓存策略优化',
  c40:'权限模型重构',c41:'搜索分词优化',c42:'图表库升级',c43:'日志采集方案',c44:'移动端适配',c45:'微前端评估',
  // doing
  c30:'支付流程优化',c31:'通知中心设计',c32:'文件上传改造',c33:'标签系统设计',c34:'评论组件重构',
  c35:'分享功能设计',
  c50:'数据迁移脚本',c51:'批量操作优化',c52:'搜索排序算法',c53:'导出功能增强',c54:'快捷键系统',
  c55:'草稿自动保存',c56:'多语言支持',c57:'截图工具接入',
  // review
  c60:'代码规范工具链',c61:'CI/CD 迁移',c62:'性能压测报告',c63:'安全审计跟进',c64:'依赖升级方案',
  c65:'监控告警规则',
  c70:'数据备份策略',c71:'容灾演练计划',c72:'API 限流方案',c73:'日志脱敏方案',c74:'合规审查',
  c75:'文档站点搭建',
  // done (with dates)
  c80:'SQL 优化',c81:'CDN 切换',c82:'静态资源压缩',c83:'服务端缓存',c84:'数据库索引整理',
  c85:'慢查询治理',
  c90:'邮件模板升级',c91:'用户反馈系统',c92:'A/B测试框架',c93:'异常上报优化',c94:'图片懒加载',
  c95:'骨架屏组件',
  c100:'新用户引导',c101:'数据大盘 v2',c102:'表格虚拟滚动',c103:'拖拽排序组件',c104:'富文本编辑器',
  c105:'实时协作方案',
  c110:'前端监控接入',c111:'自动化测试框架',
}

const doneDates: Record<string, string> = {
  c6:'2026-07-15',c7:'2026-07-10',c8:'2026-06-02',c9:'2025-12-20',
  c80:'2026-07-18',c81:'2026-07-16',c82:'2026-07-12',c83:'2026-07-08',c84:'2026-07-05',
  c85:'2026-07-01',
  c90:'2026-06-28',c91:'2026-06-22',c92:'2026-06-18',c93:'2026-06-10',c94:'2026-06-05',
  c95:'2026-06-01',
  c100:'2025-03-15',c101:'2025-03-10',c102:'2025-02-20',c103:'2025-02-15',c104:'2025-01-25',
  c105:'2025-01-10',
  c110:'2024-12-20',c111:'2024-11-05',
}

const allIds = [...todoIds, ...doingIds, ...reviewIds, ...doneIds]
export const cards = reactive<Record<string, Card>>(
  Object.fromEntries(allIds.map(id => [id, {
    id,
    title: cardTitles[id] ?? `任务${id}`,
    ...(doneDates[id] ? { doneAt: doneDates[id] } : {}),
  }]))
)

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
