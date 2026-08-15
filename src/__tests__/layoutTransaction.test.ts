import { describe, expect, it } from 'vitest'
import { LayoutTransactionCoordinator } from '../dom/LayoutTransaction'

describe('LayoutTransactionCoordinator', () => {
  it('同一根节点合并组切换和移动意图', () => {
    const coordinator = new LayoutTransactionCoordinator()
    const root = document.createElement('div')
    const first = coordinator.begin(root, 'group-toggle')
    coordinator.request(root, { type: 'open-group', status: 'pending' })
    const merged = coordinator.begin(root, 'move', 'interaction')
    const latest = coordinator.request(root, { type: 'move-card', objectId: 'card-1' })

    expect(merged.id).toBe(first.id)
    expect(merged.participantId).not.toBe(first.participantId)
    expect(merged.reasons).toEqual(['group-toggle', 'move'])
    expect(merged.priority).toBe('interaction')
    expect(latest.mutations).toEqual([{ type: 'open-group', status: 'pending' }, { type: 'move-card', objectId: 'card-1' }])
  })

  it('观察器只能加入已有交互事务，不能覆盖交互优先级', () => {
    const coordinator = new LayoutTransactionCoordinator()
    const root = document.createElement('div')
    coordinator.begin(root, 'move', 'interaction')
    const observer = coordinator.begin(root, 'surface-observer', 'observer')

    expect(observer.priority).toBe('interaction')
    expect(observer.reasons).toEqual(['move', 'surface-observer'])
  })

  it('observer 结束不会提前关闭仍在进行的交互事务', () => {
    const coordinator = new LayoutTransactionCoordinator()
    const root = document.createElement('div')
    const move = coordinator.begin(root, 'move')
    const observer = coordinator.begin(root, 'surface-observer', 'observer')

    coordinator.commit(root, observer.participantId)
    expect(coordinator.isActive(root)).toBe(true)
    expect(coordinator.commit(root, move.participantId)?.id).toBe(move.id)
    expect(coordinator.isActive(root)).toBe(false)
  })

  it('提交或取消后旧事务不能继续接收 mutation', () => {
    const coordinator = new LayoutTransactionCoordinator()
    const root = document.createElement('div')
    const first = coordinator.begin(root, 'move')
    expect(coordinator.commit(root, first.participantId)?.id).toBe('layout-1')
    expect(coordinator.isActive(root)).toBe(false)
    expect(() => coordinator.request(root, { type: 'late-update' })).toThrow()

    const second = coordinator.begin(root, 'group-toggle')
    expect(coordinator.cancel(root, second.participantId)?.id).toBe('layout-2')
    expect(coordinator.isActive(root)).toBe(false)
  })

  it('合并事务在所有参与者结束前保持 active', () => {
    const coordinator = new LayoutTransactionCoordinator()
    const root = document.createElement('div')
    coordinator.begin(root, 'group-toggle')
    coordinator.begin(root, 'move')

    coordinator.commit(root)
    expect(coordinator.isActive(root)).toBe(true)
    expect(coordinator.commit(root)?.id).toBe('layout-1')
    expect(coordinator.isActive(root)).toBe(false)
  })

  it('旧参与者不能结束后续创建的新事务', () => {
    const coordinator = new LayoutTransactionCoordinator()
    const root = document.createElement('div')
    const old = coordinator.begin(root, 'move')
    expect(coordinator.commit(root, old.participantId)?.id).toBe('layout-1')

    const current = coordinator.begin(root, 'group-toggle')
    expect(coordinator.commit(root, old.participantId)).toBeNull()
    expect(coordinator.isActive(root)).toBe(true)
    expect(coordinator.commit(root, current.participantId)?.id).toBe('layout-2')
  })

  it('只有最后一个参与者提交时才执行 deferred plan', () => {
    const coordinator = new LayoutTransactionCoordinator()
    const root = document.createElement('div')
    const first = coordinator.begin(root, 'group-toggle')
    const second = coordinator.begin(root, 'move')
    const calls: string[] = []

    expect(coordinator.defer(root, first.participantId, () => calls.push('group'), 'group-flip')).not.toBeNull()
    expect(coordinator.defer(root, second.participantId, () => calls.push('move'), 'move-flip')).not.toBeNull()
    coordinator.commit(root, first.participantId)
    expect(calls).toEqual([])
    coordinator.commit(root, second.participantId)
    expect(calls).toEqual(['group', 'move'])
  })

  it('取消参与者时丢弃该参与者的 deferred plan', () => {
    const coordinator = new LayoutTransactionCoordinator()
    const root = document.createElement('div')
    const cancelled = coordinator.begin(root, 'group-toggle')
    const active = coordinator.begin(root, 'move')
    const calls: string[] = []

    coordinator.defer(root, cancelled.participantId, () => calls.push('cancelled'))
    coordinator.defer(root, active.participantId, () => calls.push('active'))
    coordinator.cancel(root, cancelled.participantId)
    coordinator.commit(root, active.participantId)

    expect(calls).toEqual(['active'])
  })

  it('先提交后取消最后参与者时仍执行已提交参与者的 deferred plan', () => {
    const coordinator = new LayoutTransactionCoordinator()
    const root = document.createElement('div')
    const committed = coordinator.begin(root, 'move')
    const cancelled = coordinator.begin(root, 'group-toggle')
    const calls: string[] = []

    coordinator.defer(root, committed.participantId, () => calls.push('move'))
    coordinator.defer(root, cancelled.participantId, () => calls.push('group'))
    coordinator.commit(root, committed.participantId)
    expect(calls).toEqual([])
    coordinator.cancel(root, cancelled.participantId)

    expect(calls).toEqual(['move'])
    expect(coordinator.isActive(root)).toBe(false)
  })

  it('计划执行异常不会阻断同一事务中的后续计划', () => {
    const coordinator = new LayoutTransactionCoordinator()
    const root = document.createElement('div')
    const first = coordinator.begin(root, 'group-toggle')
    const second = coordinator.begin(root, 'move')
    const calls: string[] = []

    coordinator.defer(root, first.participantId, () => {
      calls.push('failed')
      throw new Error('plan failed')
    }, 'group-flip')
    coordinator.defer(root, second.participantId, () => calls.push('continued'), 'move-flip')
    coordinator.commit(root, first.participantId)
    expect(() => coordinator.commit(root, second.participantId)).toThrow('plan failed')
    expect(calls).toEqual(['failed', 'continued'])
  })

  it('事务快照暴露计划生命周期', () => {
    const coordinator = new LayoutTransactionCoordinator()
    const root = document.createElement('div')
    const participant = coordinator.begin(root, 'move')
    coordinator.defer(root, participant.participantId, () => undefined, 'move-flip')
    expect(coordinator.getSnapshot(root)?.plans[0]).toMatchObject({ type: 'move-flip', status: 'queued' })
    coordinator.commit(root, participant.participantId)
    expect(coordinator.getSnapshot(root)).toBeNull()
  })

  it('新事务开始后旧 plan token 失效', () => {
    const coordinator = new LayoutTransactionCoordinator()
    const root = document.createElement('div')
    const old = coordinator.begin(root, 'move')
    const plan = coordinator.defer(root, old.participantId, () => undefined, 'move-flip')
    if (!plan) throw new Error('plan was not created')
    coordinator.commit(root, old.participantId)
    expect(plan.isCurrent()).toBe(true)

    coordinator.begin(root, 'group-toggle')
    expect(plan.isCurrent()).toBe(false)
  })

  it('事务协调器基线：1000 次合并事务保持轻量', () => {
    const coordinator = new LayoutTransactionCoordinator()
    const roots = Array.from({ length: 1000 }, () => document.createElement('div'))
    const start = performance.now()
    roots.forEach(root => {
      const first = coordinator.begin(root, 'move')
      const second = coordinator.begin(root, 'surface-observer', 'observer')
      coordinator.defer(root, first.participantId, () => undefined, 'move-flip')
      coordinator.defer(root, second.participantId, () => undefined, 'surface-resize')
      coordinator.commit(root, first.participantId)
      coordinator.commit(root, second.participantId)
    })
    const elapsed = performance.now() - start
    expect(elapsed).toBeLessThan(250)
  })
})
