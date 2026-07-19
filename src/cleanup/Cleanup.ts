/**
 * 统一登记一个 Session 用掉的监听器/RAF/临时 DOM，dispose 时一次性清空。
 * 同时维护一个全局活跃计数，方便 demo/测试里验证"dispose 之后真的清空了"，
 * 而不是靠肉眼确认——见 PLAN.md 阶段 0 验收标准。
 */
export type Disposer = () => void

let activeCount = 0

export function getActiveCleanupCount(): number {
  return activeCount
}

export class Cleanup {
  private disposers: Disposer[] = []
  private disposed = false

  track(disposer: Disposer) {
    if (this.disposed) {
      disposer()
      return
    }
    activeCount++
    this.disposers.push(disposer)
  }

  trackListener<K extends keyof WindowEventMap>(
    target: Window,
    type: K,
    listener: (event: WindowEventMap[K]) => void,
  ) {
    target.addEventListener(type, listener)
    this.track(() => target.removeEventListener(type, listener))
  }

  trackRaf(id: number) {
    this.track(() => cancelAnimationFrame(id))
  }

  disposeAll() {
    if (this.disposed) return
    this.disposed = true
    const disposers = this.disposers
    this.disposers = []
    activeCount -= disposers.length
    disposers.forEach(dispose => dispose())
  }
}
