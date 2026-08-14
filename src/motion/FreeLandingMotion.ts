import type { MotionFrame, MotionState, MotionTarget } from './CardMotionController'

export interface FreeLandingPoint {
  x: number
  y: number
}

export interface FreeLandingCoastConfig {
  coastSeconds: number
  maxCoast: number
  minVelocity: number
}

export const DEFAULT_FREE_LANDING_COAST: FreeLandingCoastConfig = {
  coastSeconds: 0.12,
  maxCoast: 260,
  minVelocity: 30,
}

/** 计算自由画布的最终落点，视觉目标与业务提交必须共用这一结果。 */
export function resolveFreeLandingPoint(
  point: FreeLandingPoint,
  velocity: FreeLandingPoint | undefined,
  releaseMode: 'normal' | 'physical',
  config: FreeLandingCoastConfig = DEFAULT_FREE_LANDING_COAST,
): FreeLandingPoint {
  if (releaseMode !== 'physical' || !velocity) return { ...point }
  const speed = Math.hypot(velocity.x, velocity.y)
  if (speed < config.minVelocity || config.coastSeconds <= 0 || config.maxCoast <= 0) {
    return { ...point }
  }
  const factor = Math.min(config.maxCoast, speed * config.coastSeconds) / speed
  return { x: point.x + velocity.x * factor, y: point.y + velocity.y * factor }
}

export interface FreeLandingMotionOptions {
  onFrame: (frame: MotionFrame) => void
  onArrived?: () => void
  duration: number
  easing: string
}

export interface FreeLandingMotion {
  seed(partial: Partial<MotionState>): void
  setTarget(target: MotionTarget): void
  retarget(target: MotionTarget): void
  start(): void
  stop(): void
}

/** 返回与 CSS cubic-bezier 相同的时间进度函数。 */
export function createCubicBezierEasing(x1: number, y1: number, x2: number, y2: number) {
  const ax = 3 * x1 - 3 * x2 + 1
  const bx = 3 * x2 - 6 * x1
  const cx = 3 * x1
  const ay = 3 * y1 - 3 * y2 + 1
  const by = 3 * y2 - 6 * y1
  const cy = 3 * y1
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t
  const sampleDX = (t: number) => (3 * ax * t + 2 * bx) * t + cx
  return (x: number) => {
    let t = x
    for (let i = 0; i < 8; i += 1) {
      const error = sampleX(t) - x
      if (Math.abs(error) < 1e-4) break
      const derivative = sampleDX(t)
      if (Math.abs(derivative) < 1e-6) break
      t -= error / derivative
    }
    return sampleY(Math.max(0, Math.min(1, t)))
  }
}

export function resolveFreeLandingEasing(value: string): (progress: number) => number {
  const match = value.match(/^cubic-bezier\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)$/)
  if (match) return createCubicBezierEasing(...match.slice(1).map(Number) as [number, number, number, number])
  if (value === 'linear') return progress => progress
  if (value === 'ease-in') return createCubicBezierEasing(0.42, 0, 1, 1)
  if (value === 'ease-out') return createCubicBezierEasing(0, 0, 0.58, 1)
  if (value === 'ease-in-out') return createCubicBezierEasing(0.42, 0, 0.58, 1)
  return createCubicBezierEasing(0.22, 1, 0.36, 1)
}

/**
 * 画布 free landing 的单调缓出控制器。
 *
 * 画布的惯性落点由释放阶段决定，落点后的视觉飞行不再把释放速度注入
 * 固定目标弹簧，因此不会出现列表 landing 那种过冲回弹。控制器仍然保留
 * 与普通 MotionController 相同的 seed/target/start 生命周期，便于 Runtime
 * 统一管理代理、相机转换和完成回调。
 */
export function createFreeLandingMotion(options: FreeLandingMotionOptions): FreeLandingMotion {
  const state: MotionState = {
    x: 0, y: 0, vx: 0, vy: 0,
    scaleX: 1, scaleY: 1, scaleVX: 0, scaleVY: 0,
    rotateX: 0, rotateZ: 0,
  }
  let target: MotionTarget = { x: 0, y: 0 }
  let start: MotionState = { ...state }
  let startedAt = 0
  let raf: number | null = null
  let running = false
  const easing = resolveFreeLandingEasing(options.easing)

  const emit = (progress: number) => {
    const t = easing(Math.max(0, Math.min(1, progress)))
    state.x = start.x + (target.x - start.x) * t
    state.y = start.y + (target.y - start.y) * t
    state.scaleX = start.scaleX + ((target.scaleX ?? start.scaleX) - start.scaleX) * t
    state.scaleY = start.scaleY + ((target.scaleY ?? start.scaleY) - start.scaleY) * t
    state.rotateX = start.rotateX * (1 - t)
    state.rotateZ = start.rotateZ * (1 - t)
    options.onFrame({
      x: state.x, y: state.y,
      scaleX: state.scaleX, scaleY: state.scaleY,
      rotateX: state.rotateX, rotateZ: state.rotateZ,
    })
  }

  const tick = (time: number) => {
    if (!running) return
    const progress = options.duration <= 0 ? 1 : (time - startedAt) / options.duration
    emit(progress)
    if (progress >= 1) {
      running = false
      raf = null
      options.onArrived?.()
      return
    }
    raf = requestAnimationFrame(tick)
  }

  return {
    seed(partial) {
      Object.assign(state, partial)
    },
    setTarget(next) {
      target = { ...next }
    },
    retarget(next) {
      if (!running) {
        target = { ...next }
        return
      }
      // 目标发生布局变化时从当前视觉帧接管，避免回到旧起点。
      start = { ...state }
      target = { ...next }
      startedAt = performance.now()
    },
    start() {
      if (running) return
      running = true
      start = { ...state }
      startedAt = performance.now()
      // 抓取代理在进入 landing 前已经处于 seed 位置。这里不要再同步发一帧
      // 0 进度，否则紧接着的首个 requestAnimationFrame 会重复输出起点，
      // 让视觉出现“停一拍后突然加速”的错觉。
      raf = requestAnimationFrame(tick)
    },
    stop() {
      running = false
      if (raf !== null) cancelAnimationFrame(raf)
      raf = null
    },
  }
}
