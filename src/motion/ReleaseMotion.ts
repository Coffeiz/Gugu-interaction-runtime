import type { PhysicsVector } from './physics'

export interface ReleaseMotionProfile {
  /** 释放速度整体倍率。1 保持 grabbing 的真实速度。 */
  velocityScale: number
  /** 释放速度低于该值时视为没有抛出。 */
  minVelocity: number
  /** 最大惯性外推距离，作为目标弹簧的初始偏移上限。 */
  maxCoast: number
  /** 惯性外推时间（秒）。 */
  coastSeconds: number
}

export const DEFAULT_RELEASE_PROFILE: ReleaseMotionProfile = {
  velocityScale: 1,
  minVelocity: 30,
  maxCoast: 0,
  coastSeconds: 0.12,
}

export function shapeReleaseVelocity(
  velocity: PhysicsVector,
  profile: ReleaseMotionProfile = DEFAULT_RELEASE_PROFILE,
): PhysicsVector {
  const speed = Math.hypot(velocity.x, velocity.y)
  if (speed < profile.minVelocity) return { x: 0, y: 0 }
  return { x: velocity.x * profile.velocityScale, y: velocity.y * profile.velocityScale }
}

export function coastOffset(
  velocity: PhysicsVector,
  profile: ReleaseMotionProfile = DEFAULT_RELEASE_PROFILE,
): PhysicsVector {
  const shaped = shapeReleaseVelocity(velocity, profile)
  const length = Math.hypot(shaped.x, shaped.y) * profile.coastSeconds
  if (length <= 0 || profile.maxCoast <= 0) return { x: 0, y: 0 }
  const factor = Math.min(1, profile.maxCoast / length)
  return { x: shaped.x * profile.coastSeconds * factor, y: shaped.y * profile.coastSeconds * factor }
}
