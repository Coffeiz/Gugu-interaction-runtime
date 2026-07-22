import { captureLayoutFlip, scheduleLayoutFlip } from '../dom/GroupLayout'
import type { LandingResult, MoveBehaviorDriver } from '../behavior/MoveBehavior'

/**
 * Runtime 的 detach 编排原语。
 *
 * 视觉代理仍由业务 VisualAdapter 提供；这里仅负责把 pointer 更新、落点
 * 解析和布局 FLIP 接到 MoveBehavior，避免业务入口重复维护这段顺序。
 */
export function createDetachMoveDriver(
  onMove: (event: PointerEvent) => void,
  onRelease: () => { columnId: string; index: number } | null,
): MoveBehaviorDriver {
  return {
    update: (_context, input) => {
      if (input.event instanceof PointerEvent) onMove(input.event)
    },
    resolveDestination: () => {
      const drop = onRelease()
      return drop ? { accepted: true, destination: drop } : { accepted: false }
    },
    commit: () => undefined,
  }
}

export function createDetachLayoutLifecycle(sourceEl: HTMLElement) {
  return {
    capture: () => captureLayoutFlip(
      Array.from(document.querySelectorAll<HTMLElement>('[data-card]'))
        .filter(el => el !== sourceEl && el.dataset.runtimeProxy !== 'true'),
    ),
    play: (_context: unknown, snapshot: unknown) => {
      scheduleLayoutFlip(snapshot as ReturnType<typeof captureLayoutFlip>)
    },
  }
}
