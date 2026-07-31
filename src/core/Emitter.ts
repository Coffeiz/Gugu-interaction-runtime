export type Listener<T> = (event: T) => void | Promise<void>

/** Core 使用的最小同步事件发射器，不依赖任何 UI 框架。 */
export class Emitter<T> {
  private listeners = new Set<Listener<T>>()

  subscribe(listener: Listener<T>): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  emit(event: T): void {
    this.listeners.forEach(listener => listener(event))
  }

  /**
   * 与同步广播保持并存的事务广播。业务可以返回框架渲染完成的 Promise，
   * 让调用方在读取新 DOM 前等待；没有返回值的既有订阅仍然是同步兼容的。
   */
  async emitAsync(event: T): Promise<void> {
    await Promise.all([...this.listeners].map(listener => Promise.resolve(listener(event))))
  }
}
