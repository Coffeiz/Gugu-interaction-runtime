import type { ReleaseMotionProfile } from '../motion/ReleaseMotion'

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
  freeLanding?: {
    /** 画布 free landing 的非回弹飞行时长，ms。 */
    duration: number
    /** 画布 landing 的缓动曲线。 */
    easing: string
    /** 物理释放时的惯性外推时间，秒。 */
    coastSeconds: number
    /** 物理释放时的最大惯性距离，像素。 */
    maxCoast: number
    /** 低于该速度时不产生惯性外推。 */
    minVelocity: number
    /** 仅 free landing 使用的释放速度整形参数；未设置时沿用全局释放档案。 */
    release?: Partial<Pick<ReleaseMotionProfile, 'velocityScale' | 'maxVelocity'>>
  }
  target?: {
    /** 语义目标飞入使用的独立弹簧参数，不继承全局 landing。 */
    motion?: {
      position: import('../motion/MotionProfile').SpringParams
      scale: import('../motion/MotionProfile').SpringParams
    }
    /** 语义目标 landing 的独立飞入参数。 */
    landing?: {
      duration: number
      easing: string
    }
    /** 语义目标缩小淡出参数；从 landing 第一帧同步开始。 */
    dismiss?: {
      duration: number
      easing: string
      scale: number
    }
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
  landing: { duration: 300, easing: 'cubic-bezier(.22,1,.36,1)' },
  freeLanding: {
    duration: 550,
    easing: 'cubic-bezier(.22,1,.36,1)',
    coastSeconds: 0.12,
    maxCoast: 260,
    minVelocity: 30,
  },
  target: {
    motion: {
      position: { stiffness: 420, damping: 41 },
      scale: { stiffness: 420, damping: 41 },
    },
    landing: { duration: 300, easing: 'cubic-bezier(.22,1,.36,1)' },
    dismiss: { duration: 300, easing: 'cubic-bezier(.22,1,.36,1)', scale: 0.72 },
  },
  group: { duration: 250, easing: 'cubic-bezier(.22,1,.36,1)' },
}
