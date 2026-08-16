import { MotionFrame, MotionState, MotionTarget } from './CardMotionController';
export interface FreeLandingPoint {
    x: number;
    y: number;
}
export interface FreeLandingCoastConfig {
    coastSeconds: number;
    maxCoast: number;
    minVelocity: number;
}
export declare const DEFAULT_FREE_LANDING_COAST: FreeLandingCoastConfig;
export declare const DEFAULT_FREE_LANDING_PHYSICS: {
    readonly stiffness: 240;
    readonly damping: 30;
    readonly rotationDecay: 5;
};
/** 计算自由画布的最终落点，视觉目标与业务提交必须共用这一结果。 */
export declare function resolveFreeLandingPoint(point: FreeLandingPoint, velocity: FreeLandingPoint | undefined, releaseMode: 'normal' | 'physical', config?: FreeLandingCoastConfig): FreeLandingPoint;
export interface FreeLandingMotionOptions {
    onFrame: (frame: MotionFrame) => void;
    onArrived?: () => void;
    /** 物理参数；duration/easing 不参与位置积分。 */
    duration?: number;
    easing?: string;
    stiffness?: number;
    damping?: number;
    rotationDecay?: number;
}
export interface FreeLandingMotion {
    seed(partial: Partial<MotionState>): void;
    setTarget(target: MotionTarget): void;
    retarget(target: MotionTarget): void;
    start(): void;
    stop(): void;
}
/** 返回与 CSS cubic-bezier 相同的时间进度函数。 */
export declare function createCubicBezierEasing(x1: number, y1: number, x2: number, y2: number): (x: number) => number;
export declare function resolveFreeLandingEasing(value: string): (progress: number) => number;
/**
 * 画布 free landing 的速度连续控制器。
 *
 * 画布的惯性落点由释放阶段决定，落地阶段使用临界阻尼积分继续继承释放速度。
 * 这样不会像固定 cubic-bezier 那样在第一帧重新生成更高的速度，也不会引入
 * 列表 landing 的回弹效果。控制器仍然保留与普通 MotionController 相同的
 * seed/target/start 生命周期，便于 Runtime 统一管理代理、相机转换和完成回调。
 */
export declare function createFreeLandingMotion(options: FreeLandingMotionOptions): FreeLandingMotion;
