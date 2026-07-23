import type { VisualState, VisualSnapshot } from './VisualAdapterTypes'
import type { MotionProfile } from './MotionProfile'

export interface VisualLifecycleContext {
  readonly objectId: string
  readonly sessionId: string
  readonly mode: string
  readonly destination?: unknown
  readonly sourceElement?: HTMLElement
  /** 抓取开始时冻结的内容快照；仅供视觉代理使用，不承载业务状态。 */
  readonly beforeContent?: HTMLElement
  readonly targetElement?: HTMLElement
  readonly sourceRect?: DOMRect
  readonly visualSnapshot?: VisualSnapshot
  readonly targetSnapshot?: VisualSnapshot
  /** 对象类型注册的 MotionProfile；adapter 可用此覆盖 landing 速度。 */
  readonly motion?: MotionProfile
}

export interface VisualProxy {
  readonly element: HTMLElement
  dispose?(): void
}

/** 业务可选覆盖的视觉适配器；未提供的方法由 Runtime 默认实现补齐。 */
export interface VisualAdapter {
  resolveSource?(objectId: string): HTMLElement | null
  resolveTarget?(objectId: string, destination: unknown): HTMLElement | null
  captureVisualState?(element: HTMLElement): VisualSnapshot
  applyState?(element: HTMLElement, state: VisualState): void
  createProxy?(context: VisualLifecycleContext): VisualProxy
  updateProxy?(proxy: VisualProxy, context: VisualLifecycleContext): void
  land?(proxy: VisualProxy, target: HTMLElement, context: VisualLifecycleContext): void | Promise<{ completed: boolean; reason?: string }>
  reveal?(proxy: VisualProxy, target: HTMLElement, context: VisualLifecycleContext): void | Promise<void>
  dispose?(proxy: VisualProxy, context: VisualLifecycleContext): void
}

export interface VisualAdapterRegistry {
  register(type: string, adapter: VisualAdapter): void
  get(type: string): VisualAdapter | undefined
  remove(type: string): void
}

export class DefaultVisualAdapter implements VisualAdapter {
  resolveSource(objectId: string): HTMLElement | null {
    return document.querySelector<HTMLElement>(`[data-card="${CSS.escape(objectId)}"]`)
  }

  resolveTarget(objectId: string): HTMLElement | null {
    return Array.from(document.querySelectorAll<HTMLElement>(`[data-card="${CSS.escape(objectId)}"]`))
      .filter(element => element.dataset.runtimeProxy !== 'true' && element.isConnected && element.closest('[data-layout-surface]') !== null)
      .find(element => {
        const rect = element.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0
      }) ?? null
  }

  captureVisualState(element: HTMLElement): VisualSnapshot {
    const style = getComputedStyle(element)
    return {
      rect: element.getBoundingClientRect(),
      borderRadius: style.borderRadius,
      boxShadow: style.boxShadow,
      background: style.backgroundColor,
      opacity: style.opacity,
      transform: style.transform,
    }
  }

  applyState(element: HTMLElement, state: VisualState): void {
    element.dataset.runtimePhase = state.phase
    element.classList.toggle('is-hovered', state.hovered)
    element.classList.toggle('is-grabbed', state.grabbed)
    element.classList.toggle('is-selected', state.selected)
  }
}

export class VisualAdapters implements VisualAdapterRegistry {
  private readonly adapters = new Map<string, VisualAdapter>()

  register(type: string, adapter: VisualAdapter): void {
    this.adapters.set(type, adapter)
  }

  get(type: string): VisualAdapter | undefined {
    return this.adapters.get(type)
  }

  remove(type: string): void {
    this.adapters.delete(type)
  }
}
