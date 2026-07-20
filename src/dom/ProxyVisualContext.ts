const INHERITED_TEXT_PROPERTIES = [
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'lineHeight',
  'letterSpacing',
  'color',
  'textAlign',
  'textTransform',
  'direction',
  'writingMode',
] as const

export type ProxyVisualContext = Partial<Pick<CSSStyleDeclaration, typeof INHERITED_TEXT_PROPERTIES[number]>>

/**
 * Capture the inherited text context before a clone leaves its original DOM
 * ancestry. A proxy mounted in the Runtime overlay no longer inherits from the
 * board, theme shell, or card container, so text glyphs can otherwise change.
 */
export function captureProxyVisualContext(source: HTMLElement): ProxyVisualContext {
  const computed = getComputedStyle(source)
  return Object.fromEntries(
    INHERITED_TEXT_PROPERTIES.map(property => [property, computed[property]]),
  ) as ProxyVisualContext
}

/** Apply the captured context to the proxy as explicit inline styles. */
export function applyProxyVisualContext(proxy: HTMLElement, context: ProxyVisualContext): void {
  Object.assign(proxy.style, context)
}

/** Capture from the source and immediately apply to a detached clone. */
export function preserveProxyVisualContext(source: HTMLElement, proxy: HTMLElement): void {
  applyProxyVisualContext(proxy, captureProxyVisualContext(source))
}
