import type { VisualLifecycleContext, VisualProxy, VisualAdapter } from '../dom/VisualAdapter'
import type { Session } from '../session/Session'
import { VisualProxyCoordinator } from './VisualProxyCoordinator'

export interface VisualMotionPort {
  getSession(id: string): Session | undefined
  getAdapter(objectId: string): VisualAdapter
  createContext(id: string, destination?: unknown, target?: HTMLElement): VisualLifecycleContext
}

/** VisualProxy 的 create/update/land/reveal 调度，不负责代理索引本身。 */
export class VisualMotionCoordinator {
  constructor(private readonly port: VisualMotionPort, private readonly proxies: VisualProxyCoordinator) {}

  create(sessionId: string, context: VisualLifecycleContext): VisualProxy | undefined {
    const session = this.port.getSession(sessionId)
    if (!session) return undefined
    const proxy = this.port.getAdapter(session.objectId).createProxy?.(context)
    if (!proxy) return undefined
    this.proxies.register(sessionId, proxy)
    return proxy
  }

  async land(sessionId: string, target: HTMLElement, context?: VisualLifecycleContext) {
    const session = this.port.getSession(sessionId)
    const proxy = this.proxies.get(sessionId)
    if (!session || !proxy) return { completed: false, reason: 'visual-proxy-missing' }
    const lifecycleContext = context ?? this.port.createContext(sessionId, undefined, target)
    return await this.port.getAdapter(session.objectId).land?.(proxy, target, lifecycleContext)
      ?? { completed: true }
  }

  update(sessionId: string, context?: VisualLifecycleContext): void {
    const session = this.port.getSession(sessionId)
    const proxy = this.proxies.get(sessionId)
    if (!session || !proxy) return
    this.port.getAdapter(session.objectId).updateProxy?.(proxy, context ?? this.port.createContext(sessionId))
  }

  async reveal(sessionId: string, target: HTMLElement, context?: VisualLifecycleContext): Promise<void> {
    const session = this.port.getSession(sessionId)
    const proxy = this.proxies.get(sessionId)
    if (!session || !proxy) return
    await this.port.getAdapter(session.objectId).reveal?.(proxy, target, context ?? this.port.createContext(sessionId, undefined, target))
  }
}
