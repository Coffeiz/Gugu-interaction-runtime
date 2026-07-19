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
      if (event.target === proxy && (event.propertyName === 'left' || event.propertyName === 'top') && isAtTarget()) settle()
    }

    proxy.addEventListener('transitionend', onEnd)
    proxy.style.transition = [
      `left ${duration}ms ${easing}`,
      `top ${duration}ms ${easing}`,
      `width ${duration}ms ${easing}`,
      `height ${duration}ms ${easing}`,
      `transform ${duration}ms ${easing}`,
      `box-shadow ${duration}ms ease`,
      `border-radius ${duration}ms ease`,
      `background-color ${duration}ms ease`,
      `opacity ${duration}ms ease`,
    ].join(', ')
    // box-shadow/border-radius/background/opacity 起点值（dragSnapshot）是调用方在这个
    // proxy 刚创建、还没被浏览器画过一帧的时候同步写上去的——如果在这里（设置 transition
    // 的同一个同步块里）就把它们改成目标值，浏览器压根没机会先画一帧"起点样子"，只会在
    // 第一次真正渲染时直接看到目标值，没有过渡可言（表现为松手瞬间阴影直接跳变/消失，
    // 而不是渐变）。跟 left/top/width/height/transform 一样，必须等到下一帧、起点样式已经
    // 被画过一次之后，再改成目标值，过渡才有起点可插值。
    requestAnimationFrame(() => {
      proxy.style.left = `${target.left}px`
      proxy.style.top = `${target.top}px`
      proxy.style.width = `${target.width}px`
      proxy.style.height = `${target.height}px`
      proxy.style.transform = 'scale(1)'
      if (targetShadow != null) proxy.style.boxShadow = targetShadow
      if (targetRadius != null) proxy.style.borderRadius = targetRadius
      if (targetBackground != null) proxy.style.background = targetBackground
      if (targetOpacity != null) proxy.style.opacity = targetOpacity
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
