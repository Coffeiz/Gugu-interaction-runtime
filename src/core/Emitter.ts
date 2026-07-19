export type Listener<T> = (event: T) => void

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
}
