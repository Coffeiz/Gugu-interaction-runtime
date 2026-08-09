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
  clampLandingRectToBounds,
  type LandingRect,
} from './Visual'
import { preserveProxyVisualContext } from './ProxyVisualContext'
import { createCloneMoveFromAdapter, createDetachMoveFromAdapter } from '../runtime/detach/DetachAdapter'
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
  /** 目标节点作为语义落点时保留其可见性，避免与源代理发生双重交接。 */
  readonly preserveTarget?: boolean
  /** default 保持普通 landing；target 到达语义目标后追加缩小淡出。 */
  readonly landingMode?: 'default' | 'target'
  readonly sourceRect?: DOMRect
  readonly visualSnapshot?: VisualSnapshot
  readonly targetSnapshot?: VisualSnapshot
  /** 对象类型注册的 MotionProfile；adapter 可用此覆盖 landing 速度。 */
  readonly motion?: MotionProfile
  /** 是否由 Runtime 内置 MotionController 驱动 landing；默认开启。 */
  readonly motionEnabled?: boolean
  /** landing 视觉目标所在 Surface 的 viewport 边界。 */
  readonly landingBounds?: () => DOMRect | null
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
  /** 完整销毁代理；实现该回调后由 adapter 负责调用 proxy.dispose（如有）。 */
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
    const rawLandingRect = {
      left: rawTargetRect.left ?? rawTargetRect.x,
      top: rawTargetRect.top ?? rawTargetRect.y,
      width: rawTargetRect.width,
      height: rawTargetRect.height,
    }
    const clampTarget = (rect: LandingRect): LandingRect => {
      const bounds = context.landingBounds?.()
      return bounds ? clampLandingRectToBounds(rect, bounds) : rect
    }
    const targetRect = clampTarget(rawLandingRect)
    if (!context.preserveTarget) concealElement(target, context.sessionId)
    el.style.transition = 'none'
    const isTargetLanding = context.landingMode === 'target'
    const targetSnapshot = context.targetSnapshot
    const targetHasSurfaceStyle = Boolean(targetSnapshot && (
      (targetSnapshot.background && targetSnapshot.background !== 'transparent' && targetSnapshot.background !== 'rgba(0, 0, 0, 0)')
      || (targetSnapshot.backgroundImage && targetSnapshot.backgroundImage !== 'none')
      || (targetSnapshot.boxShadow && targetSnapshot.boxShadow !== 'none')
    ))
    const landingProfile = context.landingMode === 'target'
      ? context.motion?.target?.landing ?? context.motion?.landing
      : context.motion?.landing
    // 普通 landing 需要沿用目标 border box 的布局尺寸；语义目标不能在
    // 松手瞬间切成面包屑/侧栏按钮的窄高度，否则源卡片会先被裁掉，视觉上
    // 像是向目标下方跳了一段。语义目标的缩小由 target dismiss 的 scale
    // 动画统一接管，代理在运动期间保留源卡片尺寸。
    if (!isTargetLanding) {
      el.style.width = `${targetRect.width}px`
      el.style.height = `${targetRect.height}px`
    }
    const land = context.motionEnabled === false ? landDragProxyLegacy : landDragProxyWithMotion
    const { finished, retarget } = land(el, targetRect, {
      duration: landingProfile?.duration ?? DEFAULT_MOTION_PROFILE.landing.duration,
      easing: landingProfile?.easing ?? DEFAULT_MOTION_PROFILE.landing.easing,
      // 面包屑是透明文本节点，只提供位置和消失时机，不能把它的透明表面
      // 样式覆盖到代理卡片；有可见表面的文件夹卡仍完整执行视觉 morph。
      targetShadow: targetHasSurfaceStyle ? targetSnapshot?.boxShadow : undefined,
      targetRadius: targetHasSurfaceStyle ? targetSnapshot?.borderRadius : undefined,
      targetBackground: targetHasSurfaceStyle ? targetSnapshot?.background : undefined,
      targetBackgroundImage: targetHasSurfaceStyle ? targetSnapshot?.backgroundImage : undefined,
      targetOpacity: targetHasSurfaceStyle ? targetSnapshot?.opacity : undefined,
      // 透明面包屑没有卡片内容结构，不能参与 content morph；否则代理会把
      // 卡片内部布局替换成面包屑文字。可见的文件夹卡仍复用同一套内容 morph。
      targetContent: targetHasSurfaceStyle ? target : undefined,
      landingMode: context.landingMode,
      targetMotion: isTargetLanding ? context.motion?.target?.motion : undefined,
      dismiss: isTargetLanding ? context.motion?.target?.dismiss : undefined,
      readTarget: () => clampTarget(target.getBoundingClientRect()),
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
          retarget(clampTarget({
            left: context.targetSnapshot.rect.x,
            top: context.targetSnapshot.rect.y,
            width: context.targetSnapshot.rect.width,
            height: context.targetSnapshot.rect.height,
          }))
        } else {
          retarget(clampTarget(target.getBoundingClientRect()))
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
    mode?: string
    fromRect?: DOMRect
    returnRect?: DOMRect
  }): any {
    const r = this.runtime
    if (!r || !r.objects.hasAbility(context.objectId, 'move')) return {}
    context.event.preventDefault()
    const createMove = context.mode === 'clone'
      ? createCloneMoveFromAdapter
      : createDetachMoveFromAdapter
    return createMove({
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
