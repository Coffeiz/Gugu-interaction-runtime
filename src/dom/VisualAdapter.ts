import type { VisualState, VisualSnapshot } from './VisualAdapterTypes'
import type { MotionProfile } from './MotionProfile'
import type { MotionState } from '../motion/CardMotionController'
import { DEFAULT_MOTION_PROFILE } from './MotionProfile'
import { DEFAULT_COAST_FRICTION, DEFAULT_RELEASE_PROFILE } from '../motion/ReleaseMotion'
import {
  concealElement,
  createDragProxy,
  destroyDragProxy,
  landDragProxyLegacy,
  landDragProxyWithMotion,
  getProxyAttitude,
  getProxyContent,
  applyDraggingGlassStyle,
  isDefaultDraggingGlassEnabled,
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
  /** 是否由 Runtime 内置 MotionController 驱动 landing；默认开启。 */
  readonly motionEnabled?: boolean
  /** grabbing 结束时冻结的运动状态，用于 landing 继承释放速度。 */
  readonly motionState?: Pick<MotionState, 'x' | 'y' | 'vx' | 'vy' | 'scaleX' | 'scaleY' | 'rotateX' | 'rotateZ'>
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
    // 默认策略只认 ObjectStore 中由 useObject()/objects.setElement() 注册的真实节点。
    // data-card 是早期看板 demo 的调试标记，不能成为业务接入的生命周期依赖。
    return this.runtime?.objects.get(objectId)?.element ?? null
  }

  resolveTarget(objectId: string): HTMLElement | null {
    const element = this.runtime?.objects.get(objectId)?.element ?? null
    if (!element?.isConnected || element.dataset.runtimeProxy === 'true') return null
    const rect = element.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0 ? element : null
  }

  captureVisualState(element: HTMLElement): VisualSnapshot {
    const style = getComputedStyle(element)
    return {
      rect: element.getBoundingClientRect(),
      borderRadius: style.borderRadius,
      boxShadow: style.boxShadow,
      background: style.backgroundColor,
      backgroundImage: style.backgroundImage,
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
    const content = getProxyContent(proxy)
    preserveProxyVisualContext(context.sourceElement, content)
    const snapshot = context.visualSnapshot
    if (snapshot) {
      content.style.boxShadow = snapshot.boxShadow
      content.style.borderRadius = snapshot.borderRadius
      content.style.backgroundColor = snapshot.background
      if (snapshot.backgroundImage && snapshot.backgroundImage !== 'none') {
        content.style.backgroundImage = snapshot.backgroundImage
      }
      content.style.opacity = snapshot.opacity
      getProxyAttitude(proxy).style.transform = 'scale(1.03)'
    }
    if (isDefaultDraggingGlassEnabled()) applyDraggingGlassStyle(content)
    // 业务卡片常把操作按钮做成默认 opacity:0、hover 时显示；proxy 是
    // pointer-events:none 的克隆，永远没有 hover 态，按钮会保持透明。
    // 抓取时应保留原卡片的完整样式（按钮可见），这里把 hover 才显示
    // 的子元素强制置为可见。
    content.querySelectorAll<HTMLElement>('[class]').forEach(el => {
      const computed = getComputedStyle(el)
      if (computed.opacity === '0' && computed.pointerEvents === 'none') {
        el.style.opacity = '1'
      }
    })
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
    // 先把代理的布局尺寸切到目标 border box；landing 的内容层和目标卡片
    // 以这个尺寸进行布局，运动控制器只负责连续地过渡到该尺寸。
    el.style.width = `${targetRect.width}px`
    el.style.height = `${targetRect.height}px`
    const land = context.motionEnabled === false ? landDragProxyLegacy : landDragProxyWithMotion
    const { finished, retarget } = land(el, targetRect, {
      duration: context.motion?.landing?.duration ?? DEFAULT_MOTION_PROFILE.landing.duration,
      targetShadow: context.targetSnapshot?.boxShadow,
      targetRadius: context.targetSnapshot?.borderRadius,
      targetBackground: context.targetSnapshot?.background,
      targetBackgroundImage: context.targetSnapshot?.backgroundImage,
      targetOpacity: context.targetSnapshot?.opacity,
      targetContent: target,
      readTarget: () => target.getBoundingClientRect(),
      motionState: context.motionState,
      coast: {
        duration: DEFAULT_RELEASE_PROFILE.coastSeconds,
        friction: DEFAULT_COAST_FRICTION,
        maxDistance: DEFAULT_RELEASE_PROFILE.maxCoast,
        minVelocity: DEFAULT_RELEASE_PROFILE.minVelocity,
      },
      releaseDamping: DEFAULT_RELEASE_PROFILE.dampingRatio,
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
    returnRect?: DOMRect
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
      returnRect: context.returnRect,
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
