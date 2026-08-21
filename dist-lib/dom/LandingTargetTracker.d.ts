import { Cleanup } from '../cleanup/Cleanup';
export interface LandingTargetTrackerOptions {
    cleanup: Cleanup;
    target: HTMLElement;
    retarget(rect: DOMRect): void;
    /** 已在 landing 初始化阶段读取过的视觉矩形；避免 tracker 再做一次首帧布局读取。 */
    initialRect?: DOMRect;
    /** 默认观察 target 到 document.body 之间的祖先尺寸变化。 */
    observeAncestors?: boolean;
    /** 祖先观察在这个元素之前停止；默认是 document.body。 */
    stopAt?: HTMLElement | null;
    /** 目标稳定后连续多少帧才降低 DOM fallback 轮询频率，默认 2。 */
    stableFrameLimit?: number;
    /** 目标稳定后的 DOM fallback 轮询间隔，按 rAF 帧数计，默认 4。 */
    idlePollInterval?: number;
}
/**
 * landing 期间追踪真实目标的位置变化。
 *
 * Runtime 自己的 FLIP / Surface resize 不再通过每帧 getBoundingClientRect()
 * 反读：RafLayoutAnimator 已经持有相同的 easing、起点和时钟。target 或祖先
 * 有 FLIP translation 时直接计算 visual rect；Runtime 其它布局动画仍在进行
 * 时暂停 DOM fallback，等整笔 Runtime 动画结束后只做一次 reconcile。
 *
 * 关键区别是："其它 Runtime 动画 active"不再等价于"这个 target 没变化"。
 * LayoutMeasurement 会把 Runtime 本来就要做的真实测量按 element 发布；并发
 * transaction 如果确实改变了当前 landing target，tracker 在下一帧消费新
 * final rect，并继续叠加 Runtime 已知的 FLIP trajectory。这样恢复即时 retarget，
 * 同时不恢复旧的逐帧 DOM polling。
 */
export declare function trackLandingTarget(options: LandingTargetTrackerOptions): () => void;
