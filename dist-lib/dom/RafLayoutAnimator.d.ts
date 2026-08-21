/** Runtime 当前是否仍有自己拥有的 FLIP / Surface resize 动画。 */
export declare function hasActiveRafLayoutAnimations(): boolean;
/**
 * 判断元素自身或祖先是否正在进行 Runtime 高度/reflow 动画。
 * 高度变化会触发真实 reflow，无法像 transform FLIP 一样从轨迹元数据推导
 * 子元素的新位置；landing tracker 需要在这个窄窗口内读取真实几何。
 *
 * 分组展开由 GroupLayout 使用 CSS height transition 驱动，并通过
 * data-runtime-group-animating 标记；Surface resize 则由 heightStates 驱动。
 */
export declare function hasActiveHeightAnimationInAncestors(element: HTMLElement): boolean;
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
