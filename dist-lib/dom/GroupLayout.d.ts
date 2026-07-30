import { MotionProfile } from './MotionProfile';
export declare function setMotionProfiles(profile: MotionProfile | null): void;
export interface GroupRect {
    readonly top: number;
    readonly left: number;
    readonly width: number;
    readonly height: number;
}
export interface GroupLayoutSnapshot {
    readonly element: HTMLElement;
    readonly parent: HTMLElement | null;
    readonly rect: GroupRect;
}
export interface ScrollSnapshot {
    readonly top: number;
    readonly height: number;
    readonly clientHeight: number;
    readonly anchor: 'top' | 'middle' | 'bottom';
}
export interface SurfaceLayoutSnapshot {
    readonly element: HTMLElement;
    readonly rect: GroupRect;
    readonly inlineStyle: Pick<CSSStyleDeclaration, 'height' | 'overflow' | 'transition'>;
}
export interface LayoutFlipSnapshot {
    readonly root: ParentNode;
    /** 分组树（年/月包装节点 + 挂在分组下的卡片叶子）的 Relative FLIP 快照。 */
    readonly group?: {
        readonly before: GroupLayoutSnapshot[];
    };
    /** 不属于任何分组的普通卡片（比如"进行中"列）的常规 FLIP 快照。 */
    readonly flat?: {
        readonly elements: HTMLElement[];
        readonly before: Map<HTMLElement, DOMRect>;
    };
    readonly surfaces: SurfaceLayoutSnapshot[];
}
/** 一份快照里按各自参与者的实际归属，分别捕获 Relative Group FLIP 和普通 FLIP。 */
export declare function captureLayoutFlip(cards: readonly HTMLElement[], root?: ParentNode): LayoutFlipSnapshot;
export declare function playLayoutFlip(snapshot: LayoutFlipSnapshot): void;
/**
 * 将布局播放排到下一帧。同一 root 在这一帧内出现新事务时，新事务会接管
 * 旧快照：抓起后立刻放下就不会先启动"收束"，再被第二笔 FLIP 硬清空。
 */
export declare function scheduleLayoutFlip(snapshot: LayoutFlipSnapshot): void;
export declare function captureGroupLayout(elements: readonly HTMLElement[]): GroupLayoutSnapshot[];
/**
 * Relative FLIP：节点（组或卡片叶）的屏幕位移减去直接父节点的屏幕位移，
 * 只播放它在父布局内真正产生的局部位移。父组 transform 会自然带动局部
 * 位移为 0 的子内容；同一月内卡片重排则会留下非零局部位移。
 */
export declare function playGroupFlip(before: readonly GroupLayoutSnapshot[], duration?: number, easing?: string): void;
export declare function transitionGroupHeight(element: HTMLElement, targetHeight: number, duration?: number, easing?: string): void;
/** 捕获会随卡片进出改变高度的 Surface；业务以 data-layout-surface 标注它们。 */
export declare function captureSurfaceLayout(elements: readonly HTMLElement[]): SurfaceLayoutSnapshot[];
/**
 * Surface 的高度变化属于 resize，不是位移 FLIP。先冻结旧边框盒高度，再过渡到
 * 已经由业务渲染出的最终高度；内部组/卡片继续按自己的 Relative FLIP 运动。
 */
export declare function playSurfaceResize(before: readonly SurfaceLayoutSnapshot[], duration?: number, easing?: string): void;
export declare function captureScroll(container: HTMLElement): ScrollSnapshot;
export declare function restoreScroll(container: HTMLElement, snapshot: ScrollSnapshot): void;
