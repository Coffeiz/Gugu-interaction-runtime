import type { RuntimeInput, StartRequest } from '../core/Interaction'
import type { Session } from '../session/Session'
import type { Action } from '../action/Action'
import type { VisualAdapter } from '../dom/VisualAdapter'
import type { HitResolver } from '../dom/Hit'

export interface BehaviorContext {
  session: Session
  emitAction?: (action: Action) => void
  visual?: VisualAdapter
  hit?: HitResolver | null
}

/**