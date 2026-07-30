type RafState = {
  frame: number
  started: number
  duration: number
  fromX: number
  fromY: number
  easing: (value: number) => number
}

const states = new WeakMap<HTMLElement, RafState>()
const heightStates = new WeakMap<HTMLElement, RafState>()

function cubicBezier(easing: string): (value: number) => number {
  const match = easing.match(/cubic-bezier\(([^)]+)\)/)
  if (!match) return value => value * value * (3 - 2 * value)
  const values = match[1].split(',').map(Number)
  if (values.length !== 4 || values.some(value => !Number.isFinite(value))) {
    return value => value * value * (3 - 2 * value)
  }
  const [x1, y1, x2, y2] = values
  return progress => {
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

export function cancelRafTransform(element: HTMLElement): void {
  const state = states.get(element)
  if (!state) return
  cancelAnimationFrame(state.frame)
  states.delete(element)
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
  cancelRafTransform(element)
  const state: RafState = {
    frame: 0,
    started: performance.now(),
    duration: Math.max(1, duration),
    fromX,
    fromY,
    easing: cubicBezier(easing),
  }
  states.set(element, state)
  const tick = (time: number) => {
    if (states.get(element) !== state) return
    const progress = Math.min(1, (time - state.started) / state.duration)
    const eased = state.easing(progress)
    element.style.transform = `translate(${(state.fromX * (1 - eased)).toFixed(3)}px, ${(state.fromY * (1 - eased)).toFixed(3)}px)`
    if (progress >= 1) {
      states.delete(element)
      element.style.transform = ''
      onComplete?.()
      return
    }
    state.frame = requestAnimationFrame(tick)
  }
  state.frame = requestAnimationFrame(tick)
}

export function cancelRafHeight(element: HTMLElement): void {
  const state = heightStates.get(element)
  if (!state) return
  cancelAnimationFrame(state.frame)
  heightStates.delete(element)
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
  cancelRafHeight(element)
  const state: RafState = {
    frame: 0,
    started: performance.now(),
    duration: Math.max(1, duration),
    fromX: from,
    fromY: to,
    easing: cubicBezier(easing),
  }
  heightStates.set(element, state)
  const tick = (time: number) => {
    if (heightStates.get(element) !== state) return
    const progress = Math.min(1, (time - state.started) / state.duration)
    const value = state.fromX + (state.fromY - state.fromX) * state.easing(progress)
    element.style.height = `${value}px`
    if (progress >= 1) {
      heightStates.delete(element)
      onComplete?.()
      return
    }
    state.frame = requestAnimationFrame(tick)
  }
  state.frame = requestAnimationFrame(tick)
}
