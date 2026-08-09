/**
 * Runtime 对外稳定入口。
 * 接入方不需要了解 src 下的目录结构，也不应直接依赖 demo 实现。
 */
export { Runtime, runtime } from './Runtime'
export type { RuntimeEvent, RuntimeLandingTargetOptions, ObjectTypeRegistration, GrabAlignConfig } from './Runtime'
export { RuntimeRegistry } from './runtime/RuntimeRegistry'
export { createVueRuntimeAdapter } from './adapters/vue'
export { createReactRuntimeAdapter } from './adapters/react'
export type { RuntimeDomAdapter } from './adapters/dom'
export { RuntimeDispatcher } from './runtime/RuntimeInput'
export { SessionCoordinator, RuntimeSessionCoordinator } from './runtime/RuntimeSession'
export { MoveActionCoordinator } from './runtime/RuntimeMove'
export { VisualProxyCoordinator, VisualStateCoordinator, VisualMotionCoordinator } from './runtime/RuntimeVisual'
export { MoveUpdateCoordinator, MoveReleaseCoordinator } from './runtime/RuntimeMove'
export { MoveCommitCoordinator, MoveLandingCoordinator } from './runtime/RuntimeMove'
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
export { TargetStore } from './target/TargetStore'
export type { TargetItem } from './target/Target'
export type { VisualAdapter, VisualAdapterRegistry } from './dom/VisualAdapter'
export { DefaultVisualAdapter, VisualAdapters } from './dom/VisualAdapter'
export type { VisualPhase, VisualState, VisualSnapshot } from './dom/VisualAdapterTypes'
export { createDetachMoveFromAdapter } from './runtime/detach/DetachAdapter'
export type { HitResolver, HitResult } from './dom/Hit'
export { createDomHitResolver, hitWithResolver } from './dom/Hit'
export { createRegisteredHitResolver } from './dom/RegisteredHit'
export { acquireSourceVisualLease, type SourceVisualLease } from './dom/SourceVisualLease'
export { trackLandingTarget } from './dom/LandingTargetTracker'
export type { LandingTargetTrackerOptions } from './dom/LandingTargetTracker'
export { transitionGroupHeight } from './dom/GroupLayout'
export { runGroupToggle } from './dom/GroupLayout'
export { setLayoutPresenceEnabled } from './dom/GroupLayout'
export type { GroupToggleOptions } from './dom/GroupLayout'
export { captureLayoutFlip, playLayoutFlip } from './dom/GroupLayout'
export { cancelLayoutAnimations } from './dom/GroupLayout'
export type { LayoutFlipSnapshot } from './dom/GroupLayout'
export { captureCollectionPresence, playCollectionPresence } from './dom/CollectionPresence'
export type { CollectionPresenceSnapshot, CollectionPresenceOptions } from './dom/CollectionPresence'
export { bindPointerSessionInput } from './input/PointerSessionInput'
export type {
  PointerSessionInputOptions,
  PointerSessionInputRuntime,
} from './input/PointerSessionInput'
export type { Action, MoveAction, TransferAction, SortAction, ResizeAction, LinkAction } from './action/Action'
export type { RuntimeInput, StartRequest, SessionHandle } from './core/Interaction'
export {
  createCardMotionController,
  type CardMotionController,
  type CardMotionControllerOptions,
  type MotionState,
  type MotionTarget,
  type MotionFrame,
  type FollowRotationConfig,
  type ArriveThreshold,
} from './motion/CardMotionController'
export { LANDING_PROFILE, FOLLOW_PROFILE, FOLLOW_ROTATION, type MotionProfile as CardMotionProfile, type SpringParams } from './motion/MotionProfile'
export type { MotionControllerConfig } from './motion/MotionProfile'
export { integrateSpring, type PhysicsVector, type SpringState } from './motion/physics'
export { DEFAULT_RELEASE_PROFILE, shapeReleaseVelocity, coastOffset, type ReleaseMotionProfile } from './motion/ReleaseMotion'
