import type { VisualContext } from './VisualAdapterTypes'
import { DEFAULT_MOTION_PROFILE } from './MotionProfile'
import { createCardMotionController } from '../motion/CardMotionController'
import type { CardMotionController, MotionState } from '../motion/CardMotionController'
import { createFreeLandingMotion } from '../motion/FreeLandingMotion'
import { LANDING_PROFILE, type MotionProfile } from '../motion/MotionProfile'
import { preserveProxyVisualContext } from './ProxyVisualContext'

/**
 * 从元素捕获 CSS 继承属性上下文。
 * 用于在元素被移动到 overlay 等脱离原 DOM 树的位置时，
 * 保持文本渲染与原位置一致。
 */
export function captureInheritedStyleContext(element: HTMLElement): VisualContext {
  const style = getComputedStyle(element)
  return {
    fontFamily: style.fontFamily,
    color: style.color,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
    textAlign: style.textAlign,
    direction: style.direction,
    wordSpacing: style.wordSpacing,
    whiteSpace: style.whiteSpace,
    textIndent: style.textIndent,
  }
}

/**
 * 将捕获的视觉上下文应用到目标元素。
 */
export function applyInheritedStyleContext(target: HTMLElement, context: VisualContext): void {
  target.style.fontFamily = context.fontFamily
  target.style.color = context.color
  target.style.fontSize = context.fontSize
  target.style.fontWeight = context.fontWeight
  target.style.lineHeight = context.lineHeight
  target.style.letterSpacing = context.letterSpacing
  target.style.textAlign = context.textAlign
  target.style.direction = context.direction
  target.style.wordSpacing = context.wordSpacing
  target.style.whiteSpace = context.whiteSpace
  target.style.textIndent = context.textIndent
}

/**
 * 回归验证：检查 source → proxy 的视觉上下文一致性。
 * 返回不一致的属性列表，空数组表示全部一致。
 */
export function verifyVisualContextConsistency(
  source: HTMLElement,
  proxy: HTMLElement,
): string[] {
  const sourceCtx = captureInheritedStyleContext(source)
  const proxyCtx = captureInheritedStyleContext(proxy)
  const mismatches: string[] = []
  
  const keys: (keyof VisualContext)[] = [
    'fontFamily', 'color', 'fontSize', 'fontWeight',
    'lineHeight', 'letterSpacing', 'textAlign',
    'direction', 'wordSpacing', 'whiteSpace', 'textIndent',
  ]
  
  for (const key of keys) {
    if (sourceCtx[key] !== proxyCtx[key]) {
      mismatches.push(`${key}: source=${sourceCtx[key]}, proxy=${proxyCtx[key]}`)
    }
  }
  
  return mismatches
}

export function setProxyInteractive(
  proxy: HTMLElement,
  enabled: boolean,
): void {
  // landing proxy 永远不参与 hover；regrab 由 Runtime 在 document 捕获阶段
  // 按代理实时矩形判断，不在代理内部放命中子层。
  proxy.style.pointerEvents = 'none'
  // 代理可能由 grabbing 节点接管而来，不能把源节点遗留的 hover class
  // 带进 landing。pointer-events:none 只能阻止 CSS :hover，不能清理
  // Runtime 写入的 is-hovered；两者都要在代理边界主动移除。
  for (const node of [proxy, ...proxy.querySelectorAll<HTMLElement>('*')]) {
    node.classList.remove('is-hovered')
  }
}

export function setRuntimeAffordancesHidden(
  root: HTMLElement,
  hidden: boolean,
  selector?: string | readonly string[],
  reason = 'unknown',
): void {
  const selectors = selector ? (Array.isArray(selector) ? selector : [selector]) : ['.runtime-affordances-hidden']
  const query = selectors.filter(Boolean).join(',')
  if (!query) return
  const nodes = [
    ...(root.matches(query) ? [root] : []),
    ...root.querySelectorAll<HTMLElement>(query),
  ]
  const affected = nodes.flatMap(node => [node, ...node.querySelectorAll<HTMLElement>('*')])
  const probeEnabled = typeof globalThis !== 'undefined'
    && (globalThis as { __GUGU_RUNTIME_HOVER_PROBE__?: boolean }).__GUGU_RUNTIME_HOVER_PROBE__ === true
  affected.forEach(node => {
    const before = node.classList.contains('runtime-affordances-hidden')
    node.classList.toggle('runtime-affordances-hidden', hidden)
    if (probeEnabled && before !== hidden) {
      console.log('[mind-hover-probe] runtime-affordance ' + JSON.stringify({
        reason,
        hidden,
        tag: node.tagName.toLowerCase(),
        className: node.className,
        rootPhase: root.dataset.runtimePhase ?? null,
        rootObjectId: root.dataset.objectId ?? root.dataset.layoutKey ?? null,
        rootProxy: root.dataset.runtimeProxy ?? null,
        rootProxyContent: root.dataset.runtimeProxyContent ?? null,
      }))
    }
  })
}

/** 抓取代理的可选紧凑布局；尺寸和布局语义由业务声明，过渡由 Runtime 执行。 */
export interface DragProxyLayoutConfig {
  compact?: {
    width: string
    /** 仅匹配指定源元素时启用；不传表示该对象类型全部启用。 */
    selector?: string
    left?: string
    transform?: string
    duration?: number
    easing?: string
    /**
     * 抓取时用来替换内容层 grid-template-columns 的值——要求轨道数量和类型跟本体
     * CSS 里定义的真实列一致，只把紧凑态不展示的列宽度改成 0px（其余列原样保留
     * 真实的 fr/px 值）。落地时会清空这份内联覆盖，退回本体 CSS 定义的真实列宽，
     * 因为轨道数量全程不变，浏览器能把这次切换当成普通宽度过渡来平滑插值，不是
     * 两套布局互相替换的瞬间跳变。业务不传时不触碰 grid-template-columns。
     */
    gridTemplateColumns?: string
  }
}

export interface ProxyVisualState {
  transform: string
  boxShadow: string
  opacity: string
}

function setVisualBoxShadow(element: HTMLElement, value: string): void {
  // 业务卡片可能通过 .glass-card !important 提供默认阴影；代理的抓取/落地
  // 阴影属于 Runtime 视觉状态，必须能覆盖这条业务默认规则。
  element.style.setProperty('box-shadow', value, 'important')
}

function copyLandingSurfaceState(source: HTMLElement, target: HTMLElement): void {
  const style = getComputedStyle(source)
  target.style.border = style.border
  target.style.borderRadius = style.borderRadius
  target.style.setProperty('box-shadow', style.boxShadow, 'important')
  target.style.backgroundColor = style.backgroundColor
  target.style.backgroundImage = style.backgroundImage
  target.style.backdropFilter = style.backdropFilter
  target.style.setProperty('-webkit-backdrop-filter', style.backdropFilter)
}

function clearLandingRuntimeState(element: HTMLElement): void {
  element.classList.remove('is-grabbed', 'is-hovered')
  setRuntimeAffordancesHidden(element, false, undefined, 'clearLandingRuntimeState')
  delete element.dataset.runtimeProxy
  delete element.dataset.runtimeProxyContent
  delete element.dataset.runtimePhase
  delete element.dataset.runtimeCompact
}

function prepareContentMorph(
  layers: { contentRoot: HTMLElement; fromLayer: HTMLElement; toLayer: HTMLElement; targetScaleShell: HTMLElement },
  duration: number,
  easing: string,
): void {
  layers.fromLayer.style.opacity = '1'
  layers.toLayer.style.opacity = '0'
  void layers.contentRoot.offsetWidth
  requestAnimationFrame(() => {
    layers.fromLayer.style.transition = `opacity ${duration}ms ${easing}`
    // target layer 在上一帧已经开始执行表面属性过渡；保留它，不要把
    // background/blur transition 覆盖成只剩 opacity。
    if (!layers.toLayer.style.transition) {
      layers.toLayer.style.transition = `opacity ${duration}ms ${easing}`
    }
    requestAnimationFrame(() => {
      layers.fromLayer.style.opacity = '0'
      layers.toLayer.style.opacity = '1'
    })
  })
}

export function captureProxyVisualState(
  proxy: HTMLElement,
): ProxyVisualState {
  return {
    transform: proxy.style.transform,
    boxShadow: proxy.style.boxShadow,
    opacity: proxy.style.opacity,
  }
}

export function restoreProxyVisualState(
  proxy: HTMLElement,
  state: ProxyVisualState,
): void {
  proxy.style.transform = state.transform
  proxy.style.boxShadow = state.boxShadow
  proxy.style.opacity = state.opacity
}

/**
 * proxy：跟随指针的临时视觉对象，随 Session 创建/销毁，不属于 Vue 管理
 * 的真实 DOM——见 docs/DESIGN.md "Vue 创建真实 DOM，Runtime 创建临时 DOM"。
 */
