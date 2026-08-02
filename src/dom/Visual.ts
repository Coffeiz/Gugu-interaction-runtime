import type { VisualContext } from './VisualAdapterTypes'
import { DEFAULT_MOTION_PROFILE } from './MotionProfile'
import { createCardMotionController } from '../motion/CardMotionController'
import type { MotionState } from '../motion/CardMotionController'
import { LANDING_PROFILE } from '../motion/MotionProfile'


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
  // 只控制 proxy 本身的 pointerEvents，不碰 overlay。
  // overlay pointerEvents 保持 none，让事件穿透到下方 DOM，
  // 其他卡片的拖拽不受影响。只有当前 proxy 可点击。
  proxy.style.pointerEvents = enabled ? 'auto' : 'none'
}

export interface ProxyVisualState {
  transform: string
  boxShadow: string
  opacity: string
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
  options: { glass?: boolean } = {},
): HTMLElement {
  // 与 main 看板保持一致：定位壳只包一层缩放壳，卡片内容保留自己的布局。
  // perspective/rotate 由定位壳统一承载，不额外引入业务侧不存在的姿态节点。
  const proxy = document.createElement('div')
  const scaleShell = document.createElement('div')
  const content = source.cloneNode(true) as HTMLElement
  scaleShell.dataset.runtimeProxyScaleShell = 'true'
  content.dataset.runtimeProxyContent = 'true'
  Object.assign(scaleShell.style, {
    position: 'absolute', left: '0', top: '0', width: '100%', height: '100%',
    transformOrigin: '0 0', pointerEvents: 'none',
  })
  Object.assign(content.style, {
    position: 'absolute', left: '0', top: '0', width: '100%', height: '100%',
    boxSizing: 'border-box', margin: '0', pointerEvents: 'none',
  })
  scaleShell.appendChild(content)
  proxy.appendChild(scaleShell)
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
  proxy.style.width = `${rect.width}px`
  proxy.style.height = `${rect.height}px`
  proxy.style.margin = '0'
  // 之前经一个 data-runtime-overlay 中间容器（fixed + z-index 2147483647）来
  // 统一压 z-index，代理自己只需要 z-index:1。现在代理直接挂到 <html> 下，
  // 逃出玻璃裁切靠的是"脱离被裁切祖先的 DOM 子树"这件事本身（重新挂载到
  // document.documentElement），不是那层 overlay 容器；容器唯一的另一个作用
  // 是集中管理 z-index，去掉之后这个值要留在代理自己身上，直接顶到最高层。
  proxy.style.zIndex = '2147483647'
  proxy.style.pointerEvents = 'none'
  proxy.style.visibility = 'visible'
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
  proxy.style.transform = 'perspective(760px) rotateX(5deg) scale(1.03)'
  if (defaultDraggingGlassEnabled && options.glass !== false) applyDraggingGlassStyle(content)
  else content.style.boxShadow = '0 12px 24px rgba(0,0,0,.18)'
  content.style.transition = 'box-shadow .15s ease, border-radius .15s ease, background-color .15s ease, opacity .15s ease'
  proxy.style.transition = 'transform .15s ease'
  // 逃出玻璃裁切（overflow:hidden / backdrop-filter 祖先）靠的就是这次重新
  // 挂载：只要还在被裁切祖先的子树里，z-index 再高也没用；只要挂到 <html>
  // 下，不需要额外一层 overlay 容器。
  document.documentElement.appendChild(proxy)
  activeDragProxies.add(proxy)
  return proxy
}


export function getProxyAttitude(proxy: HTMLElement): HTMLElement {
  return proxy
}

export function getProxyContent(proxy: HTMLElement): HTMLElement {
  return proxy.querySelector<HTMLElement>('[data-runtime-proxy-content]') ?? proxy
}

export function moveDragProxy(proxy: HTMLElement, x: number, y: number, offsetX: number, offsetY: number) {
  proxy.style.left = `${x - offsetX}px`
  proxy.style.top = `${y - offsetY}px`
}

