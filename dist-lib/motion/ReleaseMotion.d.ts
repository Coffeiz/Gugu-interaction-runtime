import { PhysicsVector } from './physics';
export interface ReleaseMotionProfile {
    /** 释放速度整体倍率。1 保持 grabbing 的真实速度。 */
    velocityScale: number;
    /** 释放速度低于该值时视为没有抛出。 */
    minVelocity: number;
    /** 释放速度上限，避免 grabbing 的瞬时尖峰让 landing 顶点过快。 */
    maxVelocity: number;
    /** 有释放速度时的位置阻尼比例。 */
    dampingRatio: number;
    /** 最大惯性外推距离，作为目标弹簧的初始偏移上限。 */
    maxCoast: number;
    /** 惯性外推时间（秒）。 */
    coastSeconds: number;
}
export declare const DEFAULT_RELEASE_PROFILE: ReleaseMotionProfile;
export declare const DEFAULT_COAST_FRICTION = 8;
export declare function shapeReleaseVelocity(velocity: PhysicsVector, profile?: ReleaseMotionProfile): PhysicsVector;
export declare function coastOffset(velocity: PhysicsVector, profile?: ReleaseMotionProfile): PhysicsVector;
