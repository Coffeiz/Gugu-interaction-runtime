/**
 * proxy：跟随指针的临时视觉对象，随 Session 创建/销毁，不属于 Vue 管理
 * 的真实 DOM——见 docs/DESIGN.md "Vue 创建真实 DOM，Runtime 创建临时 DOM"。
 */
export function createDragProxy(source: HTMLElement, rect: DOMRect = source.getBoundingClientRect()): HTMLElement {
  const proxy = source.cloneNode(true) as HTMLElement
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
  proxy.style.zIndex = '1000'
  proxy.style.pointerEvents = 'none'
  proxy.style.transform = 'scale(1.03)'
  proxy.style.boxShadow = '0 12px 24px rgba(0,0,0,.18)'
  proxy.style.transition = 'transform .15s ease, box-shadow .15s ease'
  document.body.appendChild(proxy)
  return proxy
}

export function moveDragProxy(proxy: HTMLElement, x: number, y: number, offsetX: number, offsetY: number) {
  proxy.style.left = `${x - offsetX}px`
  proxy.style.top = `${y - offsetY}px`
}

export function destroyDragProxy(proxy: HTMLElement) {
  proxy.remove()
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