export interface LandingVisualOptions {
  duration?: number
  easing?: string
  targetShadow?: string
  targetRadius?: string
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
  /** retarget 执行时重新读取目标几何，避免使用布局变化前缓存的中间 rect。 */
  readTarget?: () => LandingRect
  motionState?: Pick<MotionState, 'x' | 'y' | 'vx' | 'vy' | 'scaleX' | 'scaleY' | 'rotateX' | 'rotateZ'>
  coast?: { duration: number; friction: number; maxDistance: number; minVelocity: number }
  /** 有释放速度时降低位置阻尼，保留横向抛掷的越过感。 */
  releaseDamping?: number
}

/** 用元素的文字内容当一个粗粒度的"是不是同一个东西"签名——demo/多数卡片场景里
 * 徽章、按钮这类会增减的子元素文字内容本身就是区分度最高的信息，不需要真的做
 * 一整套 DOM diff。 */
function childSignature(el: HTMLElement): string {
  return `${el.tagName}:${(el.textContent ?? '').trim()}`
}

/**
 * 把一个容器的直接子节点统一整理成"每个可见内容都是一个可以单独设置 opacity
 * 的元素"——裸文本节点（比如卡片标题，模板里直接插值、没包元素）包一层 span
 * 才能像徽章那样单独控制显隐；纯空白文本节点和 Vue 的 v-if 占位注释节点直接
 * 丢弃，不参与后面的匹配。
 */
function normalizeToElements(container: HTMLElement): HTMLElement[] {
  const result: HTMLElement[] = []
  for (const node of Array.from(container.childNodes)) {
    if (node.nodeType === Node.COMMENT_NODE) {
      node.remove()
      continue
    }
    if (node.nodeType === Node.TEXT_NODE) {
      if (!(node.textContent ?? '').trim()) { node.remove(); continue }
      const span = document.createElement('span')
      span.textContent = node.textContent
      node.replaceWith(span)
      result.push(span)
      continue
    }
    if (node.nodeType === Node.ELEMENT_NODE) result.push(node as HTMLElement)
  }
  return result
}

/**
 * 之前的做法是把源内容和目标内容各包一层完整克隆，整体做 opacity 交叉淡变——
 * 结果是没有变化的部分（比如标题文字）也被拆成两份各 50% 透明度叠在一起，两层
 * 半透明黑字叠加的视觉密度天然低于一份纯黑字（alpha 合成：0.5 叠 0.5 约等于
 * 0.75，不是 1），过渡途中共同内容会显得发虚、发浅。
 *
 * 第一次改用"目标结构渲染一份 + 新增子元素单独淡入 + 消失的子元素单独摘进
 * 一个空容器淡出"的方案时，又踩了另一个坑：摘出来的"消失的子元素"（比如
 * 徽章）失去了原本靠"跟在标题文字后面"撑住的相对位置，脱离兄弟节点后独自
 * 摆在一个空 div 里，会缩到容器左上角（截图/录屏里的"内容全跑到左上角"）。
 *
 * 现在的做法：完整保留"抓起时的结构"作为一层（beforeLayer），把里面"落地
 * 后依然存在"的子节点隐藏（opacity:0，但保留占位，不从文档流摘除），只让
 * "落地后真的消失"的子节点保持可见并参与淡出——徽章依然靠着（视觉不可见
 * 但仍占位的）标题文字撑住正确的相对位置。目标结构整份渲染成另一层
 * （contentLayer，全程可见），新增的子节点在这一层里单独设 opacity:0 再
 * 淡入，同样靠自己在目标结构里的原生相对位置排布，不需要额外撑位。
 */
