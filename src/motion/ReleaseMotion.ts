import type { PhysicsVector } from './physics'

export interface ReleaseMotionProfile {
  /** 释放速度整体倍率。1 保持 grabbing 的真实速度。 */
  velocityScale: number
  /** 释放速度低于该值时视为没有抛出。 */
  minVelocity: number
  /** 释放速度上限，避免 grabbing 的瞬时尖峰让 landing 顶点过快。 */
  maxVelocity: number
  /** 有释放速度时的位置阻尼比例。 */
  dampingRatio: number
  /** 最大惯性外推距离，作为目标弹簧的初始偏移上限。 */
  maxCoast: number
  /** 惯性外推时间（秒）。 */
  coastSeconds: number
}

export const DEFAULT_RELEASE_PROFILE: ReleaseMotionProfile = {
  velocityScale: 1,
  minVelocity: 30,
  maxVelocity: 5000,
  dampingRatio: 0.78,
  // landing 使用目标中心的连续弹簧；不再先做独立直线 coast，避免轨迹中途折向。
  maxCoast: 0,
  coastSeconds: 0.12,
}

export const DEFAULT_COAST_FRICTION = 8

export function shapeReleaseVelocity(
  velocity: PhysicsVector,
  profile: ReleaseMotionProfile = DEFAULT_RELEASE_PROFILE,
): PhysicsVector {
  const speed = Math.hypot(velocity.x, velocity.y)
  if (speed < profile.minVelocity) return { x: 0, y: 0 }
  const x = velocity.x * profile.velocityScale
  const y = velocity.y * profile.velocityScale
  const scaledSpeed = Math.hypot(x, y)
  if (scaledSpeed <= profile.maxVelocity || scaledSpeed === 0) return { x, y }
  const factor = profile.maxVelocity / scaledSpeed
  return { x: x * factor, y: y * factor }
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
