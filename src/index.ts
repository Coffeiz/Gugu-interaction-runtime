/**
 * Runtime 对外稳定入口。
 * 接入方不需要了解 src 下的目录结构，也不应直接依赖 demo 实现。
 */
export { Runtime, runtime } from './Runtime'
export type { RuntimeEvent, RuntimeLandingTargetOptions } from './Runtime'
export { RuntimeRegistry } from './runtime/RuntimeRegistry'
export { RuntimeDispatcher } from './runtime/RuntimeDispatcher'
export { SessionCoordinator } from './runtime/SessionCoordinator'
export { MoveActionCoordinator } from './runtime/MoveActionCoordinator'
export { VisualProxyCoordinator } from './runtime/VisualProxyCoordinator'
export { MoveUpdateCoordinator } from './runtime/MoveUpdateCoordinator'
export { MoveReleaseCoordinator } from './runtime/MoveReleaseCoordinator'
export { MoveCommitCoordinator } from './runtime/MoveCommitCoordinator'
export { MoveLandingCoordinator } from './runtime/MoveLandingCoordinator'
export { VisualStateCoordinator } from './runtime/VisualStateCoordinator'
export { VisualMotionCoordinator } from './runtime/VisualMotionCoordinator'
export * from './runtime/RuntimeMove'
export * from './runtime/RuntimeVisual'
export * from './runtime/RuntimeSession'
export * from './runtime/RuntimeInput'
export { Session } from './session/Session'
export type { SessionState } from './session/Session'
export { MoveBehavior } from './behavior/MoveBehavior'
export { MoveTransaction } from './behavior/MoveTransaction'
export type { MoveTransactionPhase, MoveActionDestination } from './behavior/MoveTransaction'
export type {
  MoveContext,
  MoveBehaviorDriver,
  MoveVisualLifecycle,
  MoveVisualStrategy,
  MoveLayoutLifecycle,
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
export { trackLandingTarget } from './dom/LandingTargetTracker'
export type { LandingTargetTrackerOptions } from './dom/LandingTargetTracker'
export { bindPointerSessionInput } from './input/PointerSessionInput'
export type {
  PointerSessionInputOptions,
  PointerSessionInputRuntime,
} from './input/PointerSessionInput'
export type { Action, MoveAction, TransferAction, SortAction, ResizeAction, LinkAction } from './action/Action'
export type { RuntimeInput, StartRequest, SessionHandle } from './core/Interaction'
