import { Cleanup } from '../cleanup/Cleanup';
export interface LandingTargetTrackerOptions {
    cleanup: Cleanup;
    target: HTMLElement;
    retarget(rect: DOMRect): void;
    /** 默认观察 target 到 document.body 之间的祖先尺寸变化。 */
    observeAncestors?: boolean;
    /** 祖先观察在这个元素之前停止；默认是 document.body。 */
    stopAt?: HTMLElement | null;
    /** 目标稳定后连续多少帧才降低轮询频率，默认 2。 */
    stableFrameLimit?: number;
    /** 目标稳定后的轮询间隔，按 rAF 帧数计，默认 4。 */
    idlePollInterval?: number;
}
/**
 * landing 期间持续读取真实目标位置，并把布局变化转发给 motion retarget。
 * Observer 既可以在动画完成时主动停止，也会在 Session Cleanup 时自动断开。
 *
 * 使用两种机制检测目标位置变化：
 * 1. ResizeObserver — 检测尺寸变化（卡片宽度/高度因内容变化）
 * 2. rAF 轮询 — 检测 FLIP transform 导致的位移（ResizeObserver 感知不到
 *    transform 变化，兄弟卡 FLIP 位移时目标尺寸不变但屏幕位置变了）
 */
export declare function trackLandingTarget(options: LandingTargetTrackerOptions): () => void;
