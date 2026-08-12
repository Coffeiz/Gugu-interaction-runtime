/**
 * 一个可以容纳对象的区域——列/文件夹/日期格/画布/垃圾桶……见 docs/DESIGN.md。
 */
export interface Surface {
    id: string;
    /** 'list' / 'canvas' / 'trash' ... */
    type: string;
    element: HTMLElement | null;
    /** 可选的实际布局元素；element 仍用于命中，布局 FLIP 使用此元素。 */
    layoutElement?: () => HTMLElement | null;
    /** 返回自然布局尺寸；用于 element 被固定高度包裹时的跨事务 resize。 */
    measureLayout?: () => {
        width?: number;
        height: number;
    } | null;
    /** 可选滚动视口；命中仍使用 element，自动滚动/保持落点可见时使用它。 */
    viewport?: () => HTMLElement | null;
    /** 接受哪些 object type，空数组表示不限制。 */
    accepts: string[];
    /** Surface 的布局语义；free 使用连续坐标，grid 使用容器内的卡片落位。 */
    layout: 'grid' | 'free';
    /** 当前 Surface 的相机上下文；grid Surface 通常不提供。 */
    camera?: SurfaceCamera;
    /** Surface resize 运动参数。未设置时使用 DEFAULT_MOTION_PROFILE。 */
    motion?: {
        resize?: {
            duration: number;
            easing: string;
        };
    };
    /** 注册代次，用于 Vue 组件卸载时保护新实例。 */
    generation?: number;
}
export interface SurfaceCamera {
    /** 世界内容相对于视口的实时视觉缩放比例。 */
    scale: number | (() => number);
    /** 相机变换原点在视口坐标中的实时位置。 */
    origin?: () => {
        left: number;
        top: number;
    };
    /** 抓取代理从 Surface 自身尺寸过渡到相机尺寸的时长；不传则立即使用当前倍率。 */
    pickupDuration?: number;
}
export type SurfaceUpdate = Partial<Pick<Surface, 'type' | 'viewport' | 'layoutElement' | 'measureLayout' | 'accepts' | 'layout' | 'camera' | 'motion'>>;
