import type { Cleanup } from '../cleanup/Cleanup'

export interface LandingTargetTrackerOptions {
  cleanup: Cleanup
  target: HTMLElement
  retarget(rect: DOMRect): void
  /** 默认观察 target 到 document.body 之间的祖先尺寸变化。 */
  observeAncestors?: boolean
  /** 祖先观察在这个元素之前停止；默认是 document.body。 */
  stopAt?: HTMLElement | null
}

/**
 * landing 期间持续读取真实目标位置，并把布局变化转发给 motion retarget。
 * Observer 既可以在动画完成时主动停止，也会在 Session Cleanup 时自动断开。
 */
export function trackLandingTarget(options: LandingTargetTrackerOptions): () => void {
  let observer: ResizeObserver | null = null
  let disposed = false

  const stop = (): void => {
    if (disposed) return
    disposed = true
    observer?.disconnect()
    observer = null
  }

  if (typeof ResizeObserver === 'undefined') return stop

  const updateTarget = (): void => {
    if (disposed || !options.target.isConnected) return
    options.retarget(options.target.getBoundingClientRect())
  }

  observer = new ResizeObserver(updateTarget)
  observer.observe(options.target)

  if (options.observeAncestors !== false) {
    const defaultStop = typeof document !== 'undefined' ? document.body : null
    const stopAt = options.stopAt === undefined ? defaultStop : options.stopAt
    let ancestor = options.target.parentElement
    while (ancestor && ancestor !== stopAt) {
      observer.observe(ancestor)
      ancestor = ancestor.parentElement
    }
  }

  options.cleanup.track(stop)
  return stop
}