export function createDragProxy(
  source: HTMLElement,
  rect: DOMRect = source.getBoundingClientRect(),
  options: { glass?: boolean; layout?: DragProxyLayoutConfig; contentScale?: number | (() => number); landingContentScale?: number | (() => number); cameraShell?: boolean; affordancesSelector?: string | readonly string[]; proxyZIndex?: number } = {},
): HTMLElement {
  const compact = options.layout?.compact
  // 与 main 看板保持一致：定位壳、姿态层、缩放壳和卡片内容各自只承担一类
  // 变换，避免 perspective/rotate 与 landing 位移在同一个矩阵里重新组合。
  const proxy = document.createElement('div')
  const attitude = document.createElement('div')
  const scaleShell = document.createElement('div')
  const content = source.cloneNode(true) as HTMLElement
  if (options.affordancesSelector) setRuntimeAffordancesHidden(content, true, options.affordancesSelector, 'createDragProxy')
  scaleShell.dataset.runtimeProxyScaleShell = 'true'
  if (options.cameraShell) scaleShell.dataset.runtimeCameraShell = 'true'
  attitude.dataset.runtimeProxyAttitude = 'true'
  content.dataset.runtimeProxyContent = 'true'
  Object.assign(scaleShell.style, {
    position: 'absolute', left: '0', top: '0',
    transformOrigin: '0 0', pointerEvents: 'none',
  })
  Object.assign(attitude.style, {
    position: 'absolute', left: '0', top: '0', width: '100%', height: '100%',
    transformOrigin: '50% 50%', transform: 'none', pointerEvents: 'none',
  })
  Object.assign(content.style, {
    position: 'absolute', left: '0', top: '0', width: '100%', height: '100%',
    boxSizing: 'border-box', margin: '0', pointerEvents: 'none',
  })
  // 先以本体尺寸绘制一帧，下一帧再切换到业务定义的紧凑抓取形态，
  // 这样列表卡片会把信息压进窄卡片，而不是创建代理时瞬间变窄。
  content.dataset.runtimePhase = 'grab-start'
  scaleShell.appendChild(content)
  attitude.appendChild(scaleShell)
  proxy.appendChild(attitude)
  // 源节点在 clone 策略中会暂时使用隐藏类保留列表占位；代理必须是唯一可见
  // 的视觉主体，不能把源节点的隐藏状态一起复制过来。
  proxy.className = ''
  proxy.style.position = 'fixed'
  proxy.style.left = `${rect.left}px`
  proxy.style.top = `${rect.top}px`
  // rect.width/height 来自 getBoundingClientRect，永远是完整的边框盒尺寸；
  // 如果业务 CSS 没显式声明 box-sizing: border-box（内容盒是浏览器默认值），
  // 把这个值原样写进 style.width 就会被当成内容宽度，再叠加 padding/border
  // 撑大，代理看起来比本体大一圈。这里强制代理自己用 border-box，不依赖
  // 业务样式约定。
  proxy.style.boxSizing = 'border-box'
  proxy.style.transformOrigin = '50% 50%'
  proxy.style.width = `${rect.width}px`
  proxy.style.height = `${rect.height}px`
  updateDragProxyContentScale(proxy, options.contentScale)
  proxy.style.margin = '0'
  // 之前经一个 data-runtime-overlay 中间容器（fixed + z-index 2147483647）来
  // 统一压 z-index，代理自己只需要 z-index:1。现在代理直接挂到 <html> 下，
  // 逃出玻璃裁切靠的是"脱离被裁切祖先的 DOM 子树"这件事本身（重新挂载到
  // document.documentElement），不是那层 overlay 容器；容器唯一的另一个作用
  // 是集中管理 z-index，去掉之后这个值要留在代理自己身上，直接顶到最高层。
  proxy.style.zIndex = String(options.proxyZIndex ?? 2147483647)
  proxy.style.pointerEvents = 'none'
  proxy.style.visibility = 'visible'
  // 提示浏览器把代理单独提到自己的合成层：这个函数同时是 grabbing 浮动本体
  // 和 landing 落地代理的唯一创建入口，每帧只写 transform（见跟手动画/落地
  // 飞行），但如果代理没有独立图层，浏览器仍可能把它当成默认根图层的一部分，
  // 每次 transform 变化连带整个视口一起重新栅格化——20 倍降速拖拽测试录到的
  // Paint 事件 clip 全是整个视口大小，不是代理这一小块（见跨列掉帧排查）。
  proxy.style.willChange = 'transform'
  // 不强制 display——源节点若是 flex/grid，克隆会保留其布局；强制
  // block 会破坏 flex 子项（如右侧推进按钮 align-self:stretch）的布局。
  proxy.style.display = ''
  proxy.dataset.runtimeProxy = 'true'
  // 全程只设一次、不切换，避免中途跳变导致内容偏移（这条约束本身没错，但
  // 原来定的是 0 0——rotateX 前后倾配合 perspective() 时，屏幕水平偏移量
  // 跟该点离原点的水平距离成正比：原点在左上角，卡片左边缘离原点近（偏移
  // 量趋近 0，看起来是平的），右边缘离原点有整张卡片宽度那么远，偏移量被
  // 放大很多倍，表现为"左边平、右边还在倾"这种明显不对称的前后倾斜。改成
  // 卡片几何中心，左右两边离原点等距，偏移量对称，倾斜才是"整张卡在转"
  // 而不是"左上角钉住、右边甩得更远"。translate3d 是位置平移，不受
  // transform-origin 影响，只改这一个值不需要连带调整任何位置计算。
  proxy.style.transformOrigin = '50% 50%'
  // 抓取启动的缩放由 applyFloatingStyle()/MotionController 统一驱动。
  // 创建阶段必须保持本体尺寸，避免先以最终比例绘制一帧后再回到起点。
  proxy.style.transform = 'scale(1)'
  if (defaultDraggingGlassEnabled && options.glass !== false) applyDraggingGlassStyle(content)
  else setVisualBoxShadow(content, '0 12px 24px rgba(0,0,0,.18)')
  if (compact) content.dataset.runtimeCompact = 'true'
  const compactDuration = compact?.duration ?? 200
  const compactEasing = compact?.easing ?? 'cubic-bezier(.22,1,.36,1)'
  content.style.transition = `left ${compactDuration}ms ${compactEasing}, width ${compactDuration}ms ${compactEasing}, transform ${compactDuration}ms ${compactEasing}, grid-template-columns ${compactDuration}ms ${compactEasing}, box-shadow .15s ease, border-radius .15s ease, background-color .15s ease, opacity .15s ease`
  proxy.style.transition = 'transform .15s ease'
  // 逃出玻璃裁切（overflow:hidden / backdrop-filter 祖先）靠的就是这次重新
  // 挂载：只要还在被裁切祖先的子树里，z-index 再高也没用；只要挂到 <html>
  // 下，不需要额外一层 overlay 容器。
  document.documentElement.appendChild(proxy)
  requestAnimationFrame(() => {
    if (proxy.isConnected && content.dataset.runtimePhase === 'grab-start') {
      content.dataset.runtimePhase = 'grabbing'
      if (compact) {
        content.style.left = compact.left ?? '50%'
        content.style.width = compact.width
        content.style.transform = compact.transform ?? 'translateX(-50%)'
        if (compact.gridTemplateColumns) content.style.gridTemplateColumns = compact.gridTemplateColumns
      }
    }
  })
  activeDragProxies.add(proxy)
  return proxy
}

function resolveContentScale(value: number | (() => number) | undefined): number {
  const scale = typeof value === 'function' ? value() : value
  return typeof scale === 'number' && Number.isFinite(scale) && scale > 0 ? scale : 1
}

/**
 * 代理挂到 documentElement 后不再继承画布的 transform: scale()。
 * 用未缩放的布局尺寸承载内容，再在 scaleShell 上恢复当前视觉比例，避免
 * 外框按屏幕 rect 缩放而文字/内边距仍按 100% 渲染。
 */
export function updateDragProxyContentScale(
  proxy: HTMLElement,
  value: number | (() => number) | undefined,
): void {
  const scale = resolveContentScale(value)
  const rectWidth = parseFloat(proxy.style.width) || proxy.getBoundingClientRect().width
  const rectHeight = parseFloat(proxy.style.height) || proxy.getBoundingClientRect().height
  const baseWidth = Number(proxy.dataset.runtimeProxyBaseWidth) || rectWidth / scale
  const baseHeight = Number(proxy.dataset.runtimeProxyBaseHeight) || rectHeight / scale
  proxy.dataset.runtimeProxyBaseWidth = String(baseWidth)
  proxy.dataset.runtimeProxyBaseHeight = String(baseHeight)
  const shell = proxy.querySelector<HTMLElement>('[data-runtime-proxy-scale-shell]')
  if (!shell) return
  shell.style.width = `${baseWidth}px`
  shell.style.height = `${baseHeight}px`
  // 跟旧版 holder + scaleShell 一样，定位壳尺寸保持抓取时的视觉尺寸；
  // 只把内容层放到壳中心并实时缩放，避免相机变化反过来改写 MotionController
  // 的坐标基准，导致代理每次缩放都重新贴回鼠标。
  const proxyWidth = parseFloat(proxy.style.width) || rectWidth
  const proxyHeight = parseFloat(proxy.style.height) || rectHeight
  // 以缩放后的视觉尺寸居中，保证相机变化时内容中心仍锁在定位壳中心。
  shell.style.left = `${(proxyWidth - baseWidth * scale) / 2}px`
  shell.style.top = `${(proxyHeight - baseHeight * scale) / 2}px`
  shell.style.transform = `scale(${scale})`
}

/** landing 已经由 MotionController 写入当前外框尺寸时，只同步相机 shell，不重置外框。 */
export function updateDragProxyScaleShell(
  proxy: HTMLElement,
  value: number | (() => number) | undefined,
): void {
  const scale = resolveContentScale(value)
  const rectWidth = parseFloat(proxy.style.width) || proxy.getBoundingClientRect().width
  const rectHeight = parseFloat(proxy.style.height) || proxy.getBoundingClientRect().height
  const shell = proxy.querySelector<HTMLElement>('[data-runtime-proxy-scale-shell]')
  if (!shell) return
  // landing 已把定位壳改成当前视觉尺寸；缩放壳此时应从壳左上角重新计算，
  // 不能继续沿用 grabbing 阶段为“固定壳 + 居中内容”写入的旧偏移，否则
  // 松手后代理的视觉起点/终点会整体错开，最后揭示本体时出现一帧位移。
  shell.style.left = '0px'
  shell.style.top = '0px'
  shell.style.width = `${rectWidth / scale}px`
  shell.style.height = `${rectHeight / scale}px`
  shell.style.transform = `scale(${scale})`
}

/**
 * Landing 使用旧版的稳定分层：代理根节点是固定尺寸的 holder，
 * 尺寸变化只写到 scaleShell 的 transform，不能在每帧改 holder 的宽高。
 * 这样旋转、相机缩放和卡片内部布局不会互相触发重排。
 */
function prepareLandingScaleShell(
  proxy: HTMLElement,
  contentScale: number,
): { shell: HTMLElement; baseWidth: number; baseHeight: number } | null {
  const shell = proxy.querySelector<HTMLElement>('[data-runtime-proxy-scale-shell]')
  if (!shell) return null
  const holderWidth = parseFloat(proxy.style.width) || proxy.getBoundingClientRect().width
  const holderHeight = parseFloat(proxy.style.height) || proxy.getBoundingClientRect().height
  const scale = contentScale > 0 ? contentScale : 1
  // 抓取阶段已经记录了脱离 camera 后的世界尺寸。landing 不能用当前缩放
  // 重新反推它，否则相机在抓取期间变化时会把实时视觉尺寸缩回抓取时的壳尺寸，
  // 造成松手首帧从小尺寸重新放大。没有记录时才使用旧的尺寸推导作为普通代理
  // 的兼容路径。
  const baseWidth = Number(proxy.dataset.runtimeProxyBaseWidth) || holderWidth / scale
  const baseHeight = Number(proxy.dataset.runtimeProxyBaseHeight) || holderHeight / scale
  shell.style.width = `${baseWidth}px`
  shell.style.height = `${baseHeight}px`
  shell.style.left = `${(holderWidth - baseWidth * scale) / 2}px`
  shell.style.top = `${(holderHeight - baseHeight * scale) / 2}px`
  shell.style.transform = `scale(${scale})`
  return { shell, baseWidth, baseHeight }
}

function applyLandingScale(
  shellState: { shell: HTMLElement; baseWidth: number; baseHeight: number },
  holderWidth: number,
  holderHeight: number,
  scale: number,
): void {
  const shellWidth = shellState.baseWidth * scale
  const shellHeight = shellState.baseHeight * scale
  // scaleShell 全程使用抓取阶段的 0 0 原点，避免相机缩放在松手首帧
  // 重新解释同一个 shell 而造成位置跳跃。
  shellState.shell.style.left = `${((holderWidth - shellWidth) / 2).toFixed(2)}px`
  shellState.shell.style.top = `${((holderHeight - shellHeight) / 2).toFixed(2)}px`
  shellState.shell.style.transform = `scale(${scale})`
}


export function getProxyAttitude(proxy: HTMLElement): HTMLElement {
  return proxy.querySelector<HTMLElement>('[data-runtime-proxy-attitude]') ?? proxy
}

