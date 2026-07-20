/** 统一登记一个 Session 使用的监听器、RAF 和临时 DOM 清理函数。 */
export type Disposer = () => void

let activeCount = 0

export function getActiveCleanupCount(): number {
  return activeCount
}

export class Cleanup {
  private disposers: Disposer[] = []
  private disposed = false

  track(disposer: Disposer): void {
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
  ): void {
    target.addEventListener(type, listener)
    this.track(() => target.removeEventListener(type, listener))
  }

  trackRaf(id: number): void {
    this.track(() => cancelAnimationFrame(id))
  }

  disposeAll(): void {
    if (this.disposed) return
    this.disposed = true

    const disposers = this.disposers
    this.disposers = []
    const errors: unknown[] = []

    // 清理顺序与登记顺序相反，更符合临时资源的依赖栈。
    for (const dispose of disposers.reverse()) {
      try {
        dispose()
      } catch (error) {
        errors.push(error)
      } finally {
        activeCount--
      }
    }

    if (errors.length > 0) {
      console.error('Cleanup disposal failed', errors)
    }
  }
}
