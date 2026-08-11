import type { VisualState, VisualSnapshot } from './VisualAdapterTypes'
import type { MotionProfile } from './MotionProfile'
import type { GroupDragConfig } from './GroupDragProfile'
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
  type DragProxyLayoutConfig,
} from './Visual'
import { preserveProxyVisualContext } from './ProxyVisualContext'
import { createCloneMoveFromAdapter, createDetachMoveFromAdapter } from '../runtime/move/MoveAdapter'
import type { Runtime } from '../Runtime'
import type { GroupObjectOffset } from '../session/GroupDragSession'

export interface VisualGroupContext {
  readonly primaryObjectId: string
  readonly objectIds: readonly string[]
  readonly offsets: ReadonlyMap<string, GroupObjectOffset>
}

export interface VisualLifecycleContext {
  readonly objectId: string
  readonly sessionId: string
  readonly mode: string
  readonly destination?: unknown
  readonly sourceElement?: HTMLElement
  /** 抓取开始时冻结的内容快照；仅供视觉代理使用，不承载业务状态。 */
  readonly beforeContent?: HTMLElement
  readonly targetElement?: HTMLElement
  readonly targetRect?: LandingRect
  /** 目标节点作为语义落点时保留其可见性，避免与源代理发生双重交接。 */
  readonly preserveTarget?: boolean
  /** default 保持普通 landing；target 到达语义目标后追加缩小淡出；free 使用纯矩形。 */
  readonly landingMode?: 'default' | 'target' | 'free'
  /** 释放后的落地策略；physical 继承释放状态，normal 不继承释放速度。 */
  readonly releaseMode?: 'normal' | 'physical'
  /** target landing 时跳过代理套上目标背景/圆角/内容的视觉 morph，只保留位置和缩小淡出。 */
  readonly disableTargetVisualMorph?: boolean
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
  /** 类型级抓取代理布局；Runtime 负责紧凑布局的过渡时序。 */
  readonly proxyLayout?: DragProxyLayoutConfig
  /** 多对象移动时由 Runtime 会话提供的主卡与附属卡相对布局。 */
  readonly group?: VisualGroupContext
  /** 对象类型注册的多选叠牌视觉配置。 */
  readonly groupDrag?: GroupDragConfig
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
  land?(proxy: VisualProxy, target: HTMLElement | LandingRect, context: VisualLifecycleContext): void | Promise<{ completed: boolean; reason?: string }>
  reveal?(proxy: VisualProxy, target: HTMLElement, context: VisualLifecycleContext): void | Promise<void>
  /** 完整销毁代理；实现该回调后由 adapter 负责调用 proxy.dispose（如有）。 */
  dispose?(proxy: VisualProxy, context: VisualLifecycleContext): void
}

