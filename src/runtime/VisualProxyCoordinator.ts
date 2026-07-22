import type { VisualProxy } from '../dom/VisualAdapter'

/** 维护每个 Session 的唯一视觉代理引用，不负责运动参数。 */
export class VisualProxyCoordinator {
  private readonly proxies = new Map<string, VisualProxy>()

  register(sessionId: string, proxy: VisualProxy): void {
    this.proxies.get(sessionId)?.dispose?.()
    this.proxies.set(sessionId, proxy)
  }

  get(sessionId: string): VisualProxy | undefined { return this.proxies.get(sessionId) }

  remove(sessionId: string): VisualProxy | undefined {
    const proxy = this.proxies.get(sessionId)
    this.proxies.delete(sessionId)
    return proxy
  }
}
