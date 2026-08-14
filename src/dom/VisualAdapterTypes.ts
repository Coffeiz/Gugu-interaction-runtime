export type VisualPhase = 'idle' | 'pressed' | 'dragging' | 'landing' | 'revealing'

export interface VisualState {
  readonly phase: VisualPhase
  readonly hovered: boolean
  readonly selected: boolean
  readonly grabbed: boolean
}

/** 对象附加交互的 DOM 选择器；Runtime 只管理生命周期状态，不渲染业务按钮。 */
export interface ObjectAffordancesConfig {
  readonly selector: string | readonly string[]
}

export interface VisualSnapshot {
  readonly rect: DOMRect
  readonly borderRadius: string
  readonly boxShadow: string
  readonly border: string
  readonly backdropFilter: string
  readonly background: string
  /** 背景图（渐变等）。background 简写只取 backgroundColor，渐变在 backgroundImage 里。 */
  readonly backgroundImage?: string
  readonly opacity: string
  readonly transform: string
}

/**
 * 视觉上下文：从元素捕获的 CSS 继承属性集合。
 * 当元素被移动到 overlay 等脱离原 DOM 树的位置时，
 * 继承链断裂，需要显式固化这些属性以保持渲染一致。
 */
export interface VisualContext {
  readonly fontFamily: string
  readonly color: string
  readonly fontSize: string
  readonly fontWeight: string
  readonly lineHeight: string
  readonly letterSpacing: string
  readonly textAlign: string
  readonly direction: string
  readonly wordSpacing: string
  readonly whiteSpace: string
  readonly textIndent: string
}
