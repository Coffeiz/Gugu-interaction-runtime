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

  takeObject(objectId: string): Lease {
    const lease = this.owner.takeObject(objectId, this.id)
    this.leases.push(lease)
    return lease
  }

  trackCleanup(dispose: () => void): void { this.cleanup.track(dispose) }

  takeSurface(surfaceId: string) {
    this.leases.push(this.owner.takeSurface(surfaceId, this.id))
  }

  handoff() {
    this.transition('handoff')
  }

  dispose() {
    if (this.state === 'disposed') return
    // interrupt 是独立的收尾路径，不能走“非 done/cancelled 就补 done”；
    // 否则 landing 中 regrab 会触发非法 interrupt → done。
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
      // regrab 时落地代理（proxy DOM 节点）由新 session 接管——它从来不经过
      // cleanup 追踪（销毁是 disposeVisualProxy() 单独处理的），所以调用
      // cleanup.disposeAll() 不会影响代理交接。但 cleanup 里登记的其它资源
      // （trackLandingTarget 的 rAF 轮询、regrab 的 pointerdown 监听、
      // autoScroll）都是这个旧 session 独有的，新 session 会各自重新建一套，
      // 不会复用旧的——如果不清理，这些 rAF 循环/监听器会永久残留，泄漏到
      // 页面刷新为止。仍必须先经过 interrupt，不能把 release/landing 直接
      // 伪装成 done；否则 release → done 不在合法转换表中，会让快速 regrab
      // 抛异常。
      if (this.state === 'disposed') return
      if (this.state !== 'interrupt' && this.state !== 'cancelled' && this.state !== 'done') {
        this.transition('interrupt')
      }
      if (this.state === 'interrupt' || this.state === 'cancelled' || this.state === 'done') {
        this.transition('disposed')
      }
      this.leases.forEach(lease => lease.release())
      this.leases = []
      this.cleanup.disposeAll()
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
