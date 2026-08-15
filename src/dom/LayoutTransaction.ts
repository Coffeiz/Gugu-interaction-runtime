export type LayoutTransactionReason = 'move' | 'group-toggle' | 'surface-observer'
export type LayoutTransactionPriority = 'observer' | 'interaction'

export interface LayoutMutation {
  readonly type: string
  readonly [key: string]: unknown
}

export interface LayoutTransactionSnapshot {
  readonly id: string
  readonly participantId: string
  readonly root: ParentNode
  readonly reasons: readonly LayoutTransactionReason[]
  readonly priority: LayoutTransactionPriority
  readonly mutations: readonly LayoutMutation[]
  readonly plans: readonly LayoutPlanSnapshot[]
}

export type LayoutPlanStatus = 'queued' | 'running' | 'completed' | 'cancelled' | 'failed'

export interface LayoutPlanSnapshot {
  readonly id: string
  readonly transactionId: string
  readonly participantId: string
  readonly type: string
  readonly status: LayoutPlanStatus
}

export interface LayoutPlan {
  readonly id: string
  readonly transactionId: string
  readonly participantId: string
  readonly type: string
  status: LayoutPlanStatus
  readonly isCurrent: () => boolean
  readonly run: (plan: LayoutPlan) => void
}

interface TransactionState {
  readonly id: string
  readonly root: ParentNode
  reasons: LayoutTransactionReason[]
  priority: LayoutTransactionPriority
  mutations: LayoutMutation[]
  participants: number
  cancelledParticipants: number
  participantIds: Set<string>
  plans: LayoutPlan[]
}

/**
 * 同一布局根节点的事务收集器。
 *
 * Phase 1 只负责收集和合并，不负责 DOM 测量或动画播放；后续组切换、落地
 * 和 Surface observer 都通过这里共享事务边界，再由统一提交器执行布局。
 */
export class LayoutTransactionCoordinator {
  private sequence = 0
  private participantSequence = 0
  private planSequence = 0
  private readonly active = new WeakMap<ParentNode, TransactionState>()
  private readonly latestTransaction = new WeakMap<ParentNode, string>()

  begin(root: ParentNode, reason: LayoutTransactionReason, priority: LayoutTransactionPriority = 'interaction'): LayoutTransactionSnapshot {
    const current = this.active.get(root)
    if (current) {
      this.mergeReason(current, reason, priority)
      current.participants += 1
      const participantId = `participant-${++this.participantSequence}`
      current.participantIds.add(participantId)
      return this.snapshot(current, participantId)
    }

    const state: TransactionState = {
      id: `layout-${++this.sequence}`,
      root,
      reasons: [reason],
      priority,
      mutations: [],
      participants: 1,
      cancelledParticipants: 0,
      participantIds: new Set(),
      plans: [],
    }
    const participantId = `participant-${++this.participantSequence}`
    state.participantIds.add(participantId)
    this.active.set(root, state)
    this.latestTransaction.set(root, state.id)
    return this.snapshot(state, participantId)
  }

  request(root: ParentNode, mutation: LayoutMutation): LayoutTransactionSnapshot {
    const current = this.active.get(root)
    if (!current) {
      throw new Error('Cannot request a layout mutation without an open transaction')
    }
    current.mutations.push(mutation)
    const participant = current.participantIds.values().next().value
    if (!participant) throw new Error('Cannot request a layout mutation without an active participant')
    return this.snapshot(current, participant)
  }

  commit(root: ParentNode, participantId?: string): LayoutTransactionSnapshot | null {
    const current = this.active.get(root)
    if (!current) return null
    const participant = participantId ?? current.participantIds.values().next().value
    if (!participant || !current.participantIds.delete(participant)) return null
    current.participants = Math.max(0, current.participants - 1)
    this.finalizeIfComplete(root, current)
    return this.snapshot(current, participant)
  }

  cancel(root: ParentNode, participantId?: string): LayoutTransactionSnapshot | null {
    const current = this.active.get(root)
    if (!current) return null
    const participant = participantId ?? current.participantIds.values().next().value
    if (!participant || !current.participantIds.delete(participant)) return null
    current.plans
      .filter(plan => plan.participantId === participant && plan.status === 'queued')
      .forEach(plan => { plan.status = 'cancelled' })
    current.cancelledParticipants += 1
    current.participants = Math.max(0, current.participants - 1)
    this.finalizeIfComplete(root, current)
    return this.snapshot(current, participant)
  }

  isActive(root: ParentNode): boolean {
    return this.active.has(root)
  }

  getSnapshot(root: ParentNode): LayoutTransactionSnapshot | null {
    const current = this.active.get(root)
    if (!current) return null
    const participant = current.participantIds.values().next().value
    return participant ? this.snapshot(current, participant) : null
  }

  defer(root: ParentNode, participantId: string, plan: (plan: LayoutPlan) => void, type = 'layout'): LayoutPlan | null {
    const current = this.active.get(root)
    if (!current || !current.participantIds.has(participantId)) return null
    const layoutPlan: LayoutPlan = {
      id: `plan-${++this.planSequence}`,
      transactionId: current.id,
      participantId,
      type,
      status: 'queued',
      run: plan,
      isCurrent: () => layoutPlan.status !== 'cancelled'
        && layoutPlan.status !== 'failed'
        && this.latestTransaction.get(root) === current.id,
    }
    current.plans.push(layoutPlan)
    return layoutPlan
  }

  private mergeReason(state: TransactionState, reason: LayoutTransactionReason, priority: LayoutTransactionPriority): void {
    if (!state.reasons.includes(reason)) state.reasons.push(reason)
    if (priority === 'interaction') state.priority = priority
  }

  private finalizeIfComplete(root: ParentNode, state: TransactionState): void {
    if (state.participants !== 0) return
    this.active.delete(root)
    const plans = state.plans.filter(plan => plan.status === 'queued')
    let firstError: unknown
    plans.forEach(plan => {
      plan.status = 'running'
      try {
        plan.run(plan)
        plan.status = 'completed'
      } catch (error) {
        plan.status = 'failed'
        firstError ??= error
      }
    })
    if (firstError) throw firstError
  }

  private snapshot(state: TransactionState, participantId: string): LayoutTransactionSnapshot {
    return {
      id: state.id,
      participantId,
      root: state.root,
      reasons: [...state.reasons],
      priority: state.priority,
      mutations: state.mutations.map(mutation => ({ ...mutation })),
      plans: state.plans.map(plan => ({
        id: plan.id,
        transactionId: plan.transactionId,
        participantId: plan.participantId,
        type: plan.type,
        status: plan.status,
      })),
    }
  }
}
