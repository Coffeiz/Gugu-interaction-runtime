import { LayoutMeasurement } from './LayoutMeasurement';
export declare const FLIP_DURATION: number;
export declare const FLIP_EASING: string;
/**
 * 通用 FLIP：在一次 DOM 变化前后分别调用 capture()/play()，用 transform
 * 补间视觉位移，不摸 height/opacity 等其它属性。对应 Gugu-web
 * flipCoordinator.ts 里的 FlipTransaction，这里是收敛后的最小版本。
 */
export declare function captureRects(elements: HTMLElement[], measurement?: LayoutMeasurement): Map<HTMLElement, DOMRect>;
/**
 * 新布局事务接管尚未结束的 Runtime FLIP。before rect 已在清除前读取，清除
 * 仅用于测量新的无 transform 布局；两步发生在同一 JS 帧内，不会露出跳帧。
 */
export declare function resetActiveFlip(elements: readonly HTMLElement[]): void;
export declare function playFlip(elements: HTMLElement[], before: Map<HTMLElement, DOMRect>, duration?: number, easing?: string, measurement?: LayoutMeasurement): void;
