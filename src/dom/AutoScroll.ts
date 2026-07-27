import type { Cleanup } from '../cleanup/Cleanup'

export interface AutoScrollOptions {
  /** 触发滚动的边缘距离阈值（px）。默认 48。 */
  edgeSize?: number
  /** 贴边时的最大滚动速度（px/frame）。默认 16。 */
  maxSpeed?: number
  /**
   * 每次实际发生滚动后调用，携带触发滚动时的指针坐标。
   * 指针贴边静止不动时，容器内容仍会持续滚动，调用方应据此重新计算命中/
   * 落点索引，否则命中结果会停留在自动滚动开始前的旧值上。
   */
  onScroll?(point: { x: number; y: number }): void
}

export interface AutoScrollController {
  /** 每次命中判定后调用，更新当前命中的容器与指针位置。 */
  update(container: HTMLElement | null, point: { x: number; y: number }): void
  /** 停止自动滚动，取消 rAF 循环。 */
  stop(): void
}

/**
 * 拖拽期间指针贴近可滚动容器（Surface）上下边缘时持续自动滚动，
 * 让超出可视区域的落点滚动进来（类似 Trello 的拖拽自动滚屏）。
 *
 * 滚动速度由 rAF 循环驱动、不依赖 pointermove 持续触发——指针静止贴边时
 * 也会持续滚动。跟随 Session 生命周期，登记到传入的 Cleanup 上自动停止。
 */
export function createAutoScroller(cleanup: Cleanup, options: AutoScrollOptions = {}): AutoScrollController {
  const edgeSize = options.edgeSize ?? 48
  const maxSpeed = options.maxSpeed ?? 16

  let container: HTMLElement | null = null
  let point: { x: number; y: number } | null = null
  let rafId: number | null = null
  let stopped = false

  const speedFor = (distanceToEdge: number): number => {
    const ratio = (edgeSize - distanceToEdge) / edgeSize
    return Math.ceil(maxSpeed * ratio)
  }

  const tick = (): void => {
    if (stopped) return
    rafId = requestAnimationFrame(tick)
    if (!container || !point || !container.isConnected) return
    const rect = container.getBoundingClientRect()
    if (point.x < rect.left || point.x > rect.right) return

    const distanceToTop = point.y - rect.top
    const distanceToBottom = rect.bottom - point.y
    if (distanceToTop < edgeSize) {
      container.scrollTop -= speedFor(distanceToTop)
      options.onScroll?.(point)
    } else if (distanceToBottom < edgeSize) {
      container.scrollTop += speedFor(distanceToBottom)
      options.onScroll?.(point)
    }
  }

  const stop = (): void => {
    if (stopped) return
    stopped = true
    if (rafId !== null) cancelAnimationFrame(rafId)
    rafId = null
  }

  rafId = requestAnimationFrame(tick)
  cleanup.track(stop)

  return {
    update(nextContainer, nextPoint) {
      if (stopped) return
      container = nextContainer
      point = nextPoint
    },
    stop,
  }
}
