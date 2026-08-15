import { DefaultVisualAdapter, type VisualAdapter, type VisualLifecycleContext, type VisualProxy } from '../dom/VisualAdapter'
import type { VisualState } from '../dom/VisualAdapterTypes'
import { trackLandingTarget, type LandingTargetTrackerOptions } from '../dom/LandingTargetTracker'
import type { Cleanup } from '../cleanup/Cleanup'
import type { Session } from '../session/Session'
import type { LandingRect } from '../dom/Visual'

export interface VisualStatePort { getAdapter(objectId: string): VisualAdapter }

export class VisualStateCoordinator {
  constructor(private readonly port: VisualStatePort) {}
  resolveTarget(objectId: string, destination: unknown): HTMLElement | null {
    const target = this.port.getAdapter(objectId).resolveTarget?.(objectId, destination)
      ?? new DefaultVisualAdapter().resolveTarget(objectId)
    return target?.isConnected ? target : null
  }
  apply(objectId: string, element: HTMLElement, state: VisualState): void {
    const adapter = this.port.getAdapter(objectId)
    ;(adapter.applyState ?? new DefaultVisualAdapter().applyState)(element, state)
  }
  capture(objectId: string, element: HTMLElement) {
    const adapter = this.port.getAdapter(objectId)
    return (adapter.captureVisualState ?? new DefaultVisualAdapter().captureVisualState)(element)
  }
  trackTarget(cleanup: Cleanup, target: HTMLElement, retarget: (rect: DOMRect) => void,
    options: Omit<LandingTargetTrackerOptions, 'cleanup' | 'target' | 'retarget'> = {}): () => void {
    return trackLandingTarget({ ...options, cleanup, target, retarget })
  }
}

export class VisualProxyCoordinator {
  private readonly proxies = new Map<string, VisualProxy>()
  register(sessionId: string, proxy: VisualProxy): void {
    this.proxies.set(sessionId, proxy)
  }
  get(sessionId: string): VisualProxy | undefined { return this.proxies.get(sessionId) }
  remove(sessionId: string): VisualProxy | undefined {
    const proxy = this.proxies.get(sessionId)
    this.proxies.delete(sessionId)
    return proxy
  }
}

export interface VisualMotionPort {
  getSession(id: string): Session | undefined
  getAdapter(objectId: string): VisualAdapter
  getGroupAdapter?(objectId: string): VisualAdapter | undefined
  createContext(id: string, destination?: unknown, target?: HTMLElement | LandingRect): VisualLifecycleContext
}

export class VisualMotionCoordinator {
  constructor(private readonly port: VisualMotionPort, private readonly proxies: VisualProxyCoordinator) {}
  private getAdapter(session: Session, context?: VisualLifecycleContext): VisualAdapter {
    if (context?.group) return this.port.getGroupAdapter?.(session.objectId) ?? this.port.getAdapter(session.objectId)
    return this.port.getAdapter(session.objectId)
  }
  create(sessionId: string, context: VisualLifecycleContext): VisualProxy | undefined {
    const session = this.port.getSession(sessionId)
    if (!session) return undefined
    const proxy = this.getAdapter(session, context).createProxy?.(context)
    if (!proxy) return undefined
    this.proxies.register(sessionId, proxy)
    return proxy
  }
  async land(
    sessionId: string,
    target: HTMLElement | LandingRect,
    context?: VisualLifecycleContext,
  ): Promise<{ completed: boolean; reason?: string }> {
    const session = this.port.getSession(sessionId)
    const proxy = this.proxies.get(sessionId)
    if (!session || !proxy) return { completed: false, reason: 'visual-proxy-missing' }
    const lifecycleContext = context ?? this.port.createContext(sessionId, undefined, target)
    const result = await this.getAdapter(session, lifecycleContext).land?.(proxy, target, lifecycleContext)
    if (!result) return { completed: true }
    return result
  }
  update(sessionId: string, context?: VisualLifecycleContext): void {
    const session = this.port.getSession(sessionId)
    const proxy = this.proxies.get(sessionId)
    if (!session || !proxy) return
    const lifecycleContext = context ?? this.port.createContext(sessionId)
    this.getAdapter(session, lifecycleContext).updateProxy?.(proxy, lifecycleContext)
  }
  async reveal(sessionId: string, target: HTMLElement, context?: VisualLifecycleContext): Promise<void> {
    const session = this.port.getSession(sessionId)
    const proxy = this.proxies.get(sessionId)
    if (!session || !proxy) return
    const lifecycleContext = context ?? this.port.createContext(sessionId, undefined, target)
    await this.getAdapter(session, lifecycleContext).reveal?.(proxy, target, lifecycleContext)
  }
}