export function getProxyContent(proxy: HTMLElement): HTMLElement {
  // 多选 modifier 也复用 proxy content 标记来继承布局，但它们不是主代理
  // 内容。必须排除 modifier，否则 landing 时会把展开/落位样式写到装饰卡。
  return proxy.querySelector<HTMLElement>(
    '[data-runtime-proxy-content]:not([data-runtime-group-modifier])',
  ) ?? proxy
}

export function moveDragProxy(proxy: HTMLElement, x: number, y: number, offsetX: number, offsetY: number) {
  proxy.style.left = `${x - offsetX}px`
  proxy.style.top = `${y - offsetY}px`
}

export interface LandingVisualOptions {
  objectId?: string
  sessionId?: string
  pointerRelease?: { x: number; y: number }
  targetSnapshot?: { rect?: DOMRect }
  sourceSurfaceId?: string
  destinationSurfaceId?: string
  duration?: number
  easing?: string
  stiffness?: number
  damping?: number
  rotationDecay?: number
  targetShadow?: string
  targetRadius?: string
  targetBorder?: string
  targetBackdropFilter?: string
  targetBackground?: string
  /** 目标背景图（渐变等）。backgroundColor 与 backgroundImage 分设，避免
   *  background 简写把渐变覆盖成透明。 */
  targetBackgroundImage?: string
  targetOpacity?: string
  /**
   * 落点内容本身会变化时用（比如落点比源多/少某个子元素——徽章、按钮这类
   * 真实 DOM 结构差异，不是纯样式差异，插值 background/box-shadow 这类
   * 数值属性解决不了）。传入落点真实渲染出的节点，这里会把代理现有内容
   * 包一层、克隆一份目标内容叠在上面，两层内容做 opacity 交叉淡变；
   * 位置/尺寸/容器级样式（背景、阴影等，见上面几个 target* 选项）仍由
   * 外层代理统一插值，两套机制独立生效、互不干扰。不传时完全不建这层，
   * 内容不变的场景维持原来更轻量的路径。
   */
  targetContent?: HTMLElement
  /** default 保持普通 landing；target 到达语义目标后追加缩小淡出。 */
  landingMode?: 'default' | 'target' | 'free'
  /** target 模式的末段缩小淡出参数；默认沿用 landing 时长与缓动。 */
  dismiss?: { duration: number; easing: string; scale: number }
  /** target 模式独立的物理速度；不读取全局 landing 的弹簧。 */
  targetMotion?: {
    position: { stiffness: number; damping: number }
    scale: { stiffness: number; damping: number }
  }
  /** retarget 执行时重新读取目标几何，避免使用布局变化前缓存的中间 rect。 */
  readTarget?: () => LandingRect
  /** free 画布 landing 的相机原点；用于相机移动/缩放时变换整段代理动画。 */
  cameraOrigin?: () => { left: number; top: number }
  /** free 画布 landing 的实时相机比例。 */
  contentScale?: number | (() => number)
  /** free landing 目标 Surface 的实时相机比例；不继承抓取阶段冻结倍率。 */
  landingCameraScale?: number | (() => number)
  /** 当前代理是否由对象级 camera capability 启用 camera shell。 */
  cameraShell?: boolean
  /** 对象类型注册的附加交互选择器；landing 的源层和目标层都必须隐藏。 */
  affordancesSelector?: string | readonly string[]
  /** grid/list 目标的最终内容倍率；未提供时按目标视觉宽度与代理基准宽度推导。 */
  landingContentScale?: number | (() => number)
  motionState?: Pick<MotionState, 'x' | 'y' | 'vx' | 'vy' | 'scaleX' | 'scaleY' | 'rotateX' | 'rotateZ'>
  coast?: { duration: number; friction: number; maxDistance: number; minVelocity: number }
  /** 有释放速度时降低位置阻尼，保留横向抛掷的越过感。 */
  releaseDamping?: number
}

/**
 * CSS box-shadow 只有阴影层数和类型顺序一致时才会做连续插值。不同卡片的
 * 静止态顺序并不统一：文件卡通常是「inset 高光 + 外阴影」，活动卡可能是
 * 「外阴影 + inset 高光」。因此补层时必须按 inset/外阴影类型配对，不能只按
 * 数量追加，否则文件卡的外阴影会被错误匹配到 inset 层。
 */
function splitBoxShadowLayers(value: string): string[] {
  const layers: string[] = []
  let start = 0
  let depth = 0
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]
    if (char === '(') depth += 1
    else if (char === ')') depth = Math.max(0, depth - 1)
    else if (char === ',' && depth === 0) {
      layers.push(value.slice(start, index).trim())
      start = index + 1
    }
  }
  const last = value.slice(start).trim()
  if (last) layers.push(last)
  return layers
}

function normalizeBoxShadowTransition(source: string, target: string): string {
  const sourceLayers = splitBoxShadowLayers(source)
  const targetLayers = splitBoxShadowLayers(target)
  if (sourceLayers.length >= targetLayers.length || sourceLayers.length === 0) return source
  const sourceByType = new Map<'inset' | 'outer', string[]>()
  sourceByType.set('inset', sourceLayers.filter(layer => /\binset\b/i.test(layer)))
  sourceByType.set('outer', sourceLayers.filter(layer => !/\binset\b/i.test(layer)))
  const transparentLayer = (targetLayer: string) => /\binset\b/i.test(targetLayer)
    ? 'inset 0 0 0 0 rgba(0, 0, 0, 0)'
    : '0 0 0 0 rgba(0, 0, 0, 0)'
  const usedByType = new Map<'inset' | 'outer', number>([['inset', 0], ['outer', 0]])
  return targetLayers.map(targetLayer => {
    const type = /\binset\b/i.test(targetLayer) ? 'inset' : 'outer'
    const candidates = sourceByType.get(type) ?? []
    const used = usedByType.get(type) ?? 0
    if (used < candidates.length) {
      usedByType.set(type, used + 1)
      return candidates[used]
    }
    return transparentLayer(targetLayer)
  }).join(', ')
}

/**
 * 统一提交 landing 的阴影起点。旧版 Gugu 的 landing clone 会先继承完整的
 * grabbing 阴影，强制布局后才写入目标阴影；单代理 Runtime 也必须保持这个
 * 顺序，否则浏览器会把起点和终点合并到同一帧，表现为阴影瞬间消失。
 */
function prepareBoxShadowMorph(
  content: HTMLElement,
  targetShadow: string | undefined,
  transition: string,
): void {
  if (targetShadow == null) {
    content.style.transition = transition
    return
  }
  const sourceShadow = content.style.boxShadow || getComputedStyle(content).boxShadow
  content.style.transition = 'none'
  setVisualBoxShadow(content, normalizeBoxShadowTransition(sourceShadow, targetShadow))
  void content.offsetWidth
  content.style.transition = transition
}

/**
 * 将抓取态和目标态分别保留为完整卡片快照，再放进一个纯承载层交叉淡化。
 *
 * 不能只把两张卡片的 childNodes 搬进空 div：这样会丢掉源卡片自己的
 * display/grid/flex/padding 布局上下文，landing 外壳一变宽，源内容就会被
 * 目标卡片的布局规则提前重排。两层各自保留根节点样式，才能让抓取快照和
 * 目标快照在同一个外壳里独立过渡。
 */
function wrapContentForMorph(
  source: HTMLElement,
  toContent: HTMLElement,
  affordancesSelector?: string | readonly string[],
): { contentRoot: HTMLElement; fromLayer: HTMLElement; toLayer: HTMLElement; targetScaleShell: HTMLElement } {
  const sourceLayer = source.cloneNode(true) as HTMLElement
  const contentRoot = document.createElement('div')
  contentRoot.dataset.runtimeProxyContent = 'true'
  if (source.dataset.runtimePhase) contentRoot.dataset.runtimePhase = source.dataset.runtimePhase
  if (source.dataset.runtimeCompact === 'true') contentRoot.dataset.runtimeCompact = 'true'
  Object.assign(contentRoot.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    boxSizing: 'border-box',
    margin: '0',
    pointerEvents: 'none',
  })
  // source layer 会在本次同步 DOM 交接后立刻参与绘制。不能在这里删掉
  // Runtime 标记，否则它会在 phase 仍为 grabbing 的这一帧退回业务卡片的
  // 渐变底色，产生一个性能面板可见、肉眼不一定明显的“不透明闪帧”。
  // 保留抓取态标记，直到 source layer 随 opacity 交叉淡出并随 proxy 一起销毁。
  sourceLayer.dataset.runtimeProxyContent = 'true'
  if (source.dataset.runtimePhase) sourceLayer.dataset.runtimePhase = source.dataset.runtimePhase
  if (source.dataset.runtimeCompact === 'true') sourceLayer.dataset.runtimeCompact = 'true'
  Object.assign(sourceLayer.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    boxSizing: 'border-box',
    opacity: '1',
    pointerEvents: 'none',
  })

  // 目标层必须来自真实落点节点。此前这里误用了 source clone，导致所谓的
  // morph 实际只是两份源卡片互相淡化，跨 Surface 的目标字体、布局、徽章和
  // 内容只能在 reveal 本体时突然切换。
  const targetLayer = toContent.cloneNode(true) as HTMLElement
  // 克隆节点脱离目标卡片原本的列/主题继承链后，浏览器会回退到 body 的
  // 字体上下文（例如从 system-ui 变成 PingFang SC）。这会改变文字宽度、
  // 换行和徽标排布，代理看起来像是整体 scale 放大，而不是按目标卡片
  // 的内容布局自然重排。必须在仍能读取真实目标节点时，把目标的字形
  // 渲染上下文写入目标层；源层则继续保留抓取时的上下文。
  preserveProxyVisualContext(toContent, targetLayer)
  clearLandingRuntimeState(targetLayer)
  if (affordancesSelector) setRuntimeAffordancesHidden(targetLayer, true, affordancesSelector, 'prepareContentMorph')
  // 目标层先继承抓取代理的表面状态。landing 开始后再在同一条视觉
  // transition 上写入目标状态，避免目标层一出现就带着清晰本体覆盖掉 source
  // 的毛玻璃；内容仍然通过两层 opacity 交叉，背景/blur 则连续收敛。
  copyLandingSurfaceState(source, targetLayer)
  delete targetLayer.dataset.runtimePhase
  delete targetLayer.dataset.runtimeCompact
  Object.assign(targetLayer.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    boxSizing: 'border-box',
    opacity: '0',
    margin: '0',
    pointerEvents: 'none',
    visibility: 'visible',
  })
  const targetScaleShell = document.createElement('div')
  targetScaleShell.dataset.runtimeProxyTargetContentScaleShell = 'true'
  Object.assign(targetScaleShell.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    boxSizing: 'border-box',
    margin: '0',
    pointerEvents: 'none',
    transformOrigin: '50% 50%',
    transform: 'scale(1)',
    overflow: 'visible',
  })
  targetScaleShell.append(targetLayer)
  contentRoot.append(sourceLayer, targetScaleShell)
  source.replaceWith(contentRoot)
  contentRoot.style.border = '0'
  contentRoot.style.borderRadius = '0'
  contentRoot.style.setProperty('box-shadow', 'none', 'important')
  contentRoot.style.background = 'transparent'
  contentRoot.style.backdropFilter = 'none'
  contentRoot.style.setProperty('-webkit-backdrop-filter', 'none')

  return { contentRoot, fromLayer: sourceLayer, toLayer: targetLayer, targetScaleShell }
}

