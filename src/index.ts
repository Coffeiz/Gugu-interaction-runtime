/**
 * Runtime 对外稳定入口。
 * 接入方不需要了解 src 下的目录结构，也不应直接依赖 demo 实现。
 */
export { Runtime, runtime } from './Runtime'
export type { MoveSessionOrchestration } from './Runtime'
export { Session } from './session/Session'
export type { SessionState } from './session/Session'
export { MoveBehavior } from './behavior/MoveBehavior'
export type {
  MoveContext,
  MoveBehaviorDriver,
  MoveVisualLifecycle,
  MoveReleaseResult,
  LandingResult,
} from './behavior/MoveBehavior'
export type { Behavior, BehaviorContext } from './behavior/Behavior'
export { ObjectStore } from './object/ObjectStore'
export { SurfaceStore } from './surface/SurfaceStore'
export type { VisualAdapter, VisualAdapterRegistry } from './dom/VisualAdapter'
export { DefaultVisualAdapter, VisualAdapters } from './dom/VisualAdapter'
export type { VisualPhase, VisualState, VisualSnapshot } from './dom/VisualAdapterTypes'
export { mountVisualOverlay } from './dom/Visual'
export type { HitResolver, HitResult } from './dom/Hit'
export { createDomHitResolver, hitWithResolver } from './dom/Hit'
export type { LandingTargetTrackerOptions } from './dom/LandingTargetTracker'
export { trackLandingTarget } from './dom/LandingTargetTracker'
export type { PointerSessionInputOptions, PointerSessionInputSink } from './input/PointerSessionInput'
export { bindPointerSessionInput } from './input/PointerSessionInput'
export type { Action, MoveAction, TransferAction, SortAction, ResizeAction, LinkAction } from './action/Action'
export type { RuntimeInput, StartRequest, SessionHandle } from './core/Interaction'
