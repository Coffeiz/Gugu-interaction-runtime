/**
 * 通用 FLIP：在一次 DOM 变化前后分别调用 capture()/play()，用 transform
 * 补间视觉位移，不摸 height/opacity 等其它属性。对应 Gugu-web
 * flipCoordinator.ts 里的 FlipTransaction，这里是收敛后的最小版本。
 */
export function captureRects(elements: HTMLElement[]): Map<HTMLElement, DOMRect> {
  const rects = new Map<HTMLElement, DOMRect>()
  elements.forEach(el => rects.set(el, el.getBoundingClientRect()))
  return rects
}

export function playFlip(
  elements: HTMLElement[],
  before: Map<HTMLElement, DOMRect>,
  duration = 220,
  easing = 'cubic-bezier(.22,1,.36,1)',
): void {
  for (const el of elements) {
    const from = before.get(el)
    if (!from) continue
    const to = el.getBoundingClientRect()
    const dx = from.left - to.left
    const dy = from.top - to.top
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue
    el.style.setProperty('transition', 'none', 'important')
    el.style.transform = `translate(${dx}px, ${dy}px)`
    void el.offsetHeight
    requestAnimationFrame(() => {
      el.style.setProperty('transition', `transform ${duration}ms ${easing}`, 'important')
      el.style.transform = ''
      el.addEventListener('transitionend', function onEnd(event) {
        if (event.target !== el || event.propertyName !== 'transform') return
        el.removeEventListener('transitionend', onEnd)
        el.style.transition = ''
      })
    })
  }
}
