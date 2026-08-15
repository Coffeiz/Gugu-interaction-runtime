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
/** 计算自由画布的最终落点，视觉目标与业务提交必须共用这一结果。 */
export declare function resolveFreeLandingPoint(point: FreeLandingPoint, velocity: FreeLandingPoint | undefined, releaseMode: 'normal' | 'physical', config?: FreeLandingCoastConfig): FreeLandingPoint;
export interface FreeLandingMotionOptions {
    onFrame: (frame: MotionFrame) => void;
    onArrived?: () => void;
    duration: number;
    easing: string;
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
 * 画布 free landing 的单调缓出控制器。
 *
 * 画布的惯性落点由释放阶段决定，落点后的视觉飞行不再把释放速度注入
 * 固定目标弹簧，因此不会出现列表 landing 那种过冲回弹。控制器仍然保留
 * 与普通 MotionController 相同的 seed/target/start 生命周期，便于 Runtime
 * 统一管理代理、相机转换和完成回调。
 */
export declare function createFreeLandingMotion(options: FreeLandingMotionOptions): FreeLandingMotion;
