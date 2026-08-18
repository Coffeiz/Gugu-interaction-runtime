type TransformState = {
  started: number | null
  duration: number
  fromX: number
  fromY: number
  easingText: string
  easing: (value: number) => number
  onComplete?: () => void
}

type HeightState = {
  started: number
  duration: number
  from: number
  to: number
  easing: (value: number) => number
  onComplete?: () => void
}

// transformStates 是 Runtime 对 FLIP visual trajectory 的事实来源，但 DOM
// 动画本身仍交给 CSS/compositor。pendingTransformElements 只在下一帧批量
// 启动 transition；不会像旧 RafLayoutAnimator 那样每张卡每帧写 transform。
const transformStates = new Map<HTMLElement, TransformState>()
const pendingTransformElements = new Set<HTMLElement>()
const heightStates = new Map<HTMLElement, HeightState>()
let layoutFrame: number | null = null
let transformCleanupTimer: number | null = null

function cubicBezier(easing: string): (value: number) => number {
  const match = easing.match(/cubic-bezier\(([^)]+)\)/)
  if (!match) return value => value * value * (3 - 2 * value)
  const values = match[1].split(',').map(Number)
  if (values.length !== 4 || values.some(value => !Number.isFinite(value))) {
    return value => value * value * (3 - 2 * value)
  }
  const [x1, y1, x2, y2] = values
  return progress => {
    // visual geometry 会直接消费同一条 easing；端点必须精确，避免 landing
    // finalRect 在 0/1 附近留下亚像素漂移。
    if (progress <= 0) return 0
    if (progress >= 1) return 1
    let low = 0
    let high = 1
    for (let i = 0; i < 12; i += 1) {
      const t = (low + high) / 2
      const x = 3 * (1 - t) ** 2 * t * x1 + 3 * (1 - t) * t ** 2 * x2 + t ** 3
      if (x < progress) low = t
      else high = t
    }
    const t = (low + high) / 2
    return 3 * (1 - t) ** 2 * t * y1 + 3 * (1 - t) * t ** 2 * y2 + t ** 3
  }
}

function progressAt(started: number | null, duration: number, time: number): number {
  if (started === null) return 0
  return Math.min(1, Math.max(0, (time - started) / duration))
}

function transformOffset(state: TransformState, time: number): { x: number; y: number } {
  const eased = state.easing(progressAt(state.started, state.duration, time))
  return {
    x: state.fromX * (1 - eased),
    y: state.fromY * (1 - eased),
  }
}

function clearTransformCleanupTimer(): void {
  if (transformCleanupTimer === null) return
  window.clearTimeout(transformCleanupTimer)
  transformCleanupTimer = null
}

function scheduleTransformCleanup(): void {
  clearTransformCleanupTimer()
  let earliest = Number.POSITIVE_INFINITY
  for (const state of transformStates.values()) {
    if (state.started === null) continue
    earliest = Math.min(earliest, state.started + state.duration)
  }
  if (!Number.isFinite(earliest)) return
  const delay = Math.max(0, earliest - performance.now()) + 1
  transformCleanupTimer = window.setTimeout(runTransformCleanup, delay)
}

function runTransformCleanup(): void {
  transformCleanupTimer = null
  const now = performance.now()
  for (const [element, state] of [...transformStates]) {
    if (state.started === null || now + 0.5 < state.started + state.duration) continue
    if (transformStates.get(element) !== state) continue
    transformStates.delete(element)
    pendingTransformElements.delete(element)
    element.style.transition = ''
    element.style.transform = ''
    state.onComplete?.()
  }
  scheduleTransformCleanup()
}

function cancelLayoutFrameIfIdle(): void {
  if (layoutFrame === null || pendingTransformElements.size > 0 || heightStates.size > 0) return
  cancelAnimationFrame(layoutFrame)
  layoutFrame = null
}

function ensureLayoutFrame(): void {
  if (layoutFrame !== null || (pendingTransformElements.size === 0 && heightStates.size === 0)) return
  layoutFrame = requestAnimationFrame(tick)
}

