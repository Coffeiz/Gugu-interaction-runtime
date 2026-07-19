/**
 * proxy：跟随指针的临时视觉对象，随 Session 创建/销毁，不属于 Vue 管理
 * 的真实 DOM——见 docs/DESIGN.md "Vue 创建真实 DOM，Runtime 创建临时 DOM"。
 */
export function createDragProxy(source: HTMLElement, rect: DOMRect = source.getBoundingClientRect()): HTMLElement {
  const proxy = source.cloneNode(true) as HTMLElement
  proxy.style.position = 'fixed'
  proxy.style.left = `${rect.left}px`
  proxy.style.top = `${rect.top}px`
  proxy.style.width = `${rect.width}px`
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
