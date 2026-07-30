export interface SpringParams {
  stiffness: number
  damping: number
}

export interface MotionProfile {
  position: SpringParams
  scale: SpringParams
}

/** Gugu 卡片落地使用的默认弹簧参数。
 * 阻尼取接近临界阻尼（2 * sqrt(420) ≈ 41），长距离落地缓出但不过冲回弹。
 */
export const LANDING_PROFILE: MotionProfile = {
  position: { stiffness: 420, damping: 41 },
  scale: { stiffness: 420, damping: 41 },
}

/** Gugu grabbing 跟手阶段的默认参数。 */
export const FOLLOW_PROFILE: MotionProfile = {
  position: { stiffness: 360, damping: 2 * 0.85 * Math.sqrt(360) },
  scale: { stiffness: 420, damping: 30 },
}

export const FOLLOW_ROTATION = {
  tilt: 5,
  sway: 0.25,
  smoothing: 0.2,
}