/** 多对象拖拽的视觉适配器；接口与普通 VisualAdapter 相同，仅在 group session 中调用。 */
export type GroupVisualAdapter = VisualAdapter

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
    // 默认策略只认 ObjectStore 中由 objects.register()/setElement() 注册的真实节点。
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
      border: style.border,
      backdropFilter: style.backdropFilter,
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
    const proxy = createDragProxy(context.beforeContent, context.sourceRect, { layout: context.proxyLayout })
    const content = getProxyContent(proxy)
    const compact = Boolean(context.proxyLayout?.compact)
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
      getProxyAttitude(proxy).style.transform = `scale(${compact ? 1 : 1.03})`
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

  land(proxy: VisualProxy, target: HTMLElement | LandingRect, context: VisualLifecycleContext): Promise<{ completed: boolean; reason?: string }> {
    const el = proxy.element
    const targetElement = 'getBoundingClientRect' in target ? target : undefined
    const directTargetRect: LandingRect | undefined = targetElement ? undefined : target as LandingRect
    if (!context.targetRect && !context.targetSnapshot?.rect && !directTargetRect && (!targetElement || !targetElement.isConnected)) {
      return Promise.resolve({ completed: false, reason: 'target-disconnected' })
    }
    const rawTargetRect = context.targetRect ?? context.targetSnapshot?.rect ?? directTargetRect ?? targetElement!.getBoundingClientRect()
    const rawLandingRect = {
      left: rawTargetRect.left,
      top: rawTargetRect.top,
      width: rawTargetRect.width,
      height: rawTargetRect.height,
    }
    const clampTarget = (rect: LandingRect): LandingRect => {
      const bounds = context.landingBounds?.()
      return bounds ? clampLandingRectToBounds(rect, bounds) : rect
    }
    const targetRect = clampTarget(rawLandingRect)
    if (targetElement && !context.preserveTarget) concealElement(targetElement, context.sessionId)
    el.style.transition = 'none'
    const isTargetLanding = context.landingMode === 'target'
    const isCompactProxy = getProxyContent(el).dataset.runtimeCompact === 'true'
    const targetSnapshot = context.targetSnapshot
    // disableTargetVisualMorph 只关掉"飞向语义目标（文件夹/面包屑）时代理套上目标样式"这段——
    // 无效落点走的是 landingMode:'default' 飞回原位，这时候的目标样式 morph 是另一回事：把
    // 抓取时的深阴影平滑过渡回正常静止态，跟 isTargetLanding 无关，关掉会导致深阴影一直保持到
    // 代理销毁才突然消失，没有"落地"的感觉。
    // 目标视觉上是否有“可见表面”（背景/阴影/背景图）——面包屑等透明文字锚点没有，不能让
    // 代理套上它的怪样式，也不能拿它的 DOM 结构去做内容级 morph（会把卡片内部布局替换成
    // 面包屑文字）。这条门槛继续原样控制 targetContent（结构级 morph），跟落地模式无关。
    const targetHasVisibleSurface = Boolean(targetSnapshot && (
      (targetSnapshot.background && targetSnapshot.background !== 'transparent' && targetSnapshot.background !== 'rgba(0, 0, 0, 0)')
      || (targetSnapshot.backgroundImage && targetSnapshot.backgroundImage !== 'none')
      || (targetSnapshot.boxShadow && targetSnapshot.boxShadow !== 'none')
    ))
    // 表面视觉属性（阴影/圆角/边框/玻璃模糊/背景/透明度）要不要 morph 回目标真实值，判断
    // 更宽松：disableTargetVisualMorph 只关掉“飞向语义目标（文件夹/面包屑）时代理套上目标
    // 样式”这段；默认落地（飞回对象自己在列表/网格里的原位）跟这个开关无关，即使目标静止态
    // 没有背景/阴影（比如列表行本来就是透明的），也必须把抓起态的玻璃/深阴影 morph 回它的
    // 真实（可能就是透明/none）样子，否则代理会一直糊到销毁揭示那一刻才突然切换。
    const targetHasSurfaceStyle = !isTargetLanding
      ? Boolean(targetSnapshot)
      : !context.disableTargetVisualMorph && targetHasVisibleSurface
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
    const land = context.motionEnabled === false || context.releaseMode === 'normal'
      ? landDragProxyLegacy
      : landDragProxyWithMotion
    const { finished, retarget } = land(el, targetRect, {
      duration: landingProfile?.duration ?? DEFAULT_MOTION_PROFILE.landing.duration,
      easing: landingProfile?.easing ?? DEFAULT_MOTION_PROFILE.landing.easing,
      // 面包屑是透明文本节点，只提供位置和消失时机，不能把它的透明表面
      // 样式覆盖到代理卡片；有可见表面的文件夹卡仍完整执行视觉 morph。
      targetShadow: targetHasSurfaceStyle ? targetSnapshot?.boxShadow : undefined,
      targetRadius: targetHasSurfaceStyle ? targetSnapshot?.borderRadius : undefined,
      targetBorder: targetHasSurfaceStyle ? targetSnapshot?.border : undefined,
      targetBackdropFilter: targetHasSurfaceStyle ? targetSnapshot?.backdropFilter : undefined,
      targetBackground: targetHasSurfaceStyle ? targetSnapshot?.background : undefined,
      targetBackgroundImage: targetHasSurfaceStyle ? targetSnapshot?.backgroundImage : undefined,
      targetOpacity: targetHasSurfaceStyle ? targetSnapshot?.opacity : undefined,
      // 透明面包屑/列表行没有可复用的卡片式内容结构，不能参与 content morph——列表行是
      // grid 多列布局，套这套给卡片设计的结构级 morph 会把列挤错位（类型跑到文件名下面）。
      // compact 列表代理与目标卡结构相同，只需要让同一份内容跟随宽度恢复；如果再挂一层
      // 目标 Grid，右侧文件大小会因为 justify-self:end 在 landing 第一帧瞬间回到完整宽度。
      // 只有真正有背景/阴影且不是 compact 列表的目标才复用结构级 content morph。
      targetContent: targetHasVisibleSurface && !isCompactProxy ? targetElement : undefined,
      landingMode: context.landingMode,
      targetMotion: isTargetLanding ? context.motion?.target?.motion : undefined,
      dismiss: isTargetLanding ? context.motion?.target?.dismiss : undefined,
      readTarget: targetElement ? () => clampTarget(targetElement.getBoundingClientRect()) : undefined,
      motionState: context.releaseMode === 'normal' ? undefined : context.motionState,
      coast: {
        duration: DEFAULT_RELEASE_PROFILE.coastSeconds,
        friction: DEFAULT_COAST_FRICTION,
        maxDistance: DEFAULT_RELEASE_PROFILE.maxCoast,
        minVelocity: DEFAULT_RELEASE_PROFILE.minVelocity,
      },
      releaseDamping: DEFAULT_RELEASE_PROFILE.dampingRatio,
    })
    if (this.runtime && targetElement) {
      // targetSnapshot 只用于代理的首帧样式和初始几何，不能作为后续
      // retarget 的位置来源。目标卡可能在另一个 landing 期间被兄弟
      // FLIP 移动，即使它不在 data-layout-surface 下，也必须跟随当前
      // 视觉 rect；否则代理会回到落地开始时的旧位置。
      const snapshotRect = context.targetSnapshot?.rect
      const readRetargetRect = (): LandingRect => {
        const liveRect = targetElement!.getBoundingClientRect()
        if (liveRect.width > 0 && liveRect.height > 0) return clampTarget(liveRect)
        // 目标节点短暂被框架隐藏或重挂载时，不要把代理 retarget 到
        // [0, 0, 0, 0]；沿用最后一个有效快照，等待下一帧恢复实时位置。
        if (snapshotRect && snapshotRect.width > 0 && snapshotRect.height > 0) {
          return clampTarget({
            left: snapshotRect.x,
            top: snapshotRect.y,
            width: snapshotRect.width,
            height: snapshotRect.height,
          })
        }
        return clampTarget(liveRect)
      }
      this.runtime.trackLandingTarget(context.sessionId, targetElement, () => {
        retarget(readRetargetRect())
      })
    }
    return finished.then(() => ({ completed: true }))
  }

  reveal(_proxy: VisualProxy, target: HTMLElement, context: VisualLifecycleContext): void {
    // grabbing 阶段为 MotionController 关闭了本体的 inline transition。先清掉
    // 这份临时值，再解除 visibility，鼠标已在卡片上时才能让 CSS hover 正常过渡。
    target.style.transition = ''
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
