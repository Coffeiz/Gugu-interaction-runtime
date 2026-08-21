import type { Cleanup } from '../cleanup/Cleanup'
import {
  hasActiveHeightAnimationInAncestors,
  hasActiveRafLayoutAnimations,
  readRafVisualOffset,
} from './RafLayoutAnimator'
import { readLatestLayoutGeometry, subscribeLayoutGeometry } from './LayoutMeasurement'

export interface LandingTargetTrackerOptions {
  cleanup: Cleanup
  target: HTMLElement
  retarget(rect: DOMRect): void
  /** 已在 landing 初始化阶段读取过的视觉矩形；避免 tracker 再做一次首帧布局读取。 */
  initialRect?: DOMRect
  /** 默认观察 target 到 document.body 之间的祖先尺寸变化。 */
  observeAncestors?: boolean
  /** 祖先观察在这个元素之前停止；默认是 document.body。 */
  stopAt?: HTMLElement | null
  /** 目标稳定后连续多少帧才降低 DOM fallback 轮询频率，默认 2。 */
  stableFrameLimit?: number
  /** 目标稳定后的 DOM fallback 轮询间隔，按 rAF 帧数计，默认 4。 */
  idlePollInterval?: number
}

function sameRect(left: DOMRect, right: DOMRect): boolean {
  return Math.abs(left.left - right.left) < 0.5
    && Math.abs(left.top - right.top) < 0.5
    && Math.abs(left.width - right.width) < 0.5
    && Math.abs(left.height - right.height) < 0.5
}

function copyRect(rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>): DOMRect {
  return new DOMRect(rect.left, rect.top, rect.width, rect.height)
}

/**
 * landing 期间追踪真实目标的位置变化。
 *
 * Runtime 自己的 FLIP / Surface resize 不再通过每帧 getBoundingClientRect()
 * 反读：RafLayoutAnimator 已经持有相同的 easing、起点和时钟。target 或祖先
 * 有 FLIP translation 时直接计算 visual rect；Runtime 其它布局动画仍在进行
 * 时暂停 DOM fallback，等整笔 Runtime 动画结束后只做一次 reconcile。
 *
 * 关键区别是："其它 Runtime 动画 active"不再等价于"这个 target 没变化"。
 * LayoutMeasurement 会把 Runtime 本来就要做的真实测量按 element 发布；并发
 * transaction 如果确实改变了当前 landing target，tracker 在下一帧消费新
 * final rect，并继续叠加 Runtime 已知的 FLIP trajectory。这样恢复即时 retarget，
 * 同时不恢复旧的逐帧 DOM polling。
 */
