import { describe, expect, it } from 'vitest'
import { MoveTransaction } from '../behavior/MoveTransaction'

describe('MoveTransaction', () => {
  it('保存事务阶段和编排数据', () => {
    const transaction = new MoveTransaction()
    const source = { id: 'source' }
    const destination = { surfaceId: 'board', index: 0 }

    transaction.source = source
    transaction.destination = destination
    transaction.setPhase('landing')

    expect(transaction.source).toBe(source)
    expect(transaction.destination).toBe(destination)
    expect(transaction.phase).toBe('landing')
  })

  it('失效 token 后旧异步结果不再有效', () => {
    const transaction = new MoveTransaction()
    const token = transaction.token

    expect(transaction.isCurrent(token)).toBe(true)
    transaction.invalidate()
    expect(transaction.isCurrent(token)).toBe(false)
    expect(transaction.isCurrent(transaction.token)).toBe(true)

    transaction.setPhase('cancelled')
    expect(transaction.isCurrent(transaction.token)).toBe(false)
  })
})
