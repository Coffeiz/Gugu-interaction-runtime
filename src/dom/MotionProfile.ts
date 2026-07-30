/** 运动参数配置：控制 FLIP、Surface resize 和落地速度。所有字段可选，
 *  注册时只填关心的部分，未设置的字段回退到 DEFAULT_MOTION_PROFILE。 */
export interface MotionProfile {
  flip?: {
    /** FLIP 位移动画时长，ms。 */
    duration: number
    /** CSS easing 函数。 */
    easing: string
  }
  resize?: {
    /** Surface 高度变化动画时长，ms。 */
    duration: number
    /** CSS easing 函数。 */
    easing: string
  }
  landing?: {
    /** proxy 落地飞行时长，ms。 */
    duration: number
    /** CSS easing 函数。 */
    easing: string
  }
  group?: {
    /** 组展开/收起高度动画时长，ms。 */
    duration: number
    /** CSS easing 函数。 */
    easing: string
  }
}

/** 默认运动参数，用作 fallback。 */
export const DEFAULT_MOTION_PROFILE: Required<MotionProfile> = {
  flip: { duration: 250, easing: 'cubic-bezier(.22,1,.36,1)' },
  resize: { duration: 250, easing: 'cubic-bezier(.22,1,.36,1)' },
  landing: { duration: 250, easing: 'cubic-bezier(.22,1,.36,1)' },
  group: { duration: 250, easing: 'cubic-bezier(.22,1,.36,1)' },
}
