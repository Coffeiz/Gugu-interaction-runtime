let visualOverlay: HTMLElement | null = null

/**
 * Runtime 的临时视觉层。proxy/landing visual 必须脱离 Surface、应用壳和
 * body 的裁剪树，否则卡片越过列边界或飞往目标时会被中途截断。
 */
export function mountVisualOverlay(): HTMLElement {
  if (!visualOverlay || !visualOverlay.isConnected) {
    visualOverlay = document.createElement('div')
    visualOverlay.dataset.runtimeOverlay = 'true'
    Object.assign(visualOverlay.style, {
      position: 'fixed',
      inset: '0',
      overflow: 'visible',
      pointerEvents: 'none',
      zIndex: '2147483647',
    })
  }
  // body 常被应用壳设置 overflow/transform；把 overlay 直接作为 html 的
  // 子节点，才是 Runtime 能保证不受任何业务 Surface 裁剪的最外层位置。
  if (visualOverlay.parentElement !== document.documentElement) {
    document.documentElement.appendChild(visualOverlay)
  }
  return visualOverlay
}

/**
 * proxy：跟随指针的临时视觉对象，随 Session 创建/销毁，不属于 Vue 管理
 * 的真实 DOM——见 docs/DESIGN.md "Vue 创建真实 DOM，Runtime 创建临时 DOM"。
 */
