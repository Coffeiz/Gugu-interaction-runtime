export interface PhysicsVector {
  x: number
  y: number
}

export interface SpringState {
  position: PhysicsVector
  velocity: PhysicsVector
}

/** 帧率无关的二阶弹簧积分；调用方负责保存状态和决定每帧如何渲染。 */
export function integrateSpring(
  state: SpringState,
  target: PhysicsVector,
  stiffness: number,
  damping: number,
  dt: number,
  maxStep = 1 / 120,
): void {
  let remaining = Math.max(0, dt)
  while (remaining > 1e-4) {
    const step = Math.min(remaining, maxStep)
    remaining -= step
    const ax = stiffness * (target.x - state.position.x) - damping * state.velocity.x
    const ay = stiffness * (target.y - state.position.y) - damping * state.velocity.y
    state.velocity.x += ax * step
    state.velocity.y += ay * step
    state.position.x += state.velocity.x * step
    state.position.y += state.velocity.y * step
  }
}
