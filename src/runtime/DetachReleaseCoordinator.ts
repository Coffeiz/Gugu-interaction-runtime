import type { LandingResult } from '../behavior/MoveBehavior'

/**
 * detach release 主链的显式依赖边界。
 * 迁移期间允许先由业务提供 run，后续逐步把 onUp 主体移入 coordinator。
 */
export interface DetachReleaseContext {
  readonly sessionId: string
  readonly objectId: string
  readonly source: HTMLElement
  readonly beforeContent: HTMLElement
  readonly sourceRect: DOMRect
  readonly visualSnapshot: unknown
  readonly landingPlan: (() => void) | null
  readonly landingGate: unknown
  readonly objectLease: { release(): void } | null
  readonly proxy?: HTMLElement | null
  readonly landing?: Promise<LandingResult>
}

export interface DetachReleaseCoordinatorOptions<TDrop> {
  readonly release: () => TDrop | null
  readonly onAcceptedDrop?: (drop: TDrop) => void
  readonly onInvalidDrop?: () => void
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

  releaseWithContext(
    context: DetachReleaseContext,
    execute: (context: DetachReleaseContext) => TDrop | null,
  ): TDrop | null {
    if (this.released) return null
    this.released = true
    const drop = execute(context)
    if (!drop) this.options.onInvalidDrop?.()
    else this.options.onAcceptedDrop?.(drop)
    return drop
  }

  reset(): void {
    this.released = false
  }

}
