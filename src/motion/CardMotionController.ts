import { integrateSpring } from './physics'
import { LANDING_PROFILE, type MotionProfile } from './MotionProfile'

export interface MotionState {
  x: number
  y: number
  vx: number
  vy: number
  scaleX: number
  scaleY: number
  scaleVX: number
  scaleVY: number
  rotateX: number
  rotateZ: number
}

export interface MotionTarget {
  x: number
  y: number
  scaleX?: number
  scaleY?: number
}

export interface MotionFrame {
  x: number
  y: number
  scaleX: number
  scaleY: number
  rotateX: number
  rotateZ: number
}

export interface ArriveThreshold {
  position: number
  velocity: number
}

export interface FollowRotationConfig {
  tilt: number
  sway: number
  maxSway?: number
  maxTiltDelta?: number
  verticalTiltFactor?: number
}

export interface CardMotionControllerOptions {
  onFrame: (frame: MotionFrame) => void
  onArrived?: () => void
  arriveThreshold?: ArriveThreshold
  mode?: 'settle' | 'follow'
  followRotation?: FollowRotationConfig
}

export interface CardMotionController {
  seed(partial: Partial<MotionState>): void
  setTarget(target: MotionTarget): void
  setProfile(profile: MotionProfile): void
  getState(): Readonly<MotionState>
  start(): void
  stop(): void
}

const DEFAULT_ARRIVE: ArriveThreshold = { position: 0.35, velocity: 5 }
const FOLLOW_VELOCITY_SMOOTHING_RATE = -Math.log(1 - 0.12) * 60

/**
 * Gugu 卡片的纯运动状态机。
 *
 * 它只处理位置、速度、缩放和拖拽姿态，不创建 DOM、不读取业务状态，也不决定
 * 落点。业务视觉适配器通过 onFrame 把结果写入 proxy 或其他视觉载体。
 */
export function createCardMotionController(options: CardMotionControllerOptions): CardMotionController {
  const mode = options.mode ?? 'settle'
  if (mode === 'follow' && !options.followRotation) {
    throw new Error('CardMotionController: mode "follow" 需要提供 followRotation 参数')
  }

  const arrive = options.arriveThreshold ?? DEFAULT_ARRIVE
  const state: MotionState = {
    x: 0, y: 0, vx: 0, vy: 0,
    scaleX: 1, scaleY: 1, scaleVX: 0, scaleVY: 0,
    rotateX: 0, rotateZ: 0,
  }
  let target: MotionTarget = { x: 0, y: 0 }
  let profile: MotionProfile = LANDING_PROFILE
  let raf: number | null = null
  let lastTime: number | null = null
  let running = false
  let smoothedVX = 0
  let smoothedVY = 0

  function emitFrame(): void {
    options.onFrame({
      x: state.x, y: state.y,
      scaleX: state.scaleX, scaleY: state.scaleY,
      rotateX: state.rotateX, rotateZ: state.rotateZ,
    })
  }

  function tick(time: number): void {
    if (!running) return
    const dt = Math.min(0.032, lastTime == null ? 1 / 60 : Math.max(0, (time - lastTime) / 1000))
    lastTime = time

    const position = { position: { x: state.x, y: state.y }, velocity: { x: state.vx, y: state.vy } }
    integrateSpring(position, { x: target.x, y: target.y }, profile.position.stiffness, profile.position.damping, dt)
    state.x = position.position.x
    state.y = position.position.y
    state.vx = position.velocity.x
    state.vy = position.velocity.y

    const scale = { position: { x: state.scaleX, y: state.scaleY }, velocity: { x: state.scaleVX, y: state.scaleVY } }
    integrateSpring(scale, { x: target.scaleX ?? state.scaleX, y: target.scaleY ?? state.scaleY }, profile.scale.stiffness, profile.scale.damping, dt)
    state.scaleX = scale.position.x
    state.scaleY = scale.position.y
    state.scaleVX = scale.velocity.x
    state.scaleVY = scale.velocity.y

    if (mode === 'follow') {
      const rotation = options.followRotation!
      const smoothing = 1 - Math.exp(-FOLLOW_VELOCITY_SMOOTHING_RATE * dt)
      smoothedVX += (state.vx - smoothedVX) * smoothing
      smoothedVY += (state.vy - smoothedVY) * smoothing
      state.rotateZ = Math.max(-(rotation.maxSway ?? 5), Math.min(rotation.maxSway ?? 5, (smoothedVX / 60) * rotation.sway))
      const delta = Math.max(-(rotation.maxTiltDelta ?? 4), Math.min(rotation.maxTiltDelta ?? 4, (smoothedVY / 60) * (rotation.verticalTiltFactor ?? 0.16)))
      state.rotateX = rotation.tilt + delta
    } else {
      const decay = Math.exp(-10 * dt)
      state.rotateX *= decay
      state.rotateZ *= decay
    }

    emitFrame()
    if (mode === 'follow') {
      raf = requestAnimationFrame(tick)
      return
    }
    const arrived = Math.abs(target.x - state.x) < arrive.position
      && Math.abs(target.y - state.y) < arrive.position
      && Math.abs(state.vx) < arrive.velocity
      && Math.abs(state.vy) < arrive.velocity
    if (arrived) {
      running = false
      raf = null
      options.onArrived?.()
      return
    }
    raf = requestAnimationFrame(tick)
  }

  return {
    seed(partial) { Object.assign(state, partial) },
    setTarget(next) { target = { ...next } },
    setProfile(next) { profile = next },
    getState() { return state },
    start() {
      if (running) return
      running = true
      lastTime = null
      emitFrame()
      raf = requestAnimationFrame(tick)
    },
    stop() {
      running = false
      if (raf !== null) cancelAnimationFrame(raf)
      raf = null
    },
  }
}
