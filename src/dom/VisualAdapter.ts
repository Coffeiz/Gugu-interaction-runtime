import type { VisualState, VisualSnapshot } from './VisualAdapterTypes'
import type { MotionProfile } from './MotionProfile'
import { DEFAULT_MOTION_PROFILE } from './MotionProfile'
import {
  concealElement,
  createDragProxy,
  destroyDragProxy,
  landDragProxy,
  revealElement,
} from './Visual'
import { preserveProxyVisualContext } from './ProxyVisualContext'
import { createDetachMoveFromAdapter } from '../runtime/detach/DetachAdapter'
import type { Runtime } from '../Runtime'

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
  private runtime?: Runtime

  constructor(runtime?: Runtime) {
    this.runtime = runtime
  }

  /** 设置/更新 runtime 引用（在 registerObjectType 时自动设置） */
  setRuntime(runtime: Runtime): void {
    this.runtime = runtime
  }

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

  createProxy(context: VisualLifecycleContext): VisualProxy {
    if (!context.sourceElement || !context.sourceRect || !context.beforeContent) {
      throw new Error('visual proxy requires source snapshot')
    }
    const proxy = createDragProxy(context.beforeContent, context.sourceRect)
    preserveProxyVisualContext(context.sourceElement, proxy)
    const snapshot = context.visualSnapshot
    if (snapshot) {
      proxy.style.boxShadow = snapshot.boxShadow
      proxy.style.borderRadius = snapshot.borderRadius
      proxy.style.backgroundColor = snapshot.background
      proxy.style.opacity = snapshot.opacity
      proxy.style.transform = snapshot.transform || 'scale(1.03)'
    }
    return { element: proxy }
  }

  land(proxy: VisualProxy, target: HTMLElement, context: VisualLifecycleContext): Promise<{ completed: boolean; reason?: string }> {
    const el = proxy.element
    if (!context.targetSnapshot?.rect && !target.isConnected) {
      return Promise.resolve({ completed: false, reason: 'target-disconnected' })
    }
    const rawTargetRect = context.targetSnapshot?.rect ?? target.getBoundingClientRect()
    const targetRect = {
      left: rawTargetRect.left ?? rawTargetRect.x,
      top: rawTargetRect.top ?? rawTargetRect.y,
      width: rawTargetRect.width,
      height: rawTargetRect.height,
    }
    concealElement(target, context.sessionId)
    el.style.transition = 'none'
    el.style.width = `${targetRect.width}px`
    el.style.height = `${targetRect.height}px`
    const { finished, retarget } = landDragProxy(el, targetRect, {
      duration: context.motion?.landing?.duration ?? DEFAULT_MOTION_PROFILE.landing.duration,
      targetShadow: context.targetSnapshot?.boxShadow,
      targetRadius: context.targetSnapshot?.borderRadius,
      targetBackground: context.targetSnapshot?.background,
      targetOpacity: context.targetSnapshot?.opacity,
      targetContent: target,
      readTarget: () => target.getBoundingClientRect(),
    })
    if (this.runtime) {
      this.runtime.trackLandingTarget(context.sessionId, target, () => {
        if (context.targetSnapshot?.rect && !target.closest('[data-layout-surface]')) {
          retarget({
            left: context.targetSnapshot.rect.x,
            top: context.targetSnapshot.rect.y,
            width: context.targetSnapshot.rect.width,
            height: context.targetSnapshot.rect.height,
          })
        } else {
          retarget(target.getBoundingClientRect())
        }
      })
    }
    return finished.then(() => ({ completed: true }))
  }

  reveal(_proxy: VisualProxy, target: HTMLElement, context: VisualLifecycleContext): void {
    revealElement(target, context.sessionId)
  }

  dispose(proxy: VisualProxy, context: VisualLifecycleContext): void {
    const el = proxy.element
    proxy.dispose?.()
    destroyDragProxy(el)
  }

  /** 创建 detach 拖拽 move，从 Runtime 注册表自动获取 surface 信息 */
  createMove(context: {
    objectId: string
    element: HTMLElement
    event: PointerEvent
    fromRect?: DOMRect
  }): any {
    const r = this.runtime
    if (!r || !r.objects.hasAbility(context.objectId, 'move')) return {}
    context.event.preventDefault()
    return createDetachMoveFromAdapter({
      runtime: r,
      objectId: context.objectId,
      element: context.element,
      event: context.event,
      fromRect: context.fromRect,
    })
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