export function trackLandingTarget(options: LandingTargetTrackerOptions): () => void {
  let observer: ResizeObserver | null = null
  let rafId: number | null = null
  let disposed = false
  const stableFrameLimit = Math.max(0, options.stableFrameLimit ?? 2)
  const idlePollInterval = Math.max(1, options.idlePollInterval ?? 4)
  let stableFrames = 0
  let frameCount = 0
  let lastRect: DOMRect | null = options.initialRect ? copyRect(options.initialRect) : null
  // finalRect 是去掉 Runtime active FLIP translation 后的最终布局矩形。
  let finalRect: DOMRect | null = null
  let runtimeLayoutWasActive = false
  let pendingObserverReconcile = false
  let pendingGeometryRevision = false
  let lastGeometrySequence = readLatestLayoutGeometry(options.target)?.sequence ?? 0
  let stopGeometrySubscription: (() => void) | null = null

  const stop = (): void => {
    if (disposed) return
    disposed = true
    if (rafId !== null) cancelAnimationFrame(rafId)
    rafId = null
    observer?.disconnect()
    observer = null
    stopGeometrySubscription?.()
    stopGeometrySubscription = null
  }

  const commitRect = (rect: DOMRect): void => {
    if (lastRect && sameRect(lastRect, rect)) {
      stableFrames += 1
      return
    }
    stableFrames = 0
    lastRect = rect
    options.retarget(rect)
  }

  const updateFinalRect = (rect: DOMRect, time = performance.now()): void => {
    const offset = readRafVisualOffset(options.target, time)
    finalRect = new DOMRect(
      rect.left - (offset?.x ?? 0),
      rect.top - (offset?.y ?? 0),
      rect.width,
      rect.height,
    )
  }

  // VisualAdapter 通常已经在同一 landing 初始化任务里读过一次 target rect。
  // 如果当时 FLIP 已经 active，把当前视觉位移扣掉即可得到最终布局 rect，
  // 后续整个 Runtime 布局动画周期都不需要再同步测量 DOM。
  if (lastRect) updateFinalRect(lastRect)

  // 精确订阅当前 target。事件只来自 Runtime 已经执行的 LayoutMeasurement，
  // 因而不会为了 invalidation 新增 DOM read。回调里也不直接 retarget：GroupLayout
  // 的 measure phase 发生在 Invert 写入之前，等下一 rAF 后新的 FLIP state 已登记，
  // 此时再用 finalRect + trajectory(t) 才与屏幕上真实目标完全一致。
  stopGeometrySubscription = subscribeLayoutGeometry(options.target, revision => {
    if (disposed || revision.sequence <= lastGeometrySequence) return
    lastGeometrySequence = revision.sequence
    updateFinalRect(revision.rect)
    pendingGeometryRevision = true
    frameCount = 0
  })

  if (typeof ResizeObserver === 'undefined') {
    options.cleanup.track(stop)
    return stop
  }

  const measureTarget = (time = performance.now()): void => {
    if (disposed || !options.target.isConnected) return
    const rect = options.target.getBoundingClientRect()
    updateFinalRect(rect, time)
    frameCount = 0
    pendingObserverReconcile = false
    commitRect(rect)
  }

  const updateTarget = (): void => {
    if (disposed || !options.target.isConnected) return
    // Runtime-owned Surface resize / FLIP 自己就会触发祖先 ResizeObserver。
    // 这类通知不能再反过来同步读 target geometry，否则会重新形成每帧
    // Runtime write → observer → gBCR 的反馈链。结束后 poll 会统一 reconcile。
    if (hasActiveRafLayoutAnimations()) {
      pendingObserverReconcile = true
      runtimeLayoutWasActive = true
      return
    }
    measureTarget()
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

  const poll = (time: number): void => {
    if (disposed) return
    rafId = requestAnimationFrame(poll)
    if (!options.target.isConnected) return

    const offset = readRafVisualOffset(options.target, time)
    const runtimeLayoutActive = hasActiveRafLayoutAnimations()
    const heightLayoutActive = hasActiveHeightAnimationInAncestors(options.target)

    // Surface height 动画会让垂直居中的抽屉内容发生真实 reflow；这类位置变化
    // 不存在可由 Runtime 轨迹推导的 transform offset。只对当前 landing target
    // 的祖先链命中 height state 时逐帧读取，普通 FLIP 仍保持零 DOM polling。
    if (heightLayoutActive) {
      runtimeLayoutWasActive = true
      measureTarget(time)
      return
    }

    // A concurrent layout transaction measured this exact target after changing layout.
    // Consume the latest revision at most one frame later. If the new transaction also
    // started a FLIP on target/ancestor, compose that freshly registered trajectory now.
    if (pendingGeometryRevision) {
      pendingGeometryRevision = false
      if (runtimeLayoutActive) runtimeLayoutWasActive = true
      if (finalRect) {
        frameCount = 0
        commitRect(offset
          ? new DOMRect(
              finalRect.left + offset.x,
              finalRect.top + offset.y,
              finalRect.width,
              finalRect.height,
            )
          : copyRect(finalRect))
      }
      return
    }

    if (offset) {
      runtimeLayoutWasActive = true
      // Runtime-owned motion：只做数学计算，不触发布局。
      if (!finalRect) {
        // custom adapter 没提供 initialRect 时只允许首帧兜底读一次；一旦
        // finalRect 建立，后续 active FLIP 都完全走已知轨迹。
        const rect = options.target.getBoundingClientRect()
        updateFinalRect(rect, time)
      }
      if (finalRect) {
        frameCount = 0
        commitRect(new DOMRect(
          finalRect.left + offset.x,
          finalRect.top + offset.y,
          finalRect.width,
          finalRect.height,
        ))
      }
      return
    }

    if (runtimeLayoutActive) {
      runtimeLayoutWasActive = true
      // target 自身可能没有 transform（例如刚挂载的新 landing target），但
      // 其它 sibling FLIP / Surface resize 仍属于 Runtime layout work。未知变化
      // 继续禁止 DOM polling；若其它 transaction 真改变了本 target，上面的
      // LayoutMeasurement revision 会精确唤醒它。
      if (!finalRect) measureTarget(time)
      else if (!lastRect || !sameRect(lastRect, finalRect)) commitRect(copyRect(finalRect))
      frameCount = 0
      return
    }

    // Runtime-owned 动画刚结束后只做一次真实 DOM reconcile。这样既能吸收
    // Surface resize 等非 translation 可能造成的最终布局差异，也不会在动画
    // 期间逐帧把 compositor 工作拖回 Style/Layout。
    if (runtimeLayoutWasActive || pendingObserverReconcile) {
      runtimeLayoutWasActive = false
      measureTarget(time)
      return
    }

    frameCount += 1
    if (stableFrames >= stableFrameLimit && frameCount % idlePollInterval !== 0) return
    measureTarget(time)
  }
  rafId = requestAnimationFrame(poll)

  options.cleanup.track(stop)
  return stop
}