export function createDragProxy(source: HTMLElement, rect: DOMRect = source.getBoundingClientRect()): HTMLElement {
  const proxy = source.cloneNode(true) as HTMLElement
  // 源节点在 clone 策略中会暂时使用隐藏类保留列表占位；代理必须是唯一可见
  // 的视觉主体，不能把源节点的隐藏状态一起复制过来。
  proxy.classList.remove('kb-card-dragging-source')
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
  proxy.style.zIndex = '1'
  proxy.style.pointerEvents = 'none'
  proxy.style.visibility = 'visible'
  proxy.style.display = 'block'
  proxy.dataset.runtimeProxy = 'true'
  // 拖拽期间就用 0 0 原点，避免 landing 时从 center 跳变到 0 0 导致内容偏移。
  proxy.style.transformOrigin = '0 0'
  proxy.style.transform = 'scale(1.03)'
  proxy.style.boxShadow = '0 12px 24px rgba(0,0,0,.18)'
  proxy.style.transition = 'transform .15s ease, box-shadow .15s ease'
  mountVisualOverlay().appendChild(proxy)
  activeDragProxies.add(proxy)
  return proxy
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
  while (proxy.firstChild) beforeLayer.appendChild(proxy.firstChild)
  const fromEls = normalizeToElements(beforeLayer)
  const fromSignatures = new Set(fromEls.map(childSignature))

  const contentLayer = document.createElement('div')
  Object.assign(contentLayer.style, { ...layerStyle, pointerEvents: '' })
  // cloneNode 会带走 toContent 当下的内联样式——调用方传进来的目标节点常常
  // 这一刻正被业务代码隐藏（等着落地动画接管），得先复位再搬子节点。
  const toContentClone = toContent.cloneNode(true) as HTMLElement
  toContentClone.style.visibility = 'visible'
  toContentClone.style.display = ''
  // 只搬运 toContent 的子节点，不带它自己的外壳（class/padding）——padding
  // 已经在 contentLayer 的 left/top/right/bottom 里补偿了，contentLayer 如果
  // 带上 toContent 自己那份 padding，内容会被缩进两次，跟 proxy 对不上。
  while (toContentClone.firstChild) contentLayer.appendChild(toContentClone.firstChild)
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

/**
 * 把代理从当前帧交接到最终目标。目标只提供一次几何/视觉快照，后续
 * 不再依赖目标 DOM 的生命周期；这样 Vue 在 landing 期间重建节点也不会
 * 改写代理的运动目标。
 */
export function landDragProxy(
  proxy: HTMLElement,
  target: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
  options: LandingVisualOptions = {},
): Promise<void> {
  const duration = options.duration ?? 280
  const easing = options.easing ?? 'cubic-bezier(.22,1,.36,1)'
  const targetShadow = options.targetShadow
  const targetRadius = options.targetRadius
  const targetBackground = options.targetBackground
  const targetOpacity = options.targetOpacity
  const contentLayers = options.targetContent ? wrapContentForMorph(proxy, options.targetContent) : null
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
  //
  // 代理此刻的渲染框（可能已经带着调用方设置的抬起 scale）先原样换算成
  // "相对左上角的 translate" 表达式 + 当前真实宽高，视觉上不产生任何跳变，
  // 强制一次回流后再让浏览器画一帧，下一帧再把这套表达式过渡到目标框——跟
  // 前面 box-shadow 那批属性一样，起点和终点必须隔一帧写，过渡才有起点可插值。
  const layoutLeft = parseFloat(proxy.style.left) || 0
  const layoutTop = parseFloat(proxy.style.top) || 0
  const startRect = proxy.getBoundingClientRect()
  proxy.style.transition = 'none'
  proxy.style.width = `${startRect.width.toFixed(2)}px`
  proxy.style.height = `${startRect.height.toFixed(2)}px`
  proxy.style.transform =
    `translate3d(${(startRect.left - layoutLeft).toFixed(2)}px, ${(startRect.top - layoutTop).toFixed(2)}px, 0)`
  void proxy.offsetWidth
  const targetTransform =
    `translate3d(${(target.left - layoutLeft).toFixed(2)}px, ${(target.top - layoutTop).toFixed(2)}px, 0)`

  return new Promise(resolve => {
    let settled = false
    const startedAt = performance.now()
    const isAtTarget = () => {
      const rect = proxy.getBoundingClientRect()
      return Math.abs(rect.left - target.left) < 2
        && Math.abs(rect.top - target.top) < 2
        && Math.abs(rect.width - target.width) < 2
        && Math.abs(rect.height - target.height) < 2
    }
    const settle = () => {
      if (settled) return
      settled = true
      proxy.removeEventListener('transitionend', onEnd)
      resolve()
    }
    const onEnd = (event: TransitionEvent) => {
      if (event.target === proxy
        && (event.propertyName === 'transform' || event.propertyName === 'width' || event.propertyName === 'height')
        && isAtTarget()) settle()
    }

    proxy.addEventListener('transitionend', onEnd)
    proxy.style.transition = [
      `transform ${duration}ms ${easing}`,
      `width ${duration}ms ${easing}`,
      `height ${duration}ms ${easing}`,
      `box-shadow ${duration}ms ease`,
      `border-radius ${duration}ms ease`,
      `background-color ${duration}ms ease`,
      `opacity ${duration}ms ease`,
    ].join(', ')
    // box-shadow/border-radius/background/opacity 起点值（dragSnapshot）是调用方在这个
    // proxy 刚创建、还没被浏览器画过一帧的时候同步写上去的——如果在这里（设置 transition
    // 的同一个同步块里）就把它们改成目标值，浏览器压根没机会先画一帧"起点样子"，只会在
    // 第一次真正渲染时直接看到目标值，没有过渡可言（表现为松手瞬间阴影直接跳变/消失，
    // 而不是渐变）。跟 transform 一样，必须等到下一帧、起点样式已经被画过一次之后，
    // 再改成目标值，过渡才有起点可插值。
    requestAnimationFrame(() => {
      proxy.style.transform = targetTransform
      proxy.style.width = `${target.width.toFixed(2)}px`
      proxy.style.height = `${target.height.toFixed(2)}px`
      if (targetShadow != null) proxy.style.boxShadow = targetShadow
      if (targetRadius != null) proxy.style.borderRadius = targetRadius
      if (targetBackground != null) proxy.style.background = targetBackground
      if (targetOpacity != null) proxy.style.opacity = targetOpacity
      if (contentLayers) {
        for (const el of contentLayers.enteringEls) el.style.opacity = '1'
        for (const el of contentLayers.leavingEls) el.style.opacity = '0'
      }
    })
    const waitForTarget = () => {
      if (settled) return
      if (isAtTarget() || performance.now() - startedAt >= duration + 500) {
        settle()
        return
      }
      window.requestAnimationFrame(waitForTarget)
    }
    window.setTimeout(waitForTarget, duration + 40)
  })
}

export function destroyDragProxy(proxy: HTMLElement) {
  activeDragProxies.delete(proxy)
  proxy.remove()
}

/** 清理 demo 中上一次异常中断留下的代理节点。 */
export function destroyAllDragProxies(): void {
  for (const proxy of activeDragProxies) proxy.remove()
  activeDragProxies.clear()
  document.querySelectorAll<HTMLElement>('[data-runtime-proxy="true"]').forEach(proxy => proxy.remove())
}

/**
 * "detach" 策略专用：不克隆，直接让本体自己脱离文档流、用 position:fixed
 * 跟手。配合 Vue 的 <Teleport :disabled="!controlled"> 使用——本体在被
 * Runtime 接管期间会被 Teleport 搬到 body，这里只负责钉住视觉位置，不碰
 * DOM 树结构（DOM 搬运交给 Vue 自己做，Runtime 不做手工 reparent，见
 * docs/DESIGN.md 对"手工挪动 Vue 追踪的节点"的风险提示）。
 */
const floatingSnapshots = new WeakMap<HTMLElement, { style: string }>()

export function applyFloatingStyle(el: HTMLElement, rect: DOMRect) {
  floatingSnapshots.set(el, { style: el.getAttribute('style') ?? '' })
  el.style.position = 'fixed'
  el.style.left = `${rect.left}px`
  el.style.top = `${rect.top}px`
  el.style.width = `${rect.width}px`
  el.style.height = `${rect.height}px`
  el.style.margin = '0'
  el.style.zIndex = '1000'
  el.style.boxSizing = 'border-box'
  el.style.boxShadow = '0 12px 24px rgba(0,0,0,.18)'
  el.style.transform = 'scale(1.03)'
  el.style.transition = 'transform .15s ease, box-shadow .15s ease'
}

export function moveFloating(el: HTMLElement, x: number, y: number, offsetX: number, offsetY: number) {
  el.style.left = `${x - offsetX}px`
  el.style.top = `${y - offsetY}px`
}

export function clearFloatingStyle(el: HTMLElement) {
  const snapshot = floatingSnapshots.get(el)
  el.setAttribute('style', snapshot?.style ?? '')
  floatingSnapshots.delete(el)
}
const activeDragProxies = new Set<HTMLElement>()

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