export type LandingRect = Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>

/** 将 landing 目标限制在 Surface viewport 内，不等待滚动动画结束。 */
export function clampLandingRectToBounds(rect: LandingRect, bounds: DOMRect): LandingRect {
  const maxLeft = Math.max(bounds.left, bounds.right - rect.width)
  const maxTop = Math.max(bounds.top, bounds.bottom - rect.height)
  return {
    left: Math.min(Math.max(rect.left, bounds.left), maxLeft),
    top: Math.min(Math.max(rect.top, bounds.top), maxTop),
    width: rect.width,
    height: rect.height,
  }
}

/**
 * 把代理从当前帧交接到最终目标。目标默认只提供一次几何快照——但调用方
 * 可以用返回值里的 retarget() 持续纠正：如果落地途中又有一次不相关的
 * 布局事务把目标的实际落点挪了（比如紧接着又落地了另一张卡，兄弟卡跟着
 * 重新排位），飞行终点会跟着更新，而不是飞向一个已经过期的坐标。不调用
 * retarget 的调用方行为不变，仍然是"一次性快照、不追踪"。
 */
/**
 * 兼容旧调用方的 landing 入口。动画时序统一转交 MotionController；
 * 下面的 legacy 实现仅保留作历史对照，不再被 Runtime 使用。
 */
export function landDragProxy(
  proxy: HTMLElement,
  target: LandingRect,
  options: LandingVisualOptions = {},
): { finished: Promise<void>; retarget: (nextTarget: LandingRect) => void } {
  return landDragProxyWithMotion(proxy, target, options)
}

/** MotionController 可选关闭时使用的 CSS 过渡落地实现。 */
export function landDragProxyLegacy(
  proxy: HTMLElement,
  target: LandingRect,
  options: LandingVisualOptions = {},
): { finished: Promise<void>; retarget: (nextTarget: LandingRect) => void } {
  const duration = options.duration ?? DEFAULT_MOTION_PROFILE.landing.duration
  const easing = options.easing ?? 'cubic-bezier(.22,1,.36,1)'
  const targetShadow = options.targetShadow
  const targetRadius = options.targetRadius
  const targetBorder = options.targetBorder
  const targetBackdropFilter = options.targetBackdropFilter
  const targetBackground = options.targetBackground
  const targetOpacity = options.targetOpacity
  let content = getProxyContent(proxy)
  const attitude = getProxyAttitude(proxy)
  const contentLayers = options.targetContent
    ? wrapContentForMorph(content, options.targetContent, options.affordancesSelector)
    : null
  if (contentLayers) content = contentLayers.contentRoot
  const sourceSurface = contentLayers?.fromLayer ?? content
  const targetSurface = contentLayers?.toLayer ?? content
  if (contentLayers) {
    contentLayers.fromLayer.style.transition = 'none'
    contentLayers.toLayer.style.transition = 'none'
  }
  const initialContentScale = resolveContentScale(options.contentScale)

  // 位置用 transform（translate），尺寸用真实 width/height——两者分开处理：
  // 位置纯粹是视觉位移，跟内容排版无关，走 transform 不触发重排最省；但尺寸
  // 如果也用 scale 视觉缩放，容器整体缩放会连带把里面的真实文字一起横向/纵向
  // 拉伸变形（源列和目标列卡片宽度不一致时最明显，比如跨列拖拽宽度差几十
  // px，文字会在飞行途中肉眼可见地变胖变瘦）——内容层没有反向抵消这个缩放，
  // 之前踩过这个坑。改回真实 width/height 过渡，文字每一帧都按当前实际宽度
  // 自然重排，不会被视觉拉伸；代价是中文文字在宽度连续变化期间理论上可能有
  // 轻微的换行/字距重算抖动，但这个副作用没有实测验证过有多明显，两害相权
  // 先保证文字不变形。
  const layoutLeft = parseFloat(proxy.style.left) || 0
  const layoutTop = parseFloat(proxy.style.top) || 0

  let settled = false
  let currentTarget = target
  const startedAt = performance.now()
  let onEnd: (event: TransitionEvent) => void = () => undefined
  let resolveFinished: () => void = () => undefined
  const finished = new Promise<void>(resolve => { resolveFinished = resolve })

  const isAtTarget = () => {
    const rect = proxy.getBoundingClientRect()
    return Math.abs(rect.left - currentTarget.left) < 2
      && Math.abs(rect.top - currentTarget.top) < 2
      && Math.abs(rect.width - currentTarget.width) < 2
      && Math.abs(rect.height - currentTarget.height) < 2
  }
  let pendingRetarget: LandingRect | null = null
  let pendingRetargetTimer: number | null = null
  let lastFlyToAt = 0
  // retarget 之间强制间隔的下限：每次 flyTo 都会重启过渡（冻结当前视觉状态→强制
  // 回流→下一帧写新终点），如果目标位置在兄弟卡 FLIP 期间逐帧变化，每帧都重启一次
  // 过渡会打断浏览器正在合成的动画，表现为落地途中卡顿。用这个间隔把高频 retarget
  // 合并成较低频率的重启，落点仍然会追上，只是不再逐帧强制回流。
  const RETARGET_MIN_INTERVAL = 60
  const settle = (via: string) => {
    if (settled) return
    settled = true
    proxy.removeEventListener('transitionend', onEnd)
    if (pendingRetargetTimer !== null) {
      window.clearTimeout(pendingRetargetTimer)
      pendingRetargetTimer = null
    }
    resolveFinished()
  }
  const waitForTarget = () => {
    if (settled) return
    if (isAtTarget()) {
      settle('waitForTarget:isAtTarget')
      return
    }
    if (performance.now() - startedAt >= duration + 500) {
      settle('waitForTarget:timeout')
      return
    }
    window.requestAnimationFrame(waitForTarget)
  }

  // 起点和终点必须隔一帧写，过渡才有起点可插值——不管是首次起飞还是中途
  // 被 retarget，都是同一套"冻结当前视觉状态 → 强制回流 → 下一帧过渡到
  // 新终点"手法，只是首次起飞时终点写的是初始 target，retarget 时终点
  // 换成新坐标。
  // retarget 时用剩余时间而非完整 duration：如果目标位置因另一张卡落地而
  // 频繁变化，每次都用完整 duration 会导致动画被无限延长（探针实测 flyTo
  // 被调用了 55 次，总时长远超预期的 3s）。
  const flyTo = (nextTarget: LandingRect, animDuration = duration) => {
    currentTarget = nextTarget
    const startRect = proxy.getBoundingClientRect()
    proxy.style.transition = 'none'
    const currentAttitudeTransform = getComputedStyle(attitude).transform
    attitude.style.transition = 'none'
    attitude.style.transform = currentAttitudeTransform
    proxy.style.width = `${startRect.width.toFixed(2)}px`
    proxy.style.height = `${startRect.height.toFixed(2)}px`
    proxy.style.transform =
      `translate3d(${(startRect.left - layoutLeft).toFixed(2)}px, ${(startRect.top - layoutTop).toFixed(2)}px, 0)`
    // 保留当前视觉位移作为 landing 起点。清成 none 会让代理瞬间回到
    // style.left/top 的原始位置，普通模式因此会从抓取前的位置飞出。
    void proxy.offsetWidth
    const targetTransform =
      `translate3d(${(nextTarget.left - layoutLeft).toFixed(2)}px, ${(nextTarget.top - layoutTop).toFixed(2)}px, 0)`

    proxy.style.transition = `transform ${animDuration}ms ${easing}, width ${animDuration}ms ${easing}, height ${animDuration}ms ${easing}`
    attitude.style.transition = `transform ${animDuration}ms ${easing}`
    const visualTransition = [
      `box-shadow ${animDuration}ms ease`,
      `border-radius ${animDuration}ms ease`,
      `border-color ${animDuration}ms ease`,
      `backdrop-filter ${animDuration}ms ease`,
      `-webkit-backdrop-filter ${animDuration}ms ease`,
      `background-color ${animDuration}ms ease`,
      `background-image ${animDuration}ms ease`,
      `opacity ${animDuration}ms ease`,
    ].join(', ')
    if (contentLayers) contentLayers.toLayer.style.transition = visualTransition
    // 双层 morph 时两层已经分别携带了抓取态/目标态阴影。再把源层也改成目标阴影
    // 会在 opacity 交叉期间叠出两份本体阴影，尤其是项目卡会明显变成“多一层阴影”。
    // 单层代理仍沿用原来的阴影属性过渡。
    if (!contentLayers) prepareBoxShadowMorph(sourceSurface, targetShadow, visualTransition)
    // box-shadow/border-radius/background/opacity 起点值（dragSnapshot）是调用方在这个
    // proxy 刚创建、还没被浏览器画过一帧的时候同步写上去的——如果在这里（设置 transition
    // 的同一个同步块里）就把它们改成目标值，浏览器压根没机会先画一帧"起点样子"，只会在
    // 第一次真正渲染时直接看到目标值，没有过渡可言（表现为松手瞬间阴影直接跳变/消失，
    // 而不是渐变）。跟 transform 一样，必须等到下一帧、起点样式已经被画过一次之后，
    // 再改成目标值，过渡才有起点可插值。
    requestAnimationFrame(() => {
      proxy.style.transform = targetTransform
      attitude.style.transform = 'none'
      proxy.style.width = `${nextTarget.width.toFixed(2)}px`
      proxy.style.height = `${nextTarget.height.toFixed(2)}px`
      // morph 根壳是透明的定位容器，不能承载目标阴影；否则它的 0 圆角会
      // 在真实卡片外再生成一个直角阴影。没有分层时 targetSurface 就是 content。
      if (targetShadow != null) setVisualBoxShadow(targetSurface, targetShadow)
      if (targetRadius != null) targetSurface.style.borderRadius = targetRadius
      // 抓起时 applyDraggingGlassStyle 给了四边一圈白边（玻璃态），落地要 morph 回
      // 目标本体真实的 border——本体大多只在顶部有一条 inset 高光、没有四边描边，
      // 不清掉这份抓起态残留会导致代理揭示前一直带着四边高光，跟本体明显不一样。
      if (targetBorder != null) targetSurface.style.border = targetBorder
      // 同上：backdrop-filter 也是抓起态才有的玻璃模糊，本体基本是 none，
      // 同样得纳入 morph，否则代理全程糊着，揭示瞬间才"唰"地变清晰。
      if (targetBackdropFilter != null) {
        targetSurface.style.backdropFilter = targetBackdropFilter
        targetSurface.style.setProperty('-webkit-backdrop-filter', targetBackdropFilter)
      }
      if (targetBackground != null) {
        targetSurface.style.backgroundColor = targetBackground
        if (options.targetBackgroundImage) {
          targetSurface.style.backgroundImage = options.targetBackgroundImage
        }
      }
      if (targetOpacity != null) targetSurface.style.opacity = targetOpacity
      if (contentLayers) prepareContentMorph(contentLayers, animDuration, easing)
    })
  }

  onEnd = (event: TransitionEvent) => {
    if (event.target !== proxy) return
    const relevant = event.propertyName === 'transform' || event.propertyName === 'width' || event.propertyName === 'height'
    if (!relevant) return
    if (isAtTarget()) settle(`transitionend:${event.propertyName}`)
  }
  proxy.addEventListener('transitionend', onEnd)
  flyTo(target)
  window.setTimeout(waitForTarget, duration + 40)

  const applyRetarget = (nextTarget: LandingRect) => {
    lastFlyToAt = performance.now()
    // 用剩余时间而非完整 duration：retarget 只是修正航向，不应重置动画时钟。
    const remaining = Math.max(80, duration - (lastFlyToAt - startedAt))
    flyTo(options.readTarget?.() ?? nextTarget, remaining)
  }

  const retarget = (nextTarget: LandingRect) => {
    if (settled) return
    const dx = Math.abs(nextTarget.left - currentTarget.left)
    const dy = Math.abs(nextTarget.top - currentTarget.top)
    const dw = Math.abs(nextTarget.width - currentTarget.width)
    const dh = Math.abs(nextTarget.height - currentTarget.height)
    if (dx < 0.5 && dy < 0.5 && dw < 0.5 && dh < 0.5) return
    const elapsed = performance.now() - lastFlyToAt
    if (elapsed >= RETARGET_MIN_INTERVAL) {
      applyRetarget(nextTarget)
      return
    }
    // 距上次 flyTo 还不到最小间隔：先记下最新目标，等间隔到了再统一补一次，
    // 而不是每帧都重启过渡。
    pendingRetarget = nextTarget
    if (pendingRetargetTimer === null) {
      pendingRetargetTimer = window.setTimeout(() => {
        pendingRetargetTimer = null
        if (settled || !pendingRetarget) return
        const target = pendingRetarget
        pendingRetarget = null
        applyRetarget(target)
      }, RETARGET_MIN_INTERVAL - elapsed)
    }
  }

  return { finished, retarget }
}

