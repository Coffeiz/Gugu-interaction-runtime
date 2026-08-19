/**
 * 一笔布局事务中的卡片、分组和 Surface 必须使用同一节奏；否则容器会比
 * 内部内容更早或更晚到位，视觉上像发生了第二次布局。
 */
import { DEFAULT_MOTION_PROFILE } from './MotionProfile'
import { animateRafTransform, cancelRafTransform } from './RafLayoutAnimator'
import type { LayoutMeasurement } from './LayoutMeasurement'

export const FLIP_DURATION = DEFAULT_MOTION_PROFILE.flip.duration
export const FLIP_EASING = DEFAULT_MOTION_PROFILE.flip.easing

export interface FlipPlayStats {
  readonly measured: number
  readonly animated: number
  readonly filteredSkipped: number
  readonly tinySkipped: number
  readonly runtimeSkipped: number
}

/**
 * 通用 FLIP：在一次 DOM 变化前后分别调用 capture()/play()，用 transform
 * 补间视觉位移，不摸 height/opacity 等其它属性。对应 Gugu-web
 * flipCoordinator.ts 里的 FlipTransaction，这里是收敛后的最小版本。
 */
export function captureRects(elements: HTMLElement[], measurement?: LayoutMeasurement): Map<HTMLElement, DOMRect> {
  const rects = new Map<HTMLElement, DOMRect>()
  elements.forEach(el => rects.set(el, measurement?.rect(el) ?? el.getBoundingClientRect()))
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
    cancelRafTransform(element)
    element.style.setProperty('transition', 'none', 'important')
  }
}

export function playFlip(
  elements: HTMLElement[],
  before: Map<HTMLElement, DOMRect>,
  duration = FLIP_DURATION,
  easing = FLIP_EASING,
  measurement?: LayoutMeasurement,
  shouldMeasure?: (element: HTMLElement) => boolean,
): FlipPlayStats {
  // 新 FLIP 必须先作废同一批元素上的旧 rAF、timeout 和 transitionend，
  // 否则快速抓放会出现旧事务补写 transform，表现为二次让位或瞬间展开。
  // participant reduction 也不能绕开这个边界：即使这一笔决定跳过某张卡，
  // 它身上的上一笔 Runtime FLIP 仍必须先失效。
  const previouslyActive = new Set(elements.filter(element => element.dataset.runtimeFlip === 'true'))
  resetActiveFlip(elements)
  const plans: Array<{ element: HTMLElement; dx: number; dy: number }> = []
  let measured = 0
  let filteredSkipped = 0
  let tinySkipped = 0
  let runtimeSkipped = 0
  // Read phase: measure every selected participant before writing any new transform.
  // Interleaving these operations forces one layout flush per card.
  for (const el of elements) {
    if (shouldMeasure && !shouldMeasure(el)) {
      filteredSkipped += 1
      if (previouslyActive.has(el)) el.style.transition = ''
      continue
    }
    // Runtime 临时视觉对象和当前拖动对象不属于兄弟布局动画参与者。
    // 统一在 Layout 层过滤，适配器无需每次重复维护排除条件。
    if (
      el.dataset.runtimeProxy === 'true' ||
      el.dataset.runtimePlaceholder === 'true' ||
      el.dataset.runtimeActive === 'true'
    ) {
      runtimeSkipped += 1
      if (previouslyActive.has(el)) el.style.transition = ''
      continue
    }
    const from = before.get(el)
    if (!from) {
      filteredSkipped += 1
      if (previouslyActive.has(el)) el.style.transition = ''
      continue
    }
    const to = measurement?.rect(el) ?? el.getBoundingClientRect()
    measured += 1
    const dx = from.left - to.left
    const dy = from.top - to.top
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
      tinySkipped += 1
      // resetActiveFlip 可能给这个元素设置了 transition: none !important，
      // 如果跳过 FLIP，需要清除以免永久锁定 transition。
      el.style.transition = ''
      continue
    }
    plans.push({ element: el, dx, dy })
  }

  // Write phase: apply all inversions only after the read phase is complete.
  for (const { element: el, dx, dy } of plans) {
    el.style.setProperty('transition', 'none', 'important')
    el.style.transform = `translate(${dx}px, ${dy}px)`
    const token = String(Number(el.dataset.runtimeFlipToken ?? '0') + 1)
    el.dataset.runtimeFlip = 'true'
    el.dataset.runtimeFlipToken = token
    animateRafTransform(el, dx, dy, duration, easing, () => {
      if (el.dataset.runtimeFlipToken !== token) return
      el.style.transition = ''
      delete el.dataset.runtimeFlip
    })
  }
  return {
    measured,
    animated: plans.length,
    filteredSkipped,
    tinySkipped,
    runtimeSkipped,
  }
}
