import type { LandingResult } from '../behavior/MoveBehavior'

/**
 * detach release 主链的显式依赖边界。
 * 迁移期间允许先由业务提供 run，后续逐步把 onUp 主体移入 coordinator。
 */
export interface DetachReleaseContext {
  readonly sessionId: string
  readonly objectId: string
  readonly source: HTMLElement
  readonly proxy?: HTMLElement | null
  readonly landing?: Promise<LandingResult>
}

export interface DetachReleaseCoordinatorOptions<TDrop> {
  readonly release: () => TDrop | null
  readonly onInvalidDrop?: () => void
  readonly onAcceptedDrop?: (drop: TDrop) => void
}

export class DetachReleaseCoordinator<TDrop> {
  private released = false

  constructor(private readonly options: DetachReleaseCoordinatorOptions<TDrop>) {}

  release(): TDrop | null {
    if (this.released) return null
    this.released = true
    const drop = this.options.release()
    if (!drop) this.options.onInvalidDrop?.()
    else this.options.onAcceptedDrop?.(drop)
    return drop
  }

  reset(): void {
    this.released = false
  }
}
