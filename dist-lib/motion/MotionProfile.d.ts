export interface SpringParams {
    stiffness: number;
    damping: number;
}
export interface MotionProfile {
    position: SpringParams;
    scale: SpringParams;
}
/** MotionController 的可调参数，和调试面板字段一一对应。 */
export interface MotionControllerConfig {
    follow?: {
        stiffness?: number;
        damping?: number;
    };
    rotation?: {
        tilt?: number;
        sway?: number;
        smoothing?: number;
    };
    release?: {
        velocityScale?: number;
        minVelocity?: number;
        maxVelocity?: number;
        dampingRatio?: number;
    };
}
/** Gugu 卡片落地使用的默认弹簧参数。
 * 阻尼取接近临界阻尼（2 * sqrt(420) ≈ 41），长距离落地缓出但不过冲回弹。
 */
export declare const LANDING_PROFILE: MotionProfile;
/** Gugu grabbing 跟手阶段的默认参数。 */
export declare const FOLLOW_PROFILE: MotionProfile;
export declare const FOLLOW_ROTATION: {
    tilt: number;
    sway: number;
    smoothing: number;
};
