import { MotionFrame, MotionState, MotionTarget } from './CardMotionController';
export interface DirectFollowControllerOptions {
    onFrame: (frame: MotionFrame) => void;
}
/** CardMotionController 的最小接口子集，两种运动策略的调用方共用同一套调用形状。 */
export interface DragMotionDriver {
    setTarget(target: MotionTarget): void;
    getState(): Readonly<MotionState>;
    stop(): void;
}
/**
 * “直接跟随”运动策略：pointermove 坐标原样、逐帧同步写入 transform，
 * 不经过弹簧插值、tilt/sway 姿态，也不产生 release 速度——是
 * `motion.enabled === false` 时 MotionController 的退化替代，不新建独立的
 * 拖拽生命周期，只是把 onFrame 的驱动源从物理积分换成指针坐标本身。
 */
export declare function createDirectFollowController(options: DirectFollowControllerOptions): DragMotionDriver;
