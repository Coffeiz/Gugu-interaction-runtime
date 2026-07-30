import { MotionProfile } from './MotionProfile';
export interface MotionState {
    x: number;
    y: number;
    vx: number;
    vy: number;
    scaleX: number;
    scaleY: number;
    scaleVX: number;
    scaleVY: number;
    rotateX: number;
    rotateZ: number;
    rotateVX: number;
    rotateVZ: number;
}
export interface MotionTarget {
    x: number;
    y: number;
    scaleX?: number;
    scaleY?: number;
}
export interface MotionFrame {
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
    rotateX: number;
    rotateZ: number;
}
export interface ArriveThreshold {
    position: number;
    velocity: number;
}
export interface FollowRotationConfig {
    tilt: number;
    sway: number;
    maxSway?: number;
    maxTiltDelta?: number;
    verticalTiltFactor?: number;
    smoothing?: number;
}
export interface CardMotionControllerOptions {
    onFrame: (frame: MotionFrame) => void;
    onArrived?: () => void;
    arriveThreshold?: ArriveThreshold;
    mode?: 'settle' | 'follow';
    followRotation?: FollowRotationConfig;
}
export interface CoastMotionProfile {
    duration: number;
    friction: number;
    maxDistance: number;
    minVelocity: number;
}
export interface CardMotionController {
    seed(partial: Partial<MotionState>): void;
    setTarget(target: MotionTarget): void;
    retarget(target: MotionTarget): void;
    setProfile(profile: MotionProfile): void;
    getState(): Readonly<MotionState>;
    start(): void;
    startCoastThenSettle(profile: CoastMotionProfile): void;
    interrupt(): MotionState;
    cancel(): MotionState;
    stop(): void;
}
/**
 * Gugu 卡片的纯运动状态机。
 *
 * 它只处理位置、速度、缩放和拖拽姿态，不创建 DOM、不读取业务状态，也不决定
 * 落点。业务视觉适配器通过 onFrame 把结果写入 proxy 或其他视觉载体。
 */
export declare function createCardMotionController(options: CardMotionControllerOptions): CardMotionController;
