import type { Cleanup } from '../cleanup/Cleanup'

export interface LandingTargetTrackerOptions {
  cleanup: Cleanup
  target: HTMLElement
  retarget(rect: DOMRect): void
  /** 默认观察 target 到 document.body 之间的祖先尺寸变化。 */
  observeAncestors?: boolean
  /** 祖先观察在这个元素之前停止；默认是 document.body。 */
  stopAt?: HTMLElement | null
  /** 目标稳定后连续多少帧才降低轮询频率，默认 2。 */
  stableFrameLimit?: number
  /** 目标稳定后的轮询间隔，按 rAF 帧数计，默认 4。 */
  idlePollInterval?: number
}

/**
 * landing 期间持续读取真实目标位置，并把布局变化转发给 motion retarget。
 * Observer 既可以在动画完成时主动停止，也会在 Session Cleanup 时自动断开。
 *
 * 使用两种机制检测目标位置变化：
 * 1. ResizeObserver — 检测尺寸变化（卡片宽度/高度因内容变化）
 * 2. rAF 轮询 — 检测 FLIP transform 导致的位移（ResizeObserver 感知不到
 *    transform 变化，兄弟卡 FLIP 位移时目标尺寸不变但屏幕位置变了）
 */
export function trackLandingTarget(options: LandingTargetTrackerOptions): () => void {
  let observer: ResizeObserver | null = null
  let rafId: number | null = null
  let disposed = false
  const stableFrameLimit = Math.max(0, options.stableFrameLimit ?? 2)
  const idlePollInterval = Math.max(1, options.idlePollInterval ?? 4)
  let stableFrames = 0
  let frameCount = 0
  let lastRect: DOMRect | null = null

  const stop = (): void => {
    if (disposed) return
    disposed = true
    if (rafId !== null) cancelAnimationFrame(rafId)
    rafId = null
    observer?.disconnect()
    observer = null
  }

  if (typeof ResizeObserver === 'undefined') return stop

  const updateTarget = (): void => {
    if (disposed || !options.target.isConnected) return
    const rect = options.target.getBoundingClientRect()
    lastRect = rect
    stableFrames = 0
    frameCount = 0
    options.retarget(rect)
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

  // rAF 轮询：感知 FLIP transform 导致的位移。每帧检查目标位置，
  // 与缓存值对比，有变化才 retarget。避免每帧都调用 retarget。
  const poll = (): void => {
    if (disposed) return
    rafId = requestAnimationFrame(poll)
    if (!options.target.isConnected) return
    frameCount += 1
    if (stableFrames >= stableFrameLimit && frameCount % idlePollInterval !== 0) return
    const rect = options.target.getBoundingClientRect()
    if (
      lastRect &&
      Math.abs(rect.left - lastRect.left) < 0.5 &&
      Math.abs(rect.top - lastRect.top) < 0.5 &&
      Math.abs(rect.width - lastRect.width) < 0.5 &&
      Math.abs(rect.height - lastRect.height) < 0.5
    ) {
      stableFrames += 1
      return
    }
    stableFrames = 0
    lastRect = rect
    options.retarget(rect)
  }
  rafId = requestAnimationFrame(poll)

  options.cleanup.track(stop)
  return stop
}
