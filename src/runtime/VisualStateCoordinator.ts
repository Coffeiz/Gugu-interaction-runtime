import { DefaultVisualAdapter, type VisualAdapter } from '../dom/VisualAdapter'
import type { VisualState } from '../dom/VisualAdapterTypes'
import { trackLandingTarget, type LandingTargetTrackerOptions } from '../dom/LandingTargetTracker'
import type { Cleanup } from '../cleanup/Cleanup'

export interface VisualStatePort {
  getAdapter(objectId: string): VisualAdapter
}

/** 统一 VisualAdapter 的状态快照、写入和 target 解析。 */
export class VisualStateCoordinator {
  constructor(private readonly port: VisualStatePort) {}

  resolveTarget(objectId: string, destination: unknown): HTMLElement | null {
    const target = this.port.getAdapter(objectId).resolveTarget?.(objectId, destination)
      ?? new DefaultVisualAdapter().resolveTarget(objectId)
    return target?.isConnected ? target : null
  }

  apply(objectId: string, element: HTMLElement, state: VisualState): void {
    const adapter = this.port.getAdapter(objectId)
    ;(adapter.applyState ?? new DefaultVisualAdapter().applyState)(element, state)
  }

  capture(objectId: string, element: HTMLElement) {
    const adapter = this.port.getAdapter(objectId)
    return (adapter.captureVisualState ?? new DefaultVisualAdapter().captureVisualState)(element)
  }

  trackTarget(
    cleanup: Cleanup,
    target: HTMLElement,
    retarget: (rect: DOMRect) => void,
    options: Omit<LandingTargetTrackerOptions, 'cleanup' | 'target' | 'retarget'> = {},
  ): () => void {
    return trackLandingTarget({ ...options, cleanup, target, retarget })
  }
}
