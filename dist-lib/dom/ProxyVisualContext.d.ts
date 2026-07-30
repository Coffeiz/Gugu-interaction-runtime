declare const INHERITED_TEXT_PROPERTIES: readonly ["fontFamily", "fontSize", "fontWeight", "fontStyle", "lineHeight", "letterSpacing", "color", "textAlign", "textTransform", "direction", "writingMode"];
export type ProxyVisualContext = Partial<Pick<CSSStyleDeclaration, typeof INHERITED_TEXT_PROPERTIES[number]>>;
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
