import type { Owner, Lease } from '../owner/Owner'
import { Cleanup } from '../cleanup/Cleanup'

export type SessionState = 'active' | 'landing' | 'handoff' | 'done' | 'cancelled'

let nextSessionId = 1

/**
 * 一次完整交互。Session 自己声明"接管范围"——不只是被拖动的对象，还包括
 * 会被联动布局影响到的 Surface（源列、目标列），否则会出现新模型接管了
 * 卡片、旧模型还在控制它所在容器的混合态。见 docs/DESIGN.md 原则 2。
 */
export class Session {
  readonly id: string
  state: SessionState = 'active'
  readonly cleanup = new Cleanup()
  private leases: Lease[] = []

  constructor(readonly type: string, private owner: Owner) {
    this.id = `session-${nextSessionId++}`
  }

  takeObject(objectId: string) {
    this.leases.push(this.owner.takeObject(objectId, this.id))
  }

  takeSurface(surfaceId: string) {
    this.leases.push(this.owner.takeSurface(surfaceId, this.id))
  }

  /** 交还 Vue 是显式阶段，不是 release 之后自动生效——见规则 6/7。 */
  handoff() {
    this.state = 'handoff'
  }

  dispose() {
    this.state = 'done'
    this.leases.forEach(lease => lease.release())
    this.leases = []
    this.cleanup.disposeAll()
  }

  cancel() {
    this.state = 'cancelled'
    this.dispose()
  }
}
