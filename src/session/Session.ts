import type { Owner, Lease } from '../owner/Owner'
import { Cleanup } from '../cleanup/Cleanup'

export type SessionState =
  | 'prepare' | 'active' | 'release' | 'landing' | 'saving'
  | 'handoff' | 'rollback' | 'interrupt' | 'done' | 'cancelled' | 'disposed'

export type SessionEndReason = 'cancel' | 'finish' | 'regrab'

const allowedTransitions: Record<SessionState, SessionState[]> = {
  prepare: ['active', 'interrupt', 'cancelled'],
  active: ['release', 'landing', 'interrupt', 'cancelled'],
  release: ['landing', 'saving', 'interrupt', 'cancelled'],
  landing: ['saving', 'handoff', 'done', 'interrupt', 'cancelled'],
  saving: ['handoff', 'rollback', 'interrupt', 'cancelled'],
  handoff: ['done', 'cancelled'],
  rollback: ['done', 'cancelled'],
  interrupt: ['disposed', 'cancelled'],
  done: ['disposed'],
  cancelled: ['disposed'],
  disposed: [],
}

let nextSessionId = 1

/**
 * 一次完整交互。Session 自己声明“接管范围”——不只是被拖动的对象，还包括
 * 会被联动布局影响到的 Surface（源列、目标列）。
 */
export class Session {
  readonly id: string
  state: SessionState = 'prepare'
  endReason: SessionEndReason = 'finish'
  readonly cleanup = new Cleanup()
  private leases: Lease[] = []

  constructor(readonly type: string, readonly objectId: string, private owner: Owner) {
    this.id = `session-${nextSessionId++}`
  }

  transition(next: SessionState): void {
    if (this.state === next) return
    if (!allowedTransitions[this.state].includes(next)) {
      throw new Error(`Invalid session transition: ${this.state} -> ${next}`)
    }
    this.state = next
  }

  takeObject(objectId: string) {
    this.leases.push(this.owner.takeObject(objectId, this.id))
  }

  takeSurface(surfaceId: string) {
    this.leases.push(this.owner.takeSurface(surfaceId, this.id))
  }

  handoff() {
    this.transition('handoff')
  }

  dispose() {
    if (this.state === 'disposed') return
    if (this.state === 'interrupt') {
      this.transition('disposed')
    } else {
      if (this.state !== 'done' && this.state !== 'cancelled') this.transition('done')
      this.transition('disposed')
    }
    this.leases.forEach(lease => lease.release())
    this.leases = []
    this.cleanup.disposeAll()
  }

  cancel() {
    if (this.state === 'disposed') return
    if (this.state !== 'cancelled') this.transition('cancelled')
    this.dispose()
  }

  interrupt(reason: SessionEndReason = 'cancel') {
    this.endReason = reason
    if (reason === 'regrab') {
      // regrab 时跳过视觉 cleanup：proxy/landing visual 由新 session 接管。
      // 直接 done → disposed，不经过 interrupt 状态，只释放 leases。
      if (this.state === 'disposed') return
      if (this.state !== 'done' && this.state !== 'cancelled') this.transition('done')
      this.transition('disposed')
      this.leases.forEach(lease => lease.release())
      this.leases = []
      return
    }
    if (
      this.state === 'prepare'
      || this.state === 'active'
      || this.state === 'release'
      || this.state === 'landing'
      || this.state === 'saving'
    ) {
      this.transition('interrupt')
    }
    this.dispose()
  }
}
