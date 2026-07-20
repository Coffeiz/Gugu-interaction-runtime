import type { Cleanup } from '../cleanup/Cleanup'

export interface LandingTargetTrackerOptions {
  readonly observeAncestors?: boolean
  readonly cleanup?: Cleanup
}

/**
 * landing 期间持续重新测量真实目标位置。
 * 业务只提供 target 与 retarget，ResizeObserver 的祖先监听、幂等断开和
 * Session Cleanup 绑定由 Runtime 层统一处理。
 */
export function trackLandingTarget(
  target: HTMLElement,
  retarget: (rect: DOMRect) => void,
  options: LandingTargetTrackerOptions = {},
): () => void {
  if (typeof ResizeObserver === 'undefined') return () => undefined

  let disposed = false
  const observer = new ResizeObserver(() => {
    if (disposed || !target.isConnected) return
    retarget(target.getBoundingClientRect())
  })
  observer.observe(target)

  if (options.observeAncestors !== false) {
    let ancestor = target.parentElement
    while (ancestor && ancestor !== document.body) {
      observer.observe(ancestor)
      ancestor = ancestor.parentElement
    }
  }

  const dispose = () => {
    if (disposed) return
    disposed = true
    observer.disconnect()
  }
  options.cleanup?.track(dispose)
  return dispose
}
