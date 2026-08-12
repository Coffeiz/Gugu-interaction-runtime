/**
 * 代理脱离原 DOM 后只复制影响字形栅格化的上下文。
 *
 * 不要把 font-size、line-height、color 等布局/组件属性写到代理根节点：
 * 它们会覆盖徽标、按钮等子元素自己的 CSS，导致子树重新排版。咕咕旧
 * physics clone 的回归记录也确认，完整复制继承样式会让卡片变高或换行。
 */
declare const FONT_RENDER_PROPERTIES: readonly ["font-family", "font-kerning", "font-feature-settings", "font-variation-settings", "font-optical-sizing", "font-stretch", "letter-spacing", "text-rendering", "-webkit-font-smoothing", "-moz-osx-font-smoothing"];
export type ProxyVisualContext = Partial<Record<typeof FONT_RENDER_PROPERTIES[number], string>>;
/**
 * Capture the inherited text context before a clone leaves its original DOM
 * ancestry. A proxy mounted in the Runtime overlay no longer inherits from the
 * board, theme shell, or card container, so text glyphs can otherwise change.
 */
export declare function captureProxyVisualContext(source: HTMLElement): ProxyVisualContext;
/** Apply the captured context to the proxy as explicit inline styles. */
export declare function applyProxyVisualContext(proxy: HTMLElement, context: ProxyVisualContext): void;
/** Capture from the source and immediately apply to a detached clone. */
export declare function preserveProxyVisualContext(source: HTMLElement, proxy: HTMLElement): void;
export {};
