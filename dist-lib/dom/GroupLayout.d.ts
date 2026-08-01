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
 * 把布局播放排到微任务里，同一 root 在这一批同步代码内出现新事务时，新
 * 事务会接管旧快照：抓起后立刻放下就不会先启动"收束"，再被第二笔 FLIP
 * 硬清空。
 *
 * 这里原来用的是 requestAnimationFrame，而不是 queueMicrotask——两者都能
 * 实现"合并同一批同步调用"这个效果，但 rAF 只保证"下一次绘制之前执行"，
 * 不保证"这一帧还没画完就执行"：如果 DOM 变化（松手、Vue 重渲染、兄弟卡
 * 让位）发生在一次不是由 rAF 驱动的事件（比如 pointerup）里，浏览器完全
 * 可能在当前任务结束后先画一帧——这时候 FLIP 的 Invert 步骤（读取"变化后"
 * 位置、写入反向 transform 把视觉冻结在"变化前"）还没执行，画出来的就是
 * "已经变化完、但动画还没开始"的最终布局，下一帧才突然摁回起点开始播放，
 * 表现为松手瞬间"闪一下排布好的最终布局，然后才回到起点做动画"。
 * queueMicrotask 保证在任何绘制之前执行，同时仍然能被同步执行的后续调用
 * 覆盖（微任务队列在当前同步代码跑完之后、下一次绘制之前统一清空），批量
 * 合并的效果不受影响。
 */
export declare function scheduleLayoutFlip(snapshot: LayoutFlipSnapshot): void;
/**
 * rAF 版调度：等下一帧、Vue patch 全部落地后再量布局执行 Invert。
 * 只用于"列尾追加"——此时目标列已有卡片无位移（没有 transform Invert），
 * 只有容器 resize + 被拖卡片滑入，rAF 不会产生闪现；而 rAF 保证量到的是
 * 最终布局（容器高度含新卡片），resize 冻结与播放同帧起步，不会顶动。
 * 中间插入/重排有卡片位移 FLIP（有 Invert），必须走 microtask 版
 * scheduleLayoutFlip，Invert 才能在 paint 前写入、不闪现。
 */
export declare function scheduleLayoutFlipOnRaf(snapshot: LayoutFlipSnapshot): void;
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
