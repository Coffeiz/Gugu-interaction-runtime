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
