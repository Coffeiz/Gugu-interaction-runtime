import type { Cleanup } from '../cleanup/Cleanup'

export interface LandingTargetTrackerOptions {
  readonly observeAncestors?: boolean
  readonly trackScroll?: boolean
  readonly trackAnimationFrame?: boolean
  readonly changeThreshold?: number
  readonly cleanup?: Cleanup
}

function rectChanged(previous: DOMRect, next: DOMRect, threshold: number): boolean {
  return Math.abs(previous.left - next.left) > threshold
    || Math.abs(previous.top - next.top) > threshold
    || Math.abs(previous.width - next.width) > threshold
    || Math.abs(previous.height - next.height) > threshold
}

/**
 * landing 期间持续重新测量真实目标位置。
 *
 * ResizeObserver 覆盖尺寸变化；scroll capture 与轻量 RAF 几何检查覆盖滚动、
 * transform、sticky 和 FLIP 等“尺寸不变但屏幕坐标变化”的情况。只有 rect 真正
 * 改变时才调用 retarget，避免每帧重复改写动画目标。
 */
export function trackLandingTarget(
  target: HTMLElement,
  retarget: (rect: DOMRect) => void,
  options: LandingTargetTrackerOptions = {},
): () => void {
  const threshold = options.changeThreshold ?? 0.25
  let disposed = false
  let frameId: number | null = null
  let observer: ResizeObserver | null = null
  let lastRect = target.getBoundingClientRect()

  const measure = () => {
    if (disposed || !target.isConnected) return
    const nextRect = target.getBoundingClientRect()
    if (!rectChanged(lastRect, nextRect, threshold)) return
    lastRect = nextRect
    retarget(nextRect)
  }

  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(measure)
    observer.observe(target)

    if (options.observeAncestors !== false) {
      let ancestor = target.parentElement
      const body = typeof document !== 'undefined' ? document.body : null
      while (ancestor && ancestor !== body) {
        observer.observe(ancestor)
        ancestor = ancestor.parentElement
      }
    }
  }

  const scrollTarget = typeof window !== 'undefined' ? window : null
  const onScroll = () => measure()
  if (scrollTarget && options.trackScroll !== false) {
    // scroll 不冒泡，使用 capture 才能覆盖内部滚动容器。
    scrollTarget.addEventListener('scroll', onScroll, true)
  }

  const runFrame = () => {
    if (disposed) return
    measure()
    frameId = requestAnimationFrame(runFrame)
  }
  if (options.trackAnimationFrame !== false && typeof requestAnimationFrame === 'function') {
    frameId = requestAnimationFrame(runFrame)
  }

  const dispose = () => {
    if (disposed) return
    disposed = true
    observer?.disconnect()
    observer = null
    if (scrollTarget && options.trackScroll !== false) {
      scrollTarget.removeEventListener('scroll', onScroll, true)
    }
    if (frameId !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(frameId)
      frameId = null
    }
  }

  options.cleanup?.track(dispose)
  return dispose
}
