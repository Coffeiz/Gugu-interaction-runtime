/**
 * 一笔布局事务中的卡片、分组和 Surface 必须使用同一节奏；否则容器会比
 * 内部内容更早或更晚到位，视觉上像发生了第二次布局。
 */
import { DEFAULT_MOTION_PROFILE } from './MotionProfile'

export const FLIP_DURATION = DEFAULT_MOTION_PROFILE.flip.duration
export const FLIP_EASING = DEFAULT_MOTION_PROFILE.flip.easing

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

/**
 * 新布局事务接管尚未结束的 Runtime FLIP。before rect 已在清除前读取，清除
 * 仅用于测量新的无 transform 布局；两步发生在同一 JS 帧内，不会露出跳帧。
 */
export function resetActiveFlip(elements: readonly HTMLElement[]): void {
  const active = elements.filter(element => element.dataset.runtimeFlip === 'true')
  if (active.length === 0) return
  for (const element of active) {
    // 先推进 token，使尚未执行的旧 rAF、旧 timeout 和 transitionend 都失效。
    // 只清 transform 而不作废回调，会在快速抓放时让旧事务复活并覆盖新 FLIP。
    element.dataset.runtimeFlipToken = String(Number(element.dataset.runtimeFlipToken ?? '0') + 1)
    delete element.dataset.runtimeFlip
    element.style.setProperty('transition', 'none', 'important')
    element.style.transform = ''
  }
  // 迫使浏览器以无旧 transform 的最终布局完成下一次 rect 测量。
  void active[0].offsetHeight
}

export function playFlip(
  elements: HTMLElement[],
  before: Map<HTMLElement, DOMRect>,
  duration = FLIP_DURATION,
  easing = FLIP_EASING,
): void {
  resetActiveFlip(elements)
  for (const el of elements) {
    // Runtime 临时视觉对象和当前拖动对象不属于兄弟布局动画参与者。
    // 统一在 Layout 层过滤，适配器无需每次重复维护排除条件。
    if (
      el.dataset.runtimeProxy === 'true' ||
      el.dataset.runtimePlaceholder === 'true' ||
      el.dataset.runtimeActive === 'true'
    ) continue
    const from = before.get(el)
    if (!from) continue
    const to = el.getBoundingClientRect()
    const dx = from.left - to.left
    const dy = from.top - to.top
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
      // resetActiveFlip 可能给这个元素设置了 transition: none !important，
      // 如果跳过 FLIP，需要清除以免永久锁定 transition。
      el.style.transition = ''
      continue
    }
    el.style.setProperty('transition', 'none', 'important')
    el.style.transform = `translate(${dx}px, ${dy}px)`
    const token = String(Number(el.dataset.runtimeFlipToken ?? '0') + 1)
    el.dataset.runtimeFlip = 'true'
    el.dataset.runtimeFlipToken = token
    void el.offsetHeight
    requestAnimationFrame(() => {
      if (el.dataset.runtimeFlipToken !== token) return
      el.style.setProperty('transition', `transform ${duration}ms ${easing}`, 'important')
      el.style.transform = ''
      el.addEventListener('transitionend', function onEnd(event) {
        if (event.target !== el || event.propertyName !== 'transform') return
        el.removeEventListener('transitionend', onEnd)
        if (el.dataset.runtimeFlipToken !== token) return
        el.style.transition = ''
        delete el.dataset.runtimeFlip
      })
      window.setTimeout(() => {
        if (el.dataset.runtimeFlipToken !== token) return
        el.style.transition = ''
        el.style.transform = ''
        delete el.dataset.runtimeFlip
      }, duration + 60)
    })
  }
}
