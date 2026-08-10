import type { MotionFrame, MotionState, MotionTarget } from './CardMotionController'

export interface DirectFollowControllerOptions {
  onFrame: (frame: MotionFrame) => void
}

/** CardMotionController 的最小接口子集，两种运动策略的调用方共用同一套调用形状。 */
export interface DragMotionDriver {
  setTarget(target: MotionTarget): void
  getState(): Readonly<MotionState>
  stop(): void
}

/**
 * “直接跟随”运动策略：pointermove 坐标原样、逐帧同步写入 transform，
 * 不经过弹簧插值、tilt/sway 姿态，也不产生 release 速度——是
 * `motion.enabled === false` 时 MotionController 的退化替代，不新建独立的
 * 拖拽生命周期，只是把 onFrame 的驱动源从物理积分换成指针坐标本身。
 */
export function createDirectFollowController(options: DirectFollowControllerOptions): DragMotionDriver {
  const state: MotionState = {
    x: 0, y: 0, vx: 0, vy: 0,
    scaleX: 1, scaleY: 1, scaleVX: 0, scaleVY: 0,
    rotateX: 0, rotateZ: 0,
  }
  return {
    setTarget(target: MotionTarget) {
      state.x = target.x
      state.y = target.y
      options.onFrame({ x: state.x, y: state.y, scaleX: 1, scaleY: 1, rotateX: 0, rotateZ: 0 })
    },
    getState: () => state,
    stop() {},
  }
}
