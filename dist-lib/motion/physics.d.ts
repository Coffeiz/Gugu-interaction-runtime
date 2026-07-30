export interface PhysicsVector {
    x: number;
    y: number;
}
export interface SpringState {
    position: PhysicsVector;
    velocity: PhysicsVector;
}
/** 帧率无关的二阶弹簧积分；调用方负责保存状态和决定每帧如何渲染。 */
export declare function integrateSpring(state: SpringState, target: PhysicsVector, stiffness: number, damping: number, dt: number, maxStep?: number): void;