function tick(time: number): void {
  layoutFrame = null

  // 一笔 FLIP 里 N 个 element 都在同一个 rAF 中从 Invert 切到 0 translation。
  // 浏览器随后在 compositor 上执行 transition；Runtime 只保留 trajectory
  // metadata 给 landing 查询，不再逐帧写 N 个 inline transform。
  if (pendingTransformElements.size > 0) {
    const pending = [...pendingTransformElements]
    pendingTransformElements.clear()
    for (const element of pending) {
      const state = transformStates.get(element)
      if (!state || state.started !== null) continue
      state.started = time
      element.style.setProperty('transition', `transform ${state.duration}ms ${state.easingText}`, 'important')
      // 明确收敛到 0 translation，而不是直接清空 inline transform。否则底层
      // :hover/业务 transform 可能在动画中参与插值，浏览器实际轨迹就会和
      // Runtime 的 finalRect + trajectory(t) 数学模型分叉。完成后再统一清空。
      element.style.transform = 'translate(0px, 0px)'
    }
    scheduleTransformCleanup()
  }

  // Surface height 不是 compositor 属性，继续由一个共享 frame loop 驱动；
  // transform start 与 height tick 共用同一个 requestAnimationFrame。
  for (const [element, state] of [...heightStates]) {
    if (heightStates.get(element) !== state) continue
    const progress = progressAt(state.started, state.duration, time)
    const value = state.from + (state.to - state.from) * state.easing(progress)
    element.style.height = `${value}px`
    if (progress < 1) continue
    heightStates.delete(element)
    state.onComplete?.()
  }

  ensureLayoutFrame()
}

/** Runtime 当前是否仍有自己拥有的 FLIP / Surface resize 动画。 */
export function hasActiveRafLayoutAnimations(): boolean {
  return transformStates.size > 0 || heightStates.size > 0
}

/** 返回该元素自身由 Runtime FLIP 驱动的当前视觉位移；不存在时返回 null。 */
export function readRafTransformOffset(
  element: HTMLElement,
  time = performance.now(),
): { x: number; y: number } | null {
  const state = transformStates.get(element)
  return state ? transformOffset(state, time) : null
}

/**
 * 返回该元素当前由 Runtime FLIP 产生的 viewport 位移。Relative FLIP 会把
 * 一部分位移写在祖先 group 上，因此这里沿祖先链合成 active translation；
 * landing 可以直接消费这条已知轨迹，而不必每帧反读 getBoundingClientRect()。
 */
export function readRafVisualOffset(
  element: HTMLElement,
  time = performance.now(),
): { x: number; y: number } | null {
  let current: HTMLElement | null = element
  let x = 0
  let y = 0
  let active = false
  while (current) {
    const offset = readRafTransformOffset(current, time)
    if (offset) {
      x += offset.x
      y += offset.y
      active = true
    }
    current = current.parentElement
  }
  return active ? { x, y } : null
}

function detachTransformState(element: HTMLElement, rescheduleCleanup = true): void {
  if (!transformStates.delete(element)) return
  pendingTransformElements.delete(element)
  if (rescheduleCleanup) {
    if (transformStates.size === 0) clearTransformCleanupTimer()
    else scheduleTransformCleanup()
  }
  cancelLayoutFrameIfIdle()
}

export function cancelRafTransform(element: HTMLElement): void {
  if (!transformStates.has(element)) return
  detachTransformState(element)
  element.style.transform = ''
}

export function animateRafTransform(
  element: HTMLElement,
  fromX: number,
  fromY: number,
  duration: number,
  easing: string,
  onComplete?: () => void,
): void {
  // 替换旧轨迹时只移除 state，不清理 DOM。调用方已经写入新事务的 Invert；
  // 如果这里先把 transform 清掉，会在共享 start frame 前暴露最终布局。
  // 批量接管旧 FLIP 时也不为每张卡反复重排 cleanup timer；旧 timer 即使
  // 提前触发，也只会做一次 Map 扫描并按新 state 的 deadline 重新安排。
  detachTransformState(element, false)
  transformStates.set(element, {
    started: null,
    duration: Math.max(1, duration),
    fromX,
    fromY,
    easingText: easing,
    easing: cubicBezier(easing),
    onComplete,
  })
  pendingTransformElements.add(element)
  ensureLayoutFrame()
}

function detachHeightState(element: HTMLElement): void {
  if (!heightStates.delete(element)) return
  cancelLayoutFrameIfIdle()
}

export function cancelRafHeight(element: HTMLElement): void {
  if (!heightStates.has(element)) return
  detachHeightState(element)
  element.style.height = ''
}

export function animateRafHeight(
  element: HTMLElement,
  from: number,
  to: number,
  duration: number,
  easing: string,
  onComplete?: () => void,
): void {
  // 与 transform 一样，替换 state 时保留调用方刚写入的新起始高度。
  detachHeightState(element)
  heightStates.set(element, {
    started: performance.now(),
    duration: Math.max(1, duration),
    from,
    to,
    easing: cubicBezier(easing),
    onComplete,
  })
  ensureLayoutFrame()
}
