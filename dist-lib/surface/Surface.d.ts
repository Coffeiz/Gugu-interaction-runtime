/**
 * 一个可以容纳对象的区域——列/文件夹/日期格/画布/垃圾桶……见 docs/DESIGN.md。
 */
export interface Surface {
    id: string;
    /** 'list' / 'canvas' / 'trash' ... */
    type: string;
    element: HTMLElement | null;
    /** 可选滚动视口；命中仍使用 element，自动滚动/保持落点可见时使用它。 */
    viewport?: () => HTMLElement | null;
    /** 接受哪些 object type，空数组表示不限制。 */
    accepts: string[];
    /** Surface resize 运动参数。未设置时使用 DEFAULT_MOTION_PROFILE。 */
    motion?: {
        resize?: {
            duration: number;
            easing: string;
        };
    };
}
