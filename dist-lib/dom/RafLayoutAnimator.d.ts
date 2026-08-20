/** Runtime 当前是否仍有自己拥有的 FLIP / Surface resize 动画。 */
export declare function hasActiveRafLayoutAnimations(): boolean;
/** 返回该元素自身由 Runtime FLIP 驱动的当前视觉位移；不存在时返回 null。 */
export declare function readRafTransformOffset(element: HTMLElement, time?: number): {
    x: number;
    y: number;
} | null;
/**
 * 返回该元素当前由 Runtime FLIP 产生的 viewport 位移。Relative FLIP 会把
 * 一部分位移写在祖先 group 上，因此这里沿祖先链合成 active translation；
 * landing 可以直接消费这条已知轨迹，而不必每帧反读 getBoundingClientRect()。
 */
export declare function readRafVisualOffset(element: HTMLElement, time?: number): {
    x: number;
    y: number;
} | null;
export declare function cancelRafTransform(element: HTMLElement): void;
export declare function animateRafTransform(element: HTMLElement, fromX: number, fromY: number, duration: number, easing: string, onComplete?: () => void): void;
export declare function cancelRafHeight(element: HTMLElement): void;
export declare function animateRafHeight(element: HTMLElement, from: number, to: number, duration: number, easing: string, onComplete?: () => void): void;
