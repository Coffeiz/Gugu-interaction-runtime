import type { MotionFrame, MotionState, MotionTarget } from './CardMotionController'
import { integrateSpring } from './physics'

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

// free landing 的目标距离通常来自画布卡片的实际落点，可能明显大于一张卡片宽度。
// 采用咕咕旧版跟手阶段的弹簧参数，让 free landing 的手感更接近画布拖拽。
// 释放速度仍从抓取控制器连续继承，避免重新启动 easing。
// 比跟手阶段更慢地收束，避免松手后过快贴到目标；阻尼保持接近临界值，
// 让速度放缓的同时不引入明显回弹。
const FREE_LANDING_STIFFNESS = 240
const FREE_LANDING_DAMPING = 30
const FREE_LANDING_SPEED_HEADROOM = 1
// 位置 spring 通常需要约 500~700ms 才完全收束；旋转不能沿用普通
// controller 的快速衰减，否则卡片会先摆正、再继续滑向目标。
const FREE_LANDING_ROTATION_DECAY = 5

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
 * 画布 free landing 的速度连续控制器。
 *
 * 画布的惯性落点由释放阶段决定，落地阶段使用临界阻尼积分继续继承释放速度。
 * 这样不会像固定 cubic-bezier 那样在第一帧重新生成更高的速度，也不会引入
 * 列表 landing 的回弹效果。控制器仍然保留与普通 MotionController 相同的
 * seed/target/start 生命周期，便于 Runtime 统一管理代理、相机转换和完成回调。
 */
export function createFreeLandingMotion(options: FreeLandingMotionOptions): FreeLandingMotion {
  const state: MotionState = {
    x: 0, y: 0, vx: 0, vy: 0,
    scaleX: 1, scaleY: 1, scaleVX: 0, scaleVY: 0,
    rotateX: 0, rotateZ: 0,
  }
  let target: MotionTarget = { x: 0, y: 0 }
  let lastTime: number | null = null
  let raf: number | null = null
  let running = false
  let maxLandingSpeed: number | undefined
  const emit = () => {
    options.onFrame({
      x: state.x, y: state.y,
      scaleX: state.scaleX, scaleY: state.scaleY,
      rotateX: state.rotateX, rotateZ: state.rotateZ,
    })
  }

  const tick = (time: number) => {
    if (!running) return
    const dt = Math.min(0.032, Math.max(0, (time - (lastTime ?? time)) / 1000))
    lastTime = time
    const previousPosition = { x: state.x, y: state.y }
    const position = { position: { x: state.x, y: state.y }, velocity: { x: state.vx, y: state.vy } }
    integrateSpring(position, { x: target.x, y: target.y }, FREE_LANDING_STIFFNESS, FREE_LANDING_DAMPING, dt)
    if (maxLandingSpeed !== undefined && dt > 0) {
      const dx = position.position.x - previousPosition.x
      const dy = position.position.y - previousPosition.y
      const distance = Math.hypot(dx, dy)
      const maxDistance = maxLandingSpeed * FREE_LANDING_SPEED_HEADROOM * dt
      if (distance > maxDistance && distance > 0) {
        const ratio = maxDistance / distance
        position.position.x = previousPosition.x + dx * ratio
        position.position.y = previousPosition.y + dy * ratio
        position.velocity.x = (position.position.x - previousPosition.x) / dt
        position.velocity.y = (position.position.y - previousPosition.y) / dt
      }
    }
    state.x = position.position.x
    state.y = position.position.y
    state.vx = position.velocity.x
    state.vy = position.velocity.y

    const scale = { position: { x: state.scaleX, y: state.scaleY }, velocity: { x: state.scaleVX, y: state.scaleVY } }
    integrateSpring(scale, { x: target.scaleX ?? state.scaleX, y: target.scaleY ?? state.scaleY }, FREE_LANDING_STIFFNESS, FREE_LANDING_DAMPING, dt)
    state.scaleX = scale.position.x
    state.scaleY = scale.position.y
    state.scaleVX = scale.velocity.x
    state.scaleVY = scale.velocity.y
    const rotationDecay = Math.exp(-FREE_LANDING_ROTATION_DECAY * dt)
    state.rotateX *= rotationDecay
    state.rotateZ *= rotationDecay
    emit()
    const arrived = Math.abs(target.x - state.x) < 0.35
      && Math.abs(target.y - state.y) < 0.35
      && Math.abs(state.vx) < 5
      && Math.abs(state.vy) < 5
      && Math.abs((target.scaleX ?? state.scaleX) - state.scaleX) < 0.001
      && Math.abs((target.scaleY ?? state.scaleY) - state.scaleY) < 0.001
      && Math.abs(state.scaleVX) < 0.01
      && Math.abs(state.scaleVY) < 0.01
    if (arrived) {
      state.x = target.x
      state.y = target.y
      if (target.scaleX !== undefined) state.scaleX = target.scaleX
      if (target.scaleY !== undefined) state.scaleY = target.scaleY
      state.vx = 0
      state.vy = 0
      state.scaleVX = 0
      state.scaleVY = 0
      emit()
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
      if (partial.vx !== undefined || partial.vy !== undefined) {
        const releaseSpeed = Math.hypot(partial.vx ?? state.vx, partial.vy ?? state.vy)
        maxLandingSpeed = releaseSpeed > 30 ? releaseSpeed : undefined
      }
    },
    setTarget(next) {
      target = { ...next }
    },
    retarget(next) {
      if (!running) {
        target = { ...next }
        return
      }
      target = { ...next }
    },
    start() {
      if (running) return
      running = true
      lastTime = performance.now()
      raf = requestAnimationFrame(tick)
    },
    stop() {
      running = false
      if (raf !== null) cancelAnimationFrame(raf)
      raf = null
    },
  }
}
