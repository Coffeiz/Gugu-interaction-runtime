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

/** 一种交互过程的执行编排；业务对象不直接管理 Session 生命周期。 */
export interface Behavior {
  readonly type: string
  prepare?(context: BehaviorContext, request: StartRequest): void | Promise<void>
  update?(context: BehaviorContext, input: RuntimeInput): void
  release?(context: BehaviorContext, input: RuntimeInput): unknown | Promise<unknown>
  cancel?(context: BehaviorContext, reason: string): void
  interrupt?(context: BehaviorContext, reason: string): void
  /** 无论成功、取消还是打断都会调用一次，用于释放 Behavior 自己保存的 Session 状态。 */
  dispose?(context: BehaviorContext): void
}