/**
 * MotionController 驱动的 landing 版本。
 * DOM 视觉属性仍由本文件处理，控制器只负责连续的位置、尺寸和完成时机。
 */
export function landDragProxyWithMotion(
  proxy: HTMLElement,
  target: LandingRect,
  options: LandingVisualOptions = {},
): { finished: Promise<void>; retarget: (nextTarget: LandingRect) => void } {
  const duration = options.duration ?? DEFAULT_MOTION_PROFILE.landing.duration
  const easing = options.easing ?? 'cubic-bezier(.22,1,.36,1)'
  const targetShadow = options.targetShadow
  const targetRadius = options.targetRadius
  const targetBorder = options.targetBorder
  const targetBackdropFilter = options.targetBackdropFilter
  const targetBackground = options.targetBackground
  const targetOpacity = options.targetOpacity
  let content = getProxyContent(proxy)
  const scaleShell = proxy.querySelector<HTMLElement>('[data-runtime-proxy-scale-shell]')
  const contentLayers = options.targetContent
    ? wrapContentForMorph(content, options.targetContent, options.affordancesSelector)
    : null
  if (contentLayers) content = contentLayers.contentRoot
  const sourceSurface = contentLayers?.fromLayer ?? content
  const targetSurface = contentLayers?.toLayer ?? content
  if (contentLayers) {
    contentLayers.fromLayer.style.transition = 'none'
    contentLayers.toLayer.style.transition = 'none'
  }

  if (contentLayers) {
    contentLayers.targetScaleShell.style.transformOrigin = '50% 50%'
    contentLayers.targetScaleShell.style.transition = 'none'
    // camera scale 已由代理唯一的 scaleShell 承担。目标内容不能再次套用
    // contentScale，否则跨 Surface 时会得到 cameraScale^2，文字和间距会被
    // 放大后再突然归一。
    contentLayers.targetScaleShell.style.transform = 'scale(1)'
  }
  const initialContentScale = resolveContentScale(options.contentScale)

  // proxy 创建时已经保留了抓取阶段的布局原点和 transform。MotionState 只
  // 作为控制器的初始状态，不能直接写回 left/top：跟手阶段的 translate3d
  // 仍然承载“布局原点 -> 最后一帧视觉位置”的位移。这里覆盖 left/top 会
  // 和旧 translate 叠加，且相机倍率越偏离 1，首帧跳跃越明显。
  const layoutLeft = parseFloat(proxy.style.left) || proxy.getBoundingClientRect().left
  const layoutTop = parseFloat(proxy.style.top) || proxy.getBoundingClientRect().top
  const startRect = proxy.getBoundingClientRect()
  // getBoundingClientRect() 包含 grabbing 阶段的 rotate/scale，会返回旋转后的
  // 外接矩形。它只能作为当前位置来源，不能作为内容布局尺寸；否则 landing
  // 的第一帧会把旋转外接高度写回代理，跨列时卡片会突然变高。
  const startWidth = parseFloat(proxy.style.width) || startRect.width || target.width
  const startHeight = parseFloat(proxy.style.height) || startRect.height || target.height
  const landingShell = prepareLandingScaleShell(proxy, initialContentScale)
  let landingTargetContentScale = landingShell && options.landingContentScale !== undefined
    ? resolveContentScale(options.landingContentScale)
    : initialContentScale
  const cameraOrigin = options.cameraOrigin?.()
  const initialCameraScale = resolveContentScale(options.landingCameraScale ?? options.contentScale)
  const hasCameraAnchor = Boolean(
    options.cameraShell
    && options.landingMode === 'free'
    && cameraOrigin
    && Number.isFinite(cameraOrigin.left)
    && Number.isFinite(cameraOrigin.top),
  )
  let camGlue: HTMLElement | null = null
  let cameraTrackRaf: number | null = null
  if (hasCameraAnchor && cameraOrigin) {
    // 代理已经挂到 html 下，不能把相机 transform 直接写到代理自身：那会和
    // free landing 的位移、旋转、scale 共用同一个 transform，缩放过程中会
    // 改变 landing 的坐标系。单独的全屏 fixed 外壳只承接相机变化，代理自身
    // 继续运行从释放位置到落点的原始动画。
    camGlue = document.createElement('div')
    camGlue.dataset.runtimeCameraGlue = 'true'
    Object.assign(camGlue.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      right: '0',
      bottom: '0',
      transition: 'none',
      transform: 'translate3d(0, 0, 0)',
      transformOrigin: `${cameraOrigin.left}px ${cameraOrigin.top}px`,
      pointerEvents: 'none',
      zIndex: proxy.style.zIndex,
      willChange: 'transform',
    })
    proxy.parentElement?.appendChild(camGlue)
    camGlue.appendChild(proxy)

    const trackCamera = () => {
      if (!camGlue?.isConnected) return
      const liveOrigin = options.cameraOrigin?.()
      if (liveOrigin && Number.isFinite(liveOrigin.left) && Number.isFinite(liveOrigin.top)) {
        const liveScale = resolveContentScale(options.landingCameraScale ?? options.contentScale)
        const scaleRatio = initialCameraScale > 0.01 ? liveScale / initialCameraScale : 1
        camGlue.style.transform =
          `translate3d(${(liveOrigin.left - cameraOrigin.left).toFixed(2)}px, ${(liveOrigin.top - cameraOrigin.top).toFixed(2)}px, 0) scale(${scaleRatio.toFixed(4)})`
      }
      cameraTrackRaf = window.requestAnimationFrame(trackCamera)
    }
    cameraTrackRaf = window.requestAnimationFrame(trackCamera)
  }
  // 宽高过渡不能把左上角当作唯一锚点：源卡与目标卡尺寸不同时，左边会先
  // 对齐而右边在收缩期间继续漂移。让控制器追踪中心点，帧内再换算回左上角，
  // 最终仍精确落到目标 rect。
  const centeredTarget = (next: LandingRect) => ({
    left: next.left - (startWidth - next.width) / 2,
    top: next.top - (startHeight - next.height) / 2,
    width: next.width,
    height: next.height,
  })
  let currentTarget = target
  const landingStartedAt = performance.now()
  let settled = false
  const hasTargetDismiss = options.landingMode === 'target' && Boolean(scaleShell)
  const dismissDuration = hasTargetDismiss
    ? options.dismiss?.duration ?? duration
    : 0
  let motionArrived = false
  let settleCheckRaf: number | null = null
  let dismissFinished = !hasTargetDismiss
  let timeoutId: number | null = null
  let dismissTimeoutId: number | null = null
  let timeoutDeadline = 0
  let resolveFinished: () => void = () => undefined
  const finished = new Promise<void>(resolve => { resolveFinished = resolve })

  const finish = () => {
    if (settled) return
    settled = true
    motion.stop()
    if (timeoutId !== null) window.clearTimeout(timeoutId)
    if (dismissTimeoutId !== null) window.clearTimeout(dismissTimeoutId)
    timeoutId = null
    dismissTimeoutId = null
    if (cameraTrackRaf !== null) window.cancelAnimationFrame(cameraTrackRaf)
    cameraTrackRaf = null
    if (settleCheckRaf !== null) window.cancelAnimationFrame(settleCheckRaf)
    settleCheckRaf = null
    camGlue?.remove()
    camGlue = null
    resolveFinished()
  }

  const finishWhenVisualsSettled = () => {
    if (motionArrived && dismissFinished) finish()
  }

  const settle = () => {
    if (settled) return
    if (settleCheckRaf !== null) return
    settleCheckRaf = window.requestAnimationFrame(() => {
      settleCheckRaf = null
      if (settled) return
      const liveTarget = options.readTarget?.()
      if (liveTarget && liveTarget.width > 0 && liveTarget.height > 0) {
        const changed = Math.abs(liveTarget.left - currentTarget.left) >= 0.5
          || Math.abs(liveTarget.top - currentTarget.top) >= 0.5
          || Math.abs(liveTarget.width - currentTarget.width) >= 0.5
          || Math.abs(liveTarget.height - currentTarget.height) >= 0.5
        if (changed) {
          currentTarget = liveTarget
          const next = centeredTarget(liveTarget)
          const nextScaleX = options.landingMode === 'target' ? 1
            : next.width / (options.landingMode === 'free' ? visualStartWidth : startWidth)
          const nextScaleY = options.landingMode === 'target' ? 1
            : next.height / (options.landingMode === 'free' ? visualStartHeight : startHeight)
          motion.retarget({ x: next.left, y: next.top, scaleX: nextScaleX, scaleY: nextScaleY })
          motion.start()
          return
        }
      }
      motionArrived = true
      finishWhenVisualsSettled()
    })
  }
  const onMotionFrame = (frame: { x: number; y: number; scaleX: number; scaleY: number; rotateX: number; rotateZ: number }) => {
      const left = frame.x
      const top = frame.y
      proxy.style.transform = `translate3d(${(left - layoutLeft).toFixed(2)}px, ${(top - layoutTop).toFixed(2)}px, 0) scale(${frame.scaleX.toFixed(4)}, ${frame.scaleY.toFixed(4)})`
      getProxyAttitude(proxy).style.transform =
        `perspective(760px) rotateX(${frame.rotateX.toFixed(2)}deg) rotateZ(${frame.rotateZ.toFixed(2)}deg)`
      if (options.landingMode === 'free' && landingShell && options.cameraShell) {
        // free 的 holder 负责从源视觉尺寸收敛到目标视觉尺寸，scaleShell 只
        // 保留抓取瞬间的相机倍率。把 frame.scale 再写进 scaleShell 会让同一
        // 个落地比例同时作用于 holder 和内容，造成代理先缩小/放大一遍再跳到
        // target；摄像机在动画期间的变化由外层 camGlue 单独跟随。
        applyLandingScale(
          landingShell,
          startWidth,
          startHeight,
          initialContentScale,
        )
      } else {
        // 普通列表/看板的列宽差是布局变化，不是整体视觉缩放。尤其是有无滚动条
        // 的两列，targetScale 可能达到 1.1；写入 scaleShell 会连字体和内边距一起
        // 放大，落地揭示本体时就会出现尺寸跳变。恢复旧版的布局 landing：让代理
        // width/height 过渡，内容按目标宽度自然重排，交叉淡化仍由 contentLayers 保留。
        const width = startWidth * frame.scaleX
        const height = startHeight * frame.scaleY
        const layoutLeftForSize = frame.x + (startWidth - width) / 2
        const layoutTopForSize = frame.y + (startHeight - height) / 2
        proxy.style.width = `${width.toFixed(2)}px`
        proxy.style.height = `${height.toFixed(2)}px`
        proxy.style.transform = `translate3d(${(layoutLeftForSize - layoutLeft).toFixed(2)}px, ${(layoutTopForSize - layoutTop).toFixed(2)}px, 0)`
        getProxyAttitude(proxy).style.transform =
          `perspective(760px) rotateX(${frame.rotateX.toFixed(2)}deg) rotateZ(${frame.rotateZ.toFixed(2)}deg)`
        // 抓起阶段已经把相机倍率写入 scaleShell；落地的尺寸收敛不能把它
        // 重置为 1，否则松手时会再播放一遍相机缩放。
        if (options.landingMode === 'target' && hasTargetDismiss) {
          // 语义目标的 scaleShell 由 target dismiss 独占。若在这里继续按
          // 相机倍率同步，会把第一帧写入的缩小比例覆盖回 1，导致文件拖入
          // 文件夹时只有淡出、没有旧版的缩小动画。
        } else if (landingShell) {
          // 外框收敛的是目标列的屏幕尺寸；scaleShell 保留抓取时的相机
          // 倍率，并同步调整其基准布局尺寸。这样画布放大/缩小时内容仍按
          // 世界尺寸排版，跨列时又不会把文字额外放大一遍。
          const elapsed = Math.max(0, performance.now() - landingStartedAt)
          const progress = Math.min(1, elapsed / Math.max(1, duration))
          const easedProgress = 1 - (1 - progress) ** 3
          const cameraScale = initialContentScale
            + (landingTargetContentScale - initialContentScale) * easedProgress
          if (options.cameraShell) {
            applyLandingScale(
              landingShell,
              width,
              height,
              options.landingContentScale !== undefined
                ? cameraScale
                : frame.scaleX * cameraScale,
            )
          } else {
            landingShell.shell.style.left = '0px'
            landingShell.shell.style.top = '0px'
            landingShell.shell.style.width = `${width}px`
            landingShell.shell.style.height = `${height}px`
            landingShell.shell.style.transform = 'scale(1)'
          }
        }
      }
  }
  // 同一 free Surface 内的落地使用单调缓出，避免重复注入已经在释放阶段
  // 计算过的惯性落点。跨 Surface 时则必须沿用卡片物理 settle：抽屉卡片
  // 的内容已经从 grid 脱离，位移、尺寸和倾斜要由同一个 MotionController
  // 连续接管，否则看起来会像代理自身直接变形。
  const motion = options.landingMode === 'free'
    ? createFreeLandingMotion({
        duration,
        easing,
        stiffness: options.stiffness,
        damping: options.damping,
        rotationDecay: options.rotationDecay,
        onFrame: onMotionFrame,
        onArrived: settle,
      })
    : createCardMotionController({
        mode: 'settle',
        onFrame: onMotionFrame,
        onArrived: settle,
      })
  const releaseSpeed = Math.hypot(options.motionState?.vx ?? 0, options.motionState?.vy ?? 0)
  const releaseDamping = options.releaseDamping ?? 0.78
  const baseProfile = options.targetMotion
    ? {
        position: { ...LANDING_PROFILE.position, ...options.targetMotion.position },
        scale: { ...LANDING_PROFILE.scale, ...options.targetMotion.scale },
      }
    : LANDING_PROFILE
  if (options.landingMode !== 'free') {
    const springMotion = motion as CardMotionController
    springMotion.setProfile(releaseSpeed > 30
      ? {
          ...baseProfile,
          position: {
            ...baseProfile.position,
            damping: baseProfile.position.damping * releaseDamping,
          },
        }
      : baseProfile)
  }
  const seededFrame = {
    // grabbing 是弹簧跟手，松手指针位置和卡片最后视觉位置可能不同。
    // 有 MotionState 时必须从 controller 的最后一帧开始，sourceRect 只作为旧流程兜底。
    x: options.motionState?.x ?? startRect.left,
    y: options.motionState?.y ?? startRect.top,
    vx: options.motionState?.vx ?? 0,
    vy: options.motionState?.vy ?? 0,
    // 即使 pointerdown 后没有产生位移，抓取态仍有 scale(1.03)；旋转也必须
    // 在 handoff 前保留，否则第一帧会先回正再开始 landing。
    scaleX: options.motionState?.scaleX ?? 1,
    scaleY: options.motionState?.scaleY ?? 1,
    rotateX: options.motionState?.rotateX ?? 0,
    rotateZ: options.motionState?.rotateZ ?? 0,
  }
  motion.seed({
    // grabbing 是弹簧跟手，松手指针位置和卡片最后视觉位置可能不同。
    // 有 MotionState 时必须从 controller 的最后一帧开始，sourceRect 只作为旧流程兜底。
    x: seededFrame.x,
    y: seededFrame.y,
    vx: seededFrame.vx,
    vy: seededFrame.vy,
    // 即使 pointerdown 后没有产生位移，抓取态仍有 scale(1.03)。
    // 不能在 landing 起点把它重置为 1，否则目标位置相同的回放会被
    // MotionController 判定为已到达，代理瞬间消失。
    scaleX: seededFrame.scaleX,
    scaleY: seededFrame.scaleY,
    rotateX: seededFrame.rotateX,
    rotateZ: seededFrame.rotateZ,
  })
  // seed() 只更新控制器状态，首个 RAF 之前不会触发 onFrame。同步提交同一
  // 个 seeded frame，确保 handoff 从抓取代理的最后视觉尺寸/姿态开始，避免
  // 第一帧仍停在旧尺寸后再突然追上 motionState。
  onMotionFrame(seededFrame)
  // 代理定位壳的运动坐标是外壳左上角，而相机/尺寸缩放由内部 shell 居中承载。
  // 因此 free landing 也要把外壳移动到能让缩放后的 shell 对齐目标矩形的位置；
  // 直接使用 target.left/top 会在缩小时向右下、放大时向左上偏移。
  const initialTarget = centeredTarget(target)
  // 语义目标（文件夹卡、面包屑）统一以目标中心作为落点，尺寸收缩交给
  // target dismiss 负责。若再把代理缩到面包屑文字按钮的尺寸，会先发生一
  // 次目标尺寸缩放、再发生一次 dismiss 缩放，导致面包屑动画明显快于文件夹卡。
  const landingBaseWidth = landingShell?.baseWidth ?? startWidth
  const landingBaseHeight = landingShell?.baseHeight ?? startHeight
  if (landingShell && options.landingMode !== 'free' && options.landingMode !== 'target') {
    if (!(landingTargetContentScale > 0)) {
      landingTargetContentScale = landingBaseWidth > 0
        ? initialTarget.width / landingBaseWidth
        : 1
    }
    // 抽屉回收和普通 grid 落地都需要把抓取时的相机倍率平滑还原到目标
    // Surface 的视觉倍率；不能把它混进 Motion 的外框 scale，否则会二次放大。
    landingShell.shell.style.transformOrigin = '0 0'
    if (options.cameraShell) {
      landingShell.shell.style.left = `${((startWidth - landingBaseWidth * initialContentScale) / 2).toFixed(2)}px`
      landingShell.shell.style.top = `${((startHeight - landingBaseHeight * initialContentScale) / 2).toFixed(2)}px`
      landingShell.shell.style.transform = initialContentScale === 1
        ? 'scale(1)'
        : `scale(${initialContentScale}, ${initialContentScale})`
    } else {
      landingShell.shell.style.left = '0px'
      landingShell.shell.style.top = '0px'
      landingShell.shell.style.width = `${startWidth}px`
      landingShell.shell.style.height = `${startHeight}px`
      landingShell.shell.style.transform = 'scale(1)'
    }
    // Camera shell 的归一化只是把当前视觉尺寸转换为 landing 外壳尺寸，
    // 不应再单独播放一段缩放过渡；真正的尺寸动画由代理外壳统一承载。
    landingShell.shell.style.transition = 'none'
  }
  // Motion 的 scale 是相对于 landing shell 基准尺寸的。相机缩放已经由
  // initialContentScale 应用到 shell，因此目标比例必须以松手瞬间的视觉尺寸
  // 为分母，不能再直接用 holder 的固定宽高，否则 camera scale 会被计算两次。
  const visualStartWidth = landingBaseWidth * initialContentScale
  const visualStartHeight = landingBaseHeight * initialContentScale
  const targetScale = options.landingMode === 'target'
    ? { scaleX: 1, scaleY: 1 }
    : options.landingMode === 'free'
      ? {
          scaleX: visualStartWidth > 0 ? initialTarget.width / visualStartWidth : 1,
          scaleY: visualStartHeight > 0 ? initialTarget.height / visualStartHeight : 1,
        }
      : {
          // Motion 负责代理外框从抓取尺寸到目标尺寸的布局收敛；相机
          // 倍率只由 scaleShell 负责，不能再混进这里的尺寸基准。
          scaleX: startWidth > 0 ? initialTarget.width / startWidth : 1,
          scaleY: startHeight > 0 ? initialTarget.height / startHeight : 1,
        }
  motion.setTarget({
    x: initialTarget.left,
    y: initialTarget.top,
    scaleX: targetScale.scaleX,
    scaleY: targetScale.scaleY,
  })
  // 视觉属性仍然隔一帧切换，确保起始阴影/圆角/背景有机会先被绘制。
  proxy.style.transition = ''
  const visualTransition = [
    ...(options.landingMode !== 'target'
      ? [
          `left ${duration}ms ${easing}`,
          `width ${duration}ms ${easing}`,
          `transform ${duration}ms ${easing}`,
          `grid-template-columns ${duration}ms ${easing}`,
        ]
      : []),
    `box-shadow ${duration}ms ${easing}`,
    `border-radius ${duration}ms ${easing}`,
    `border-color ${duration}ms ${easing}`,
    `backdrop-filter ${duration}ms ${easing}`,
    `-webkit-backdrop-filter ${duration}ms ${easing}`,
    `background-color ${duration}ms ${easing}`,
    `background-image ${duration}ms ${easing}`,
    `opacity ${duration}ms ${easing}`,
  ].join(', ')
  if (contentLayers) contentLayers.toLayer.style.transition = visualTransition
  // 双层 morph 的 fromLayer 保留玻璃抓取阴影并随 opacity 淡出，toLayer 保留本体阴影；
  // 只在没有内容分层时对单一代理做阴影插值，避免两层目标阴影叠加。
  if (!contentLayers) prepareBoxShadowMorph(sourceSurface, targetShadow, visualTransition)
  requestAnimationFrame(() => {
    if (settled) return
    // 列表代理在抓取阶段是紧凑宽度；回到本体行时让内容层先平滑恢复
    // 全宽布局，再由 landing 生命周期揭示本体，避免最后一帧突然切换。
    if (options.landingMode !== 'target') {
      content.dataset.runtimePhase = 'landing'
      if (content.dataset.runtimeCompact === 'true') {
        content.style.left = '0'
        content.style.width = '100%'
        content.style.transform = 'none'
        // 清空覆盖，退回本体 CSS 里定义的真实列宽——轨道数量没变，只是宽度值从紧凑
        // 态的 0px 平滑插值回真实值，字段落回它们在本体行里原本的准确位置，不是
        // 换一套布局瞬间跳变。
        content.style.gridTemplateColumns = ''
        // 有内容双层时，源层是 grabbing 阶段的完整快照，必须保留到交叉
        // 淡化结束。这里若把源层恢复成普通布局，文字、列轨道和间距会在
        // landing 首帧直接跳到目标排布。
        if (!contentLayers) {
          content.style.gridTemplateColumns = ''
          delete content.dataset.runtimeCompact
        }
      }
    }
    // 抓取态和 landing 态可能在同一个 rAF 内交接（静止鼠标松手尤其容易发生）。
    // 先提交抓取态的阴影与 transition，再写入目标阴影，否则浏览器会把两次写入
    // 合并成一次样式计算，文件卡看起来就像阴影瞬间消失。旧版 landing clone
    // 在交接前也通过强制布局读取保留了这一帧。
    if (targetShadow != null) {
      void content.offsetWidth
      // 目标阴影必须落在真实目标内容层，不能写到透明的 morph 根壳上；根壳
      // border-radius 为 0，否则会出现画布拖入时的直角方形残影。
      setVisualBoxShadow(targetSurface, targetShadow)
    }
    if (targetRadius != null) targetSurface.style.borderRadius = targetRadius
    // 抓起时 applyDraggingGlassStyle 给了四边一圈白边（玻璃态），落地要 morph 回
    // 目标本体真实的 border——本体大多只在顶部有一条 inset 高光、没有四边描边，
    // 不清掉这份抓起态残留会导致代理揭示前一直带着四边高光，跟本体明显不一样。
    if (targetBorder != null) targetSurface.style.border = targetBorder
    // 同上：backdrop-filter 也是抓起态才有的玻璃模糊，本体基本是 none，
    // 同样得纳入 morph，否则代理全程糊着，揭示瞬间才"唰"地变清晰。
    if (targetBackdropFilter != null) {
      targetSurface.style.backdropFilter = targetBackdropFilter
      targetSurface.style.setProperty('-webkit-backdrop-filter', targetBackdropFilter)
    }
    if (targetBackground != null) {
      // 分开设置：background 简写会重置 background-image，业务卡片常用
      // linear-gradient（在 backgroundImage），渐变会被 backgroundColor
      // 覆盖丢失（透明底）。先设 backgroundColor，再设 backgroundImage。
      targetSurface.style.backgroundColor = targetBackground
      if (options.targetBackgroundImage) {
        targetSurface.style.backgroundImage = options.targetBackgroundImage
      }
    }
      if (targetOpacity != null) targetSurface.style.opacity = targetOpacity
    if (hasTargetDismiss && scaleShell) {
      // 语义目标的缩小淡出从 landing 第一帧开始，与位置/旋转运动同步；
      // 不能等 onArrived，否则会变成飞完后突然缩小。
      const dismissEasing = options.dismiss?.easing ?? easing
      const dismissScale = options.dismiss?.scale ?? 0.72
      scaleShell.style.transformOrigin = '50% 50%'
      scaleShell.style.transition = `transform ${dismissDuration}ms ${dismissEasing}`
      targetSurface.style.transition = `opacity ${dismissDuration}ms ${dismissEasing}`
      scaleShell.style.transform = `scale(${dismissScale})`
      targetSurface.style.opacity = '0'
      dismissTimeoutId = window.setTimeout(() => {
        dismissTimeoutId = null
        dismissFinished = true
        finishWhenVisualsSettled()
      }, dismissDuration + 40)
    }
    if (contentLayers) {
      prepareContentMorph(contentLayers, duration, easing)
    }
  })
  const scheduleMotionTimeout = (extraMs = 0) => {
    if (timeoutId !== null) window.clearTimeout(timeoutId)
    timeoutDeadline = performance.now() + Math.max(2000, duration * 8, 5000) + extraMs
    timeoutId = window.setTimeout(() => {
      timeoutId = null
      // 超时只作为异常状态的最终保险，不参与正常 landing 完成判断。
      if (!settled && performance.now() >= timeoutDeadline) settle()
    }, Math.max(2000, duration * 8, 5000) + extraMs)
  }
  scheduleMotionTimeout()
  const coast = options.coast
  if (options.landingMode === 'free') {
    motion.start()
  } else if (coast && coast.maxDistance > 0 && Math.hypot(options.motionState?.vx ?? 0, options.motionState?.vy ?? 0) > coast.minVelocity) {
    ;(motion as CardMotionController).startCoastThenSettle(coast)
  } else {
    motion.start()
  }

  return {
    finished,
    retarget(nextTarget) {
      if (settled) return
      currentTarget = nextTarget
      // 目标发生布局移动时，给新的弹簧轨迹完整的收敛窗口，避免旧 duration
      // 到期后提前 reveal，造成“移动到一半瞬间到目标”的假跳变。
      scheduleMotionTimeout(1000)
      const next = centeredTarget(currentTarget)
      const nextScaleX = options.landingMode === 'target' ? 1 : options.landingMode === 'free'
        ? next.width / visualStartWidth
        : next.width / startWidth
      const nextScaleY = options.landingMode === 'target' ? 1 : options.landingMode === 'free'
        ? next.height / visualStartHeight
        : next.height / startHeight
      if (landingShell && options.landingMode !== 'free' && options.landingMode !== 'target'
        && options.landingContentScale === undefined) {
        landingTargetContentScale = landingBaseWidth > 0
          ? next.width / landingBaseWidth
          : landingTargetContentScale
      }
      motion.setTarget({
        x: next.left,
        y: next.top,
        scaleX: nextScaleX,
        scaleY: nextScaleY,
      })
    },
  }
}

export function destroyDragProxy(proxy: HTMLElement) {
  if (!activeDragProxies.has(proxy)) return
  activeDragProxies.delete(proxy)
  const cameraGlue = proxy.parentElement?.dataset.runtimeCameraGlue === 'true'
    ? proxy.parentElement
    : null
  cameraGlue?.remove()
  if (!cameraGlue) proxy.remove()
}

/** 清理 demo 中上一次异常中断留下的代理节点。 */
export function destroyAllDragProxies(): void {
  for (const proxy of activeDragProxies) proxy.remove()
  activeDragProxies.clear()
  document.querySelectorAll<HTMLElement>('[data-runtime-proxy="true"]').forEach(proxy => proxy.remove())
  document.querySelectorAll<HTMLElement>('[data-runtime-camera-glue="true"]').forEach(glue => glue.remove())
}

export function destroyDragProxiesByCardId(cardId: string): void {
  for (const proxy of Array.from(activeDragProxies)) {
    if (proxy.dataset.card !== cardId) continue
    if (!proxy.isConnected) {
      activeDragProxies.delete(proxy)
      continue
    }
    destroyDragProxy(proxy)
  }
}

/**
 * "detach" 策略专用：不克隆，直接让本体自己脱离文档流、用 position:fixed
 * 跟手。配合 Vue 的 <Teleport :disabled="!controlled"> 使用——本体在被
 * Runtime 接管期间会被 Teleport 搬到 body，这里只负责钉住视觉位置，不碰
 * DOM 树结构（DOM 搬运交给 Vue 自己做，Runtime 不做手工 reparent，见
 * docs/DESIGN.md 对"手工挪动 Vue 追踪的节点"的风险提示）。
 */
const floatingSnapshots = new WeakMap<HTMLElement, { style: string }>()
const LIVE_LAYOUT_PROPERTIES = ['left', 'top', 'right', 'bottom', 'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight', 'zIndex'] as const

function restoreFloatingStyle(element: HTMLElement, cssText: string): void {
  const liveLayout = Object.fromEntries(
    LIVE_LAYOUT_PROPERTIES.map(property => [property, element.style[property]]),
  ) as Record<typeof LIVE_LAYOUT_PROPERTIES[number], string>
  element.style.cssText = cssText
  for (const property of LIVE_LAYOUT_PROPERTIES) {
    if (liveLayout[property] !== '') element.style[property] = liveLayout[property]
  }
}
/** source 节点 ↔ 抓取阶段独立 proxy 的映射。proxy 挂在 <html> 下，避免
 *  .glass-card 祖先的 backdrop-filter 创建 containing block 拦截 fixed
 *  坐标系，同时不 reparent 业务 DOM，Vue 追踪不受影响。 */
const floatingProxies = new WeakMap<HTMLElement, HTMLElement>()
const pickupHandoffPending = new WeakSet<HTMLElement>()

export function applyFloatingStyle(
  el: HTMLElement,
  rect: DOMRect,
  options: {
    layout?: DragProxyLayoutConfig
    keepSourceVisible?: boolean
    contentScale?: number | (() => number)
    cameraShell?: boolean
    affordancesSelector?: string | readonly string[]
    proxyZIndex?: number
  } = {},
) {
  floatingSnapshots.set(el, { style: el.getAttribute('style') ?? '' })
  // 抓取阶段的视觉交给独立 proxy：挂在 <html> 下，containing block 是 viewport，
  // 不会被 .glass-card 祖先的 backdrop-filter / overflow:hidden 裁切，pointer
  // 坐标也能直接对齐。source 节点保持原 DOM 位置，仅 visibility:hidden，Vue 重渲染
  // 时仍然能正确识别这个节点，不会出现"新旧两张卡片同时存在"。
  // 抓取态阴影必须从零开始，不能继承本体当前阴影作为起点；否则卡片还没
  // 浮起就已经带着一层深阴影。下一帧由 beginFloatingPickup() 统一提交浮起
  // 阴影，让阴影和卡片的启动变换同时进入过渡。
  const proxy = createDragProxy(el, rect, {
    glass: false,
    layout: options.layout,
    contentScale: options.contentScale,
    cameraShell: options.cameraShell,
    affordancesSelector: options.affordancesSelector,
    proxyZIndex: options.proxyZIndex,
  })
  const content = getProxyContent(proxy)
  // 抓起 proxy 同样脱离了 source 的 DOM 继承链；landing 入口由
  // VisualAdapter 处理，这里补齐 grabbing 入口，避免代理回退到 body 字体。
  preserveProxyVisualContext(el, content)
  const pickupTransition = content.style.transition
  // createDragProxy() 为后续视觉过渡预先设置了 box-shadow transition；如果直接
  // 把初始阴影改成 none，浏览器会把创建时的深阴影也纳入过渡，首帧读到的仍是
  // 深阴影。先冻结、提交零阴影，再恢复 transition，下一帧才开始真正的 0 -> 浮起。
  content.style.transition = 'none'
  setVisualBoxShadow(content, 'none')
  void content.offsetWidth
  content.style.transition = pickupTransition
  const compact = Boolean(options.layout?.compact)
  proxy.style.zIndex = String(options.proxyZIndex ?? 1000)
  // 首帧保留源卡片样式；下一帧才进入 grabbing 视觉，形成从原位被拎起的过渡。
  proxy.style.transform = 'scale(1)'
  proxy.style.transition = 'transform 150ms cubic-bezier(.22,1,.36,1), box-shadow 150ms ease, background 150ms ease, opacity 150ms ease'
  pickupHandoffPending.add(proxy)
  floatingProxies.set(el, proxy)
  if (!options.keepSourceVisible) el.style.visibility = 'hidden'
  requestAnimationFrame(() => {
    // landing 可能在首次抓取帧绘制前就接管代理（静止松手时尤其容易发生）。
    // 一旦 takeFloatingProxy() 清掉了 handoff 标记，抓取态玻璃样式就不能再
    // 写回，否则会覆盖 landing 已经提交的阴影/背景，表现为画布文件卡落地
    // 时阴影瞬间消失或在下一帧又被抓取态覆盖。
    if (!proxy.isConnected || !pickupHandoffPending.has(proxy)) {
      return
    }
    beginFloatingPickup(proxy, compact)
  })
}

/** 在抓取动画首帧提交抓取态视觉；快速 pointermove 会复用同一入口。 */
function beginFloatingPickup(proxy: HTMLElement, compact = false, applyScale = true): void {
  if (!proxy.isConnected) return
  const content = getProxyContent(proxy)
  if (defaultDraggingGlassEnabled) applyDraggingGlassStyle(content)
  else setVisualBoxShadow(content, '0 12px 24px rgba(0,0,0,.18)')
  if (applyScale) proxy.style.transform = `scale(${compact ? 1 : 1.03})`
}

export function getFloatingProxy(el: HTMLElement): HTMLElement | undefined {
  return floatingProxies.get(el)
}

/** 将抓取阶段的 proxy 转交给 Runtime 的统一 landing 生命周期，不移除节点。 */
export function takeFloatingProxy(el: HTMLElement): HTMLElement | undefined {
  const proxy = floatingProxies.get(el)
  if (!proxy) return undefined
  // MoveAdapter 会在创建代理后立即接管它。不能在这里同步写入最终阴影，
  // 否则浏览器还没绘制起点就会直接显示终点；延后一帧让阴影与控制器的
  // 1 -> 1.03 缩放拥有同一个视觉起点。
  requestAnimationFrame(() => {
    if (!proxy.isConnected || getProxyContent(proxy).dataset.runtimePhase === 'landing') return
    beginFloatingPickup(proxy, getProxyContent(proxy).dataset.runtimeCompact === 'true', false)
  })
  pickupHandoffPending.delete(proxy)
  floatingProxies.delete(el)
  floatingSnapshots.delete(el)
  return proxy
}

export function moveFloating(el: HTMLElement, x: number, y: number, offsetX: number, offsetY: number) {
  const target = floatingProxies.get(el) ?? el
  const left = `${x - offsetX}px`
  const top = `${y - offsetY}px`
  if (pickupHandoffPending.has(target)) {
    pickupHandoffPending.delete(target)
    beginFloatingPickup(target, getProxyContent(target).dataset.runtimeCompact === 'true')
    target.style.transition = 'left 120ms cubic-bezier(.22,1,.36,1), top 120ms cubic-bezier(.22,1,.36,1), transform 120ms cubic-bezier(.22,1,.36,1), box-shadow 120ms ease'
    requestAnimationFrame(() => {
      target.style.left = left
      target.style.top = top
      window.setTimeout(() => {
        if (target.isConnected) target.style.transition = 'none'
      }, 140)
    })
    return
  }
  target.style.left = left
  target.style.top = top
}

export function clearFloatingStyle(el: HTMLElement) {
  const proxy = floatingProxies.get(el)
  if (proxy) {
    pickupHandoffPending.delete(proxy)
    proxy.remove()
    activeDragProxies.delete(proxy)
    floatingProxies.delete(el)
  }
  const snapshot = floatingSnapshots.get(el)
  if (snapshot) restoreFloatingStyle(el, snapshot.style)
  floatingSnapshots.delete(el)
}

/**
 * 松手后本体虽然已经被 Vue/Teleport 插回真实列表 DOM，但只要还是
 * applyFloatingStyle 设的 position:fixed，就不占父级正常布局的空间——
 * 兄弟卡 FLIP、容器高度动画这类"量一下最终布局有多高"的计算，测到的
 * 还是"这张卡不存在"的旧高度，跟真实卡数对不上。不能直接调用完整的
 * clearFloatingStyle 提前复位：那样本体会立刻跳回正常位置可见，抢在
 * 落地代理（接管视觉的那个临时对象）还没接管完成前露出来，表现为闪一下。
 * 这里只解除影响布局的几个属性，同时用 visibility:hidden 保持不可见——
 * 布局计算立刻能测到正确高度，视觉上依旧交给落地代理，等真正落地完成
 * 再由 clearFloatingStyle 整体恢复。
 */
export function settleFloatingLayout(el: HTMLElement): void {
  el.style.position = ''
  el.style.left = ''
  el.style.top = ''
  el.style.width = ''
  el.style.height = ''
  el.style.margin = ''
  el.style.transform = ''
  el.style.visibility = 'hidden'
}
const activeDragProxies = new Set<HTMLElement>()
let defaultDraggingGlassEnabled = false

export function setDefaultDraggingGlassEnabled(enabled: boolean): void {
  defaultDraggingGlassEnabled = enabled
}

export function isDefaultDraggingGlassEnabled(): boolean {
  return defaultDraggingGlassEnabled
}

export function applyDraggingGlassStyle(element: HTMLElement): void {
  element.style.background = 'rgba(255, 255, 255, 0.42)'
  element.style.backdropFilter = 'blur(12px) saturate(1.15)'
  element.style.setProperty('-webkit-backdrop-filter', 'blur(12px) saturate(1.15)')
  element.style.border = '1px solid rgba(255, 255, 255, 0.72)'
  setVisualBoxShadow(element, '0 22px 50px rgba(30, 35, 60, 0.30)')
  element.style.opacity = '0.97'
}

/**
 * visibility ownership guard：记录每个 DOM 元素当前 visibility 的 owner sessionId。
 * 用于 detach 策略中 landing 阶段隐藏本体时登记 owner，dispose 恢复时只允许当前
 * owner 恢复。regrab 时旧 session 的 dispose 异步触发，但 owner 已被新 session
 * 更新，跳过 visibility 恢复，避免旧 session 把 visibility 从 'hidden' 恢复为空
 * 而新 session 的落地动画还在进行中。
 */
const visibilityOwner = new Map<HTMLElement, string>()

function probeVisibilityWrite(
  kind: string,
  element: HTMLElement,
  ownerId: string,
  extra: Record<string, unknown> = {},
): void {
  if (typeof globalThis === 'undefined'
    || (globalThis as { __GUGU_RUNTIME_HOVER_PROBE__?: boolean }).__GUGU_RUNTIME_HOVER_PROBE__ !== true) return
  const style = getComputedStyle(element)
  console.log('[mind-hover-probe] runtime-visibility-write ' + JSON.stringify({
    kind,
    ownerId,
    tag: element.tagName.toLowerCase(),
    className: element.className,
    objectId: element.dataset.objectId ?? null,
    layoutKey: element.dataset.layoutKey ?? null,
    runtimePhase: element.dataset.runtimePhase ?? null,
    connected: element.isConnected,
    hovered: element.matches(':hover'),
    inline: {
      visibility: element.style.visibility,
      opacity: element.style.opacity,
      transform: element.style.transform,
      transition: element.style.transition,
    },
    computed: {
      visibility: style.visibility,
      opacity: style.opacity,
      transform: style.transform,
      transition: style.transition,
    },
    stack: new Error().stack?.split('\\n').slice(2, 7),
    ...extra,
  }))
}

/**
 * 隐藏目标元素并登记 visibility ownership。
 * 只有登记的 owner 才能通过 revealElement() 恢复可见性。
 */
export function concealElement(el: HTMLElement, ownerId: string): void {
  probeVisibilityWrite('conceal-before', el, ownerId)
  visibilityOwner.set(el, ownerId)
  el.style.visibility = 'hidden'
  probeVisibilityWrite('conceal-after', el, ownerId)
}

/**
 * 接管一个已经被旧拖拽 Session 隐藏的本体。
 * regrab 会先打断旧 Session，再由新 Session 重新创建浮动代理；此时本体
 * 仍需保持隐藏，但后续 preserveTarget 的 reveal 必须能由新 owner 执行。
 */
export function claimVisibilityOwnership(el: HTMLElement, ownerId: string): void {
  if (el.style.visibility === 'hidden' || getComputedStyle(el).visibility === 'hidden') {
    visibilityOwner.set(el, ownerId)
  }
}

/**
 * 恢复元素的可见性。只有当前 owner 才能恢复，非 owner 调用无效果。
 * 返回是否实际执行了恢复操作。
 */
export function revealElement(el: HTMLElement, ownerId: string): boolean {
  const isOwner = visibilityOwner.get(el) === ownerId
  probeVisibilityWrite('reveal-before', el, ownerId, { isOwner })
  if (isOwner) {
    el.style.visibility = ''
    visibilityOwner.delete(el)
  }
  probeVisibilityWrite('reveal-after', el, ownerId, { isOwner })
  return isOwner
}

/**
 * 解除 visibility ownership（不修改元素可见性）。
 * 用于 regrab 场景：旧 session 的 dispose 异步触发时检查 owner 不匹配，
 * 跳过 visibility 恢复。
 */
export function releaseVisibilityOwnership(el: HTMLElement, ownerId: string): void {
  if (visibilityOwner.get(el) === ownerId) {
    visibilityOwner.delete(el)
  }
}

export function createDragPlaceholder(source: HTMLElement, rect: DOMRect): HTMLElement {
  const placeholder = document.createElement('div')
  placeholder.dataset.runtimePlaceholder = 'true'
  placeholder.style.width = `${rect.width}px`
  placeholder.style.height = `${rect.height}px`
  placeholder.style.flex = '0 0 auto'
  placeholder.style.visibility = 'hidden'
  placeholder.style.pointerEvents = 'none'
  source.parentElement?.insertBefore(placeholder, source)
  return placeholder
}

export function destroyDragPlaceholder(placeholder: HTMLElement): void {
  placeholder.remove()
}
