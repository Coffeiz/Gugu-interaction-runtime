export type MoveTransactionPhase =
  | 'prepare'
  | 'active'
  | 'release'
  | 'landing'
  | 'handoff'
  | 'done'
  | 'cancelled'
  | 'disposed'

export interface MoveActionDestination {
  readonly fromSurfaceId: string
  readonly toSurfaceId: string
  readonly toIndex?: number
  readonly point?: { x: number; y: number }
  readonly releaseVelocity?: { x: number; y: number }
  readonly sourceSize?: { w: number; h: number }
}

/**
 * 一次移动事务的最小状态容器。
 *
 * 它只保存编排所需的数据，不负责命中、业务提交或具体动画。
 * token 在事务失效时递增，视觉策略和异步回调可据此拒绝旧结果。
 */
export class MoveTransaction {
  phase: MoveTransactionPhase = 'prepare'
  source: unknown = null
  destination: unknown = null
  target: unknown = null
  actionEmitted = false
  private tokenValue = 0

  get token(): number {
    return this.tokenValue
  }

  setPhase(phase: MoveTransactionPhase): void {
    this.phase = phase
  }

  invalidate(): number {
    this.tokenValue += 1
    return this.tokenValue
  }

  isCurrent(token: number): boolean {
    return token === this.tokenValue && this.phase !== 'cancelled' && this.phase !== 'disposed'
  }
}
