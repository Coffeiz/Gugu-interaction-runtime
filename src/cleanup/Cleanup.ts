/** 统一登记一个 Session 使用的监听器、RAF、Timer 和临时 DOM 清理函数。 */
export type Disposer = () => void

let activeCount = 0

export function getActiveCleanupCount(): number {
  return activeCount
}

export class Cleanup {
  private disposers: Disposer[] = []
  private disposed = false

  /** 是否已执行清理。 */
  get isDisposed(): boolean {
    return this.disposed
  }

  track(disposer: Disposer): void {
    if (this.disposed) {
      disposer()
      return
    }
    activeCount++
    this.disposers.push(disposer)
  }

  /**
   * 登记 Window 事件监听器。
   * 清理时自动 removeEventListener。
   */
  trackListener<K extends keyof WindowEventMap>(
    target: Window,
    type: K,
    listener: (event: WindowEventMap[K]) => void,
  ): void {
    target.addEventListener(type, listener)
    this.track(() => target.removeEventListener(type, listener))
  }

  /**
   * 登记任意 EventTarget 上的事件监听器。
   * 清理时自动 removeEventListener。
   */
  trackTargetListener(
    target: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions,
  ): void {
    target.addEventListener(type, listener, options)
    this.track(() => target.removeEventListener(type, listener, options))
  }

  /** 登记 requestAnimationFrame ID，清理时自动 cancelAnimationFrame。 */
  trackRaf(id: number): void {
    this.track(() => cancelAnimationFrame(id))
  }

  /** 登记 setTimeout ID，清理时自动 clearTimeout。 */
  trackTimeout(id: number): void {
    this.track(() => clearTimeout(id))
  }

  /** 登记 setInterval ID，清理时自动 clearInterval。 */
  trackInterval(id: number): void {
    this.track(() => clearInterval(id))
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
