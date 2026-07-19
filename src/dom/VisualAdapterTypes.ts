export type VisualPhase = 'idle' | 'pressed' | 'dragging' | 'landing' | 'revealing'

export interface VisualState {
  readonly phase: VisualPhase
  readonly hovered: boolean
  readonly selected: boolean
  readonly grabbed: boolean
}

export interface VisualSnapshot {
  readonly rect: DOMRect
  readonly borderRadius: string
  readonly boxShadow: string
  readonly background: string
  readonly opacity: string
  readonly transform: string
}