function wrapContentForMorph(
  proxy: HTMLElement,
  toContent: HTMLElement,
): { enteringEls: HTMLElement[]; leavingEls: HTMLElement[] } {
  // 读取目标卡的 padding，让 contentLayer/beforeLayer 从目标卡 content area
  // （padding 内部）开始定位——否则 inset:0 定位到 padding box 边缘，子节点
  // 会偏移到卡片的视觉左上角。从 toContent 读而不是从 proxy 读：源卡和
  // 目标卡的 padding 可能不同，内容层展示的是目标结构，必须匹配目标。
  const targetStyle = getComputedStyle(toContent)
  const pt = parseFloat(targetStyle.paddingTop) || 0
  const pr = parseFloat(targetStyle.paddingRight) || 0
  const pb = parseFloat(targetStyle.paddingBottom) || 0
  const pl = parseFloat(targetStyle.paddingLeft) || 0
  const layerStyle = {
    position: 'absolute' as const,
    left: `${pl}px`,
    top: `${pt}px`,
    right: `${pr}px`,
    bottom: `${pb}px`,
    pointerEvents: 'none' as const,
  }

  const beforeLayer = document.createElement('div')
  Object.assign(beforeLayer.style, { ...layerStyle })
  // beforeLayer 承载源卡片的子节点，同样需要源卡片的 flex 布局，否则
  // flex 子项（右侧按钮）在 block 层里掉位。
  const sourceStyle = getComputedStyle(proxy)
  beforeLayer.style.display = sourceStyle.display
  beforeLayer.style.flexDirection = sourceStyle.flexDirection
  beforeLayer.style.flexWrap = sourceStyle.flexWrap
  beforeLayer.style.alignItems = sourceStyle.alignItems
  beforeLayer.style.justifyContent = sourceStyle.justifyContent
  beforeLayer.style.gap = sourceStyle.gap
  while (proxy.firstChild) beforeLayer.appendChild(proxy.firstChild)
  const fromEls = normalizeToElements(beforeLayer)
  const fromSignatures = new Set(fromEls.map(childSignature))

  const contentLayer = document.createElement('div')
  Object.assign(contentLayer.style, { ...layerStyle, pointerEvents: '' })
  // contentLayer 是绝对定位层，但子节点（如右侧推进按钮）依赖目标卡片
  // 的 flex 布局才排得正确——不带 display，子节点会退化成块级堆叠、
  // flex 子项（align-self:stretch 的按钮）从右侧掉走。
  contentLayer.style.display = targetStyle.display
  contentLayer.style.flexDirection = targetStyle.flexDirection
  contentLayer.style.flexWrap = targetStyle.flexWrap
  contentLayer.style.alignItems = targetStyle.alignItems
  contentLayer.style.justifyContent = targetStyle.justifyContent
  contentLayer.style.gap = targetStyle.gap
  contentLayer.style.overflow = 'hidden'
  // cloneNode 会带走 toContent 当下的内联样式——调用方传进来的目标节点常常
  // 这一刻正被业务代码隐藏（等着落地动画接管），得先复位再搬子节点。
  const toContentClone = toContent.cloneNode(true) as HTMLElement
  toContentClone.style.visibility = 'visible'
  toContentClone.style.display = ''
  // 只搬运 toContent 的子节点，不带它自己的外壳（class/padding）——padding
  // 已经在 contentLayer 的 left/top/right/bottom 里补偿了，contentLayer 如果
  // 带上 toContent 自己那份 padding，内容会被缩进两次，跟 proxy 对不上。
  while (toContentClone.firstChild) contentLayer.appendChild(toContentClone.firstChild)
  // contentLayer 被挂到 overlay 下的 proxy 中，脱离了 toContent 的原始 DOM
  // 上下文，字体/颜色等继承属性会丢失。从 toContent 捕获视觉上下文并固化到
  // contentLayer，确保文本渲染一致。
  const visualContext = captureInheritedStyleContext(toContent)
  applyInheritedStyleContext(contentLayer, visualContext)
  const toEls = normalizeToElements(contentLayer)
  const toSignatures = new Set(toEls.map(childSignature))

  const enteringEls = toEls.filter(el => !fromSignatures.has(childSignature(el)))
  for (const el of enteringEls) el.style.opacity = '0'

  const leavingEls = fromEls.filter(el => !toSignatures.has(childSignature(el)))
  const leavingSet = new Set(leavingEls)
  for (const el of fromEls) {
    if (!leavingSet.has(el)) el.style.opacity = '0'
  }

  proxy.appendChild(contentLayer)
  if (leavingEls.length > 0) proxy.appendChild(beforeLayer)

  return { enteringEls, leavingEls }
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
  const targetBackground = options.targetBackground
  const targetOpacity = options.targetOpacity
  const content = getProxyContent(proxy)
  const contentLayers = options.targetContent ? wrapContentForMorph(content, options.targetContent) : null
  if (contentLayers) {
    // 缓动曲线必须跟下面容器 transform 用的是同一条（easing，不是硬编码 ease）——
    // 两条速度曲线不一致时，中途会出现"容器已经飞到大半、新增内容才淡了不到
    // 三分之一"这种视觉上的运动不同步（探针测过，delta 峰值能到 0.38）。
    for (const el of contentLayers.enteringEls) el.style.transition = `opacity ${duration}ms ${easing}`
    for (const el of contentLayers.leavingEls) el.style.transition = `opacity ${duration}ms ${easing}`
  }

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
    proxy.style.width = `${startRect.width.toFixed(2)}px`
    proxy.style.height = `${startRect.height.toFixed(2)}px`
    proxy.style.transform =
      `translate3d(${(startRect.left - layoutLeft).toFixed(2)}px, ${(startRect.top - layoutTop).toFixed(2)}px, 0)`
    proxy.style.transform = 'none'
    void proxy.offsetWidth
    const targetTransform =
      `translate3d(${(nextTarget.left - layoutLeft).toFixed(2)}px, ${(nextTarget.top - layoutTop).toFixed(2)}px, 0)`

    proxy.style.transition = `transform ${animDuration}ms ${easing}, width ${animDuration}ms ${easing}, height ${animDuration}ms ${easing}`
    content.style.transition = [
      `box-shadow ${animDuration}ms ease`,
      `border-radius ${animDuration}ms ease`,
      `background-color ${animDuration}ms ease`,
      `background-image ${animDuration}ms ease`,
      `opacity ${animDuration}ms ease`,
    ].join(', ')
    // box-shadow/border-radius/background/opacity 起点值（dragSnapshot）是调用方在这个
    // proxy 刚创建、还没被浏览器画过一帧的时候同步写上去的——如果在这里（设置 transition
    // 的同一个同步块里）就把它们改成目标值，浏览器压根没机会先画一帧"起点样子"，只会在
    // 第一次真正渲染时直接看到目标值，没有过渡可言（表现为松手瞬间阴影直接跳变/消失，
    // 而不是渐变）。跟 transform 一样，必须等到下一帧、起点样式已经被画过一次之后，
    // 再改成目标值，过渡才有起点可插值。
    requestAnimationFrame(() => {
      proxy.style.transform = targetTransform
      proxy.style.width = `${nextTarget.width.toFixed(2)}px`
      proxy.style.height = `${nextTarget.height.toFixed(2)}px`
      if (targetShadow != null) content.style.boxShadow = targetShadow
      if (targetRadius != null) content.style.borderRadius = targetRadius
      if (targetBackground != null) {
        content.style.backgroundColor = targetBackground
        if (options.targetBackgroundImage) {
          content.style.backgroundImage = options.targetBackgroundImage
        }
      }
      if (targetOpacity != null) content.style.opacity = targetOpacity
      if (contentLayers) {
        for (const el of contentLayers.enteringEls) el.style.opacity = '1'
        for (const el of contentLayers.leavingEls) el.style.opacity = '0'
      }
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
  const targetBackground = options.targetBackground
  const targetOpacity = options.targetOpacity
  const content = getProxyContent(proxy)
  const contentLayers = options.targetContent ? wrapContentForMorph(content, options.targetContent) : null
  if (contentLayers) {
    for (const el of contentLayers.enteringEls) el.style.transition = `opacity ${duration}ms ${easing}`
    for (const el of contentLayers.leavingEls) el.style.transition = `opacity ${duration}ms ${easing}`
  }

  // proxy 创建时仍使用 source snapshot；landing 必须在启动控制器前切到
  // grabbing 的最后一帧，否则第一帧会从鼠标/旧 source 位置直接跳入。
  if (options.motionState) {
    proxy.style.left = `${options.motionState.x}px`
    proxy.style.top = `${options.motionState.y}px`
    // 保留 grabbing 的倾斜（rotateX/rotateZ），避免 transform:none 让
    // proxy 在松手瞬间突然变平造成视觉卡顿；后续 spring 每帧都会用
    // rotateX/rotateZ 覆盖 transform，这里只需一个合法的 transform 初始值。
    proxy.style.transform = 'translate3d(0px, 0px, 0)'
  }
  const layoutLeft = parseFloat(proxy.style.left) || proxy.getBoundingClientRect().left
  const layoutTop = parseFloat(proxy.style.top) || proxy.getBoundingClientRect().top
  const startRect = proxy.getBoundingClientRect()
  const startWidth = startRect.width || target.width
  const startHeight = startRect.height || target.height
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
  let settled = false
  let timeoutId: number | null = null
  let timeoutDeadline = 0
  let resolveFinished: () => void = () => undefined
  const finished = new Promise<void>(resolve => { resolveFinished = resolve })

  const settle = () => {
    if (settled) return
    settled = true
    motion.stop()
    if (timeoutId !== null) window.clearTimeout(timeoutId)
    timeoutId = null
    resolveFinished()
  }

  const motion = createCardMotionController({
    mode: 'settle',
    onFrame: frame => {
      const width = startWidth * frame.scaleX
      const height = startHeight * frame.scaleY
      const left = frame.x + (startWidth - width) / 2
      const top = frame.y + (startHeight - height) / 2
      proxy.style.transform = `perspective(760px) translate3d(${(left - layoutLeft).toFixed(2)}px, ${(top - layoutTop).toFixed(2)}px, 0) rotateX(${frame.rotateX.toFixed(2)}deg) rotateZ(${frame.rotateZ.toFixed(2)}deg)`
      proxy.style.width = `${width.toFixed(2)}px`
      proxy.style.height = `${height.toFixed(2)}px`
    },
    onArrived: settle,
  })
  const releaseSpeed = Math.hypot(options.motionState?.vx ?? 0, options.motionState?.vy ?? 0)
  const releaseDamping = options.releaseDamping ?? 0.78
  motion.setProfile(releaseSpeed > 30
    ? {
        ...LANDING_PROFILE,
        position: {
          ...LANDING_PROFILE.position,
          damping: LANDING_PROFILE.position.damping * releaseDamping,
        },
      }
    : LANDING_PROFILE)
  motion.seed({
    // grabbing 是弹簧跟手，松手指针位置和卡片最后视觉位置可能不同。
    // 有 MotionState 时必须从 controller 的最后一帧开始，sourceRect 只作为旧流程兜底。
    x: options.motionState?.x ?? startRect.left,
    y: options.motionState?.y ?? startRect.top,
    vx: options.motionState?.vx ?? 0,
    vy: options.motionState?.vy ?? 0,
    // 即使 pointerdown 后没有产生位移，抓取态仍有 scale(1.03)。
    // 不能在 landing 起点把它重置为 1，否则目标位置相同的回放会被
    // MotionController 判定为已到达，代理瞬间消失。
    scaleX: options.motionState?.scaleX ?? 1,
    scaleY: options.motionState?.scaleY ?? 1,
    rotateX: options.motionState?.rotateX ?? 0,
    rotateZ: options.motionState?.rotateZ ?? 0,
  })
  const initialTarget = centeredTarget(target)
  motion.setTarget({
    x: initialTarget.left,
    y: initialTarget.top,
    scaleX: initialTarget.width / startWidth,
    scaleY: initialTarget.height / startHeight,
  })

  // 视觉属性仍然隔一帧切换，确保起始阴影/圆角/背景有机会先被绘制。
  proxy.style.transition = ''
  content.style.transition = [
    `box-shadow ${duration}ms ${easing}`,
    `border-radius ${duration}ms ${easing}`,
    `background-color ${duration}ms ${easing}`,
    `background-image ${duration}ms ${easing}`,
    `opacity ${duration}ms ${easing}`,
  ].join(', ')
  requestAnimationFrame(() => {
    if (settled) return
    if (targetShadow != null) content.style.boxShadow = targetShadow
    if (targetRadius != null) content.style.borderRadius = targetRadius
    if (targetBackground != null) {
      // 分开设置：background 简写会重置 background-image，业务卡片常用
      // linear-gradient（在 backgroundImage），渐变会被 backgroundColor
      // 覆盖丢失（透明底）。先设 backgroundColor，再设 backgroundImage。
      content.style.backgroundColor = targetBackground
      if (options.targetBackgroundImage) {
        content.style.backgroundImage = options.targetBackgroundImage
      }
    }
    if (targetOpacity != null) content.style.opacity = targetOpacity
    if (contentLayers) {
      for (const el of contentLayers.enteringEls) el.style.opacity = '1'
      for (const el of contentLayers.leavingEls) el.style.opacity = '0'
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
  if (coast && coast.maxDistance > 0 && Math.hypot(options.motionState?.vx ?? 0, options.motionState?.vy ?? 0) > coast.minVelocity) {
    motion.startCoastThenSettle(coast)
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
      motion.setTarget({
        x: next.left,
        y: next.top,
        scaleX: next.width / startWidth,
        scaleY: next.height / startHeight,
      })
    },
  }
}

export function destroyDragProxy(proxy: HTMLElement) {
  if (!activeDragProxies.has(proxy)) return
  activeDragProxies.delete(proxy)
  proxy.remove()
}

/** 清理 demo 中上一次异常中断留下的代理节点。 */
export function destroyAllDragProxies(): void {
  for (const proxy of activeDragProxies) proxy.remove()
  activeDragProxies.clear()
  document.querySelectorAll<HTMLElement>('[data-runtime-proxy="true"]').forEach(proxy => proxy.remove())
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
/** source 节点 ↔ 抓取阶段独立 proxy 的映射。proxy 挂在 <html> 下，避免
 *  .glass-card 祖先的 backdrop-filter 创建 containing block 拦截 fixed
 *  坐标系，同时不 reparent 业务 DOM，Vue 追踪不受影响。 */
const floatingProxies = new WeakMap<HTMLElement, HTMLElement>()
const pickupHandoffPending = new WeakSet<HTMLElement>()

export function applyFloatingStyle(el: HTMLElement, rect: DOMRect) {
  floatingSnapshots.set(el, { style: el.getAttribute('style') ?? '' })
  // 抓取阶段的视觉交给独立 proxy：挂在 <html> 下，containing block 是 viewport，
  // 不会被 .glass-card 祖先的 backdrop-filter / overflow:hidden 裁切，pointer
  // 坐标也能直接对齐。source 节点保持原 DOM 位置，仅 visibility:hidden，Vue 重渲染
  // 时仍然能正确识别这个节点，不会出现"新旧两张卡片同时存在"。
  const proxy = createDragProxy(el, rect, { glass: false })
  const content = getProxyContent(proxy)
  proxy.style.zIndex = '1000'
  // 首帧保留源卡片样式；下一帧才进入 grabbing 视觉，形成从原位被拎起的过渡。
  proxy.style.transform = 'scale(1)'
  proxy.style.transition = 'transform 150ms cubic-bezier(.22,1,.36,1), box-shadow 150ms ease, background 150ms ease, opacity 150ms ease'
  pickupHandoffPending.add(proxy)
  floatingProxies.set(el, proxy)
  el.style.visibility = 'hidden'
  requestAnimationFrame(() => {
    if (!proxy.isConnected) return
    if (defaultDraggingGlassEnabled) applyDraggingGlassStyle(content)
    else content.style.boxShadow = '0 12px 24px rgba(0,0,0,.18)'
    proxy.style.transform = 'scale(1.03)'
  })
}

export function getFloatingProxy(el: HTMLElement): HTMLElement | undefined {
  return floatingProxies.get(el)
}

export function moveFloating(el: HTMLElement, x: number, y: number, offsetX: number, offsetY: number) {
  const target = floatingProxies.get(el) ?? el
  const left = `${x - offsetX}px`
  const top = `${y - offsetY}px`
  if (pickupHandoffPending.has(target)) {
    pickupHandoffPending.delete(target)
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
  el.setAttribute('style', snapshot?.style ?? '')
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
  element.style.boxShadow = '0 22px 50px rgba(30, 35, 60, 0.30)'
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

/**
 * 隐藏目标元素并登记 visibility ownership。
 * 只有登记的 owner 才能通过 revealElement() 恢复可见性。
 */
export function concealElement(el: HTMLElement, ownerId: string): void {
  visibilityOwner.set(el, ownerId)
  el.style.visibility = 'hidden'
}

/**
 * 恢复元素的可见性。只有当前 owner 才能恢复，非 owner 调用无效果。
 * 返回是否实际执行了恢复操作。
 */
export function revealElement(el: HTMLElement, ownerId: string): boolean {
  const isOwner = visibilityOwner.get(el) === ownerId
  if (isOwner) {
    el.style.visibility = ''
    visibilityOwner.delete(el)
  }
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
