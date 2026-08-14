export interface FloatingSurfaceOptions {
    /** 浮动 Surface 是否打开；由 Vue 适配层负责驱动外壳高度。 */
    open?: boolean | (() => boolean);
    /** 用于选择多个同级滚动区域中的真实滚动节点。 */
    scrollKey?: string | (() => string | null);
    /** 自然高度上限；传函数可以读取响应式/运行时尺寸。 */
    maxHeight?: number | (() => number | null);
}
export interface FloatingSurfaceDom {
    layoutElement: HTMLElement | null;
    viewport: HTMLElement | null;
    measureLayout: (() => {
        height: number;
    } | null);
}
/**
 * 只在传入的 Surface 根节点内解析浮动 Surface 的布局角色。
 * 不扫描 document，也不把外壳错误地当成滚动视口。
 */
export declare function resolveFloatingSurfaceDom(root: HTMLElement | null, options?: FloatingSurfaceOptions): FloatingSurfaceDom;
