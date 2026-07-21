import { Owner } from './owner/Owner'
import { Session } from './session/Session'
import { ObjectStore } from './object/ObjectStore'
import { SurfaceStore } from './surface/SurfaceStore'
import { Emitter } from './core/Emitter'
import type { RuntimeInput, SessionHandle, StartRequest } from './core/Interaction'
import type { Behavior, BehaviorContext } from './behavior/Behavior'
import { BehaviorStore } from './behavior/BehaviorStore'
import { MoveBehavior, type MoveBehaviorDriver, type MoveContext, type MoveVisualLifecycle } from './behavior/MoveBehavior'
import { DefaultVisualAdapter, VisualAdapters, type VisualAdapter } from './dom/VisualAdapter'
import type { HitResolver } from './dom/Hit'
import {
  trackLandingTarget as observeLandingTarget,
  type LandingTargetTrackerOptions,
} from './dom/LandingTargetTracker'
import {
  bindPointerSessionInput as attachPointerSessionInput,
  type PointerSessionInputOptions,
} from './input/PointerSessionInput'
import type { Action } from './action/Action'
import type { MoveActionDestination } from './behavior/MoveTransaction'

export type RuntimeEvent =
  | { type: 'object-added' | 'object-removed' | 'object-changed'; id: string }
  | { type: 'surface-added' | 'surface-removed' | 'surface-changed'; id: string }
  | { type: 'ownership-changed'; id: string }

export type RuntimeLandingTargetOptions = Omit<
  LandingTargetTrackerOptions,
  'cleanup' | 'target' | 'retarget'
>

export interface OrchestrateMoveSessionOptions {
  /** 跟手阶段的行为驱动。 */
  driver?: MoveBehaviorDriver
  /** 落地/揭示阶段的视觉生命周期。 */
  lifecycle?: MoveVisualLifecycle
  /** PointerSessionInput 选项。 */
  pointerInput?: PointerSessionInputOptions
  /**
   * 已存在的 sessionId。传入时跳过 start()，直接绑定到已有 session。
   * 用于 demo 等需要在 start() 和 wiring 之间做初始化的场景。
   */
  sessionId?: string
  /**
   * 跟手定位的目标元素。设置后 MoveBehavior.update() 会自动更新该元素的
   * left/top 实现跟手。业务层无需手动设置 moveContext.followElement。
   */
  followElement?: HTMLElement | null
}

export interface MoveSessionHandle extends SessionHandle {
  /** 当前 session 的 MoveContext。 */
  readonly moveContext: MoveContext
  /** 解绑 pointer 输入并清理。 */
  dispose(): void
}

export class Runtime {
  readonly owner = new Owner()
  readonly objects = new ObjectStore()
  readonly surfaces = new SurfaceStore()
  readonly behaviors = new BehaviorStore()
  readonly visuals = new VisualAdapters()
  private readonly moveBehavior: MoveBehavior
  private hitResolver: HitResolver | null = null
  private sessions = new Map<string, Session>()
  private readonly events = new Emitter<RuntimeEvent>()
  private readonly actions = new Emitter<Action>()

  constructor() {
    this.moveBehavior = new MoveBehavior()
    this.behaviors.register(this.moveBehavior)
    this.objects.subscribe(event => this.events.emit(event))
    this.surfaces.subscribe(event => this.events.emit(event))
    this.owner.subscribe(id => this.events.emit({ type: 'ownership-changed', id }))
  }

  registerVisualAdapter(type: string, adapter: VisualAdapter): void {
    this.visuals.register(type, adapter)
  }

  getVisualAdapter(type: string): VisualAdapter {
    return this.visuals.get(type) ?? new DefaultVisualAdapter()
  }

  setHitResolver(resolver: HitResolver | null): void {
    this.hitResolver = resolver
  }

  getHitResolver(): HitResolver | null {
    return this.hitResolver
  }

  subscribe(listener: (event: RuntimeEvent) => void): () => void {
    return this.events.subscribe(listener)
  }

  onAction(listener: (action: Action) => void): () => void {
    return this.actions.subscribe(listener)
  }

  emitAction(action: Action): void {
    this.actions.emit(action)
  }

  snapshot() {
    return {
      objects: this.objects.snapshot(),
      surfaces: this.surfaces.snapshot(),
    }
  }

  registerBehavior(behavior: Behavior): void {
    this.behaviors.register(behavior)
  }

  setMoveDriver(driver: MoveBehaviorDriver): void {
    this.moveBehavior.setDriver(driver)
  }

  bindMoveSession(sessionId: string, driver: MoveBehaviorDriver): void {
    this.moveBehavior.bindSession(sessionId, driver)
  }

  bindMoveLifecycle(sessionId: string, lifecycle: MoveVisualLifecycle): void {
    this.moveBehavior.bindLifecycle(sessionId, lifecycle)
  }

  getMoveContext(sessionId: string): MoveContext {
    return this.moveBehavior.getContext(sessionId)
  }

  registerRegrab(objectId: string, handler: (event: PointerEvent) => void): void {
    this.moveBehavior.registerRegrab(objectId, handler)
  }

  getRegrab(objectId: string): ((event: PointerEvent) => void) | undefined {
    return this.moveBehavior.getRegrab(objectId)
  }

  clearRegrab(objectId: string, handler?: (event: PointerEvent) => void): void {
    this.moveBehavior.clearRegrab(objectId, handler)
  }

  /**
   * 绑定 active 阶段的全局 pointer 输入。pointerup 会先立即解绑监听器，再把
   * release 交回 Runtime；cancel/interrupt 时由 Session Cleanup 兜底。
   */
  bindPointerSessionInput(
    sessionId: string,
    options: PointerSessionInputOptions = {},
  ): () => void {
    const session = this.sessions.get(sessionId)
    if (!session) return () => undefined
    return attachPointerSessionInput(this, session, options)
  }

  /**
   * landing 期间追踪真实目标及其祖先的布局变化，并自动登记到 Session Cleanup。
   */
  trackLandingTarget(
    sessionId: string,
    target: HTMLElement,
    retarget: (rect: DOMRect) => void,
    options: RuntimeLandingTargetOptions = {},
  ): () => void {
    const session = this.sessions.get(sessionId)
    if (!session) return () => undefined
    return observeLandingTarget({
      ...options,
      cleanup: session.cleanup,
      target,
      retarget,
    })
  }

  start(request: StartRequest): SessionHandle {
    const behavior = this.behaviors.get(request.type)
    if (!behavior) throw new Error(`Unknown interaction behavior: ${request.type}`)

    const session = this.startSession(request.type, request.objectId)
    const context = this.createBehaviorContext(session)

    // prepare 必须同步执行：业务侧（demo/kanbanDrag.ts 等）紧接着从
    // getMoveContext() 读 sourceElement/dragOffset 算 proxy 起点位置，
    // 推迟到 microtask 会让这些字段在读时还没被填（→ proxy 跑到
    // 浏览器左上角）。prepare 如果返回 Promise（异步清理/动画初始化），
    // 错误走异步 catch，但同步的 transition('active') 不等它——demo
    // 需要在 start() 返回那一刻 MoveContext 已是可用状态。
    try {
      const result = behavior.prepare?.(context, request)
      if (result && typeof (result as { then?: unknown }).then === 'function') {
        (result as Promise<void>).catch(error => {
          if (this.sessions.get(session.id) === session) {
            this.cancel(session.id, error instanceof Error ? error.message : 'prepare-failed')
          }
        })
      }
    } catch (error) {
      this.cancel(session.id, error instanceof Error ? error.message : 'prepare-failed')
    }

    if (this.sessions.get(session.id) === session && session.state === 'prepare') {
      session.transition('active')
    }

    return {
      id: session.id,
      get state() { return session.state },
      cancel: reason => this.cancel(session.id, reason ?? 'cancelled'),
      interrupt: reason => this.interrupt(session.id, reason ?? 'interrupted'),
    }
  }

  /**
   * 编排一次完整的 move Session：start → bind driver → bind lifecycle →
   * bind pointer input，一步到位。
   *
   * 调用方只需提供 driver（跟手阶段的行为）和 lifecycle（落地/揭示阶段的
   * 视觉逻辑），不需要手动调用 bindMoveSession/bindMoveLifecycle/
   * bindPointerSessionInput。
   *
   * 返回的 handle 包含 session id、moveContext、state 以及 dispose() 方法。
   */
  orchestrateMoveSession(
    request: StartRequest,
    options: OrchestrateMoveSessionOptions = {},
  ): MoveSessionHandle {
    // 如果传入了已存在的 sessionId，跳过 start() 直接绑定
    let session: Session
    if (options.sessionId) {
      const existing = this.sessions.get(options.sessionId)
      if (!existing) throw new Error(`Session not found: ${options.sessionId}`)
      session = existing
    } else {
      const handle = this.start(request)
      session = this.sessions.get(handle.id)!
    }

    const moveContext = this.getMoveContext(session.id)

    if (options.followElement !== undefined) {
      moveContext.followElement = options.followElement
    }

    if (options.driver) {
      this.bindMoveSession(session.id, options.driver)
    }
    if (options.lifecycle) {
      this.bindMoveLifecycle(session.id, options.lifecycle)
    }

    const stopPointerInput = this.bindPointerSessionInput(session.id, options.pointerInput)

    return {
      id: session.id,
      get state() { return session.state },
      get moveContext() { return moveContext },
      cancel: reason => this.cancel(session.id, reason ?? 'cancelled'),
      interrupt: reason => this.interrupt(session.id, reason ?? 'interrupted'),
      dispose: () => { stopPointerInput() },
    }
  }

  update(sessionId: string, input: RuntimeInput): void {
    const session = this.sessions.get(sessionId)
    if (!session || session.state !== 'active') return
    this.behaviors.get(session.type)?.update?.(this.createBehaviorContext(session), input)
  }

  async release(sessionId: string, input: RuntimeInput): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) return
    if (session.state === 'prepare') {
      this.cancel(session.id, 'interaction-not-ready')
      return
    }
    if (session.state === 'active') session.transition('release')
    if (session.state !== 'release') return

    const behavior = this.behaviors.get(session.type)
    if (behavior instanceof MoveBehavior) {
      behavior.captureLayout(this.createBehaviorContext(session))
    }
    let result: unknown
    try {
      result = await behavior?.release?.(this.createBehaviorContext(session), input)
    } catch (error) {
      this.cancel(session.id, error instanceof Error ? error.message : 'release-failed')
      return
    }

    if (this.sessions.get(session.id) !== session) return

    const releaseResult = result as { accepted?: boolean; destination?: unknown } | undefined
    if (releaseResult?.accepted === false) {
      this.cancel(session.id, 'no-valid-drop')
      return
    }

    if (session.state === 'release') session.transition('landing')

    if (!(behavior instanceof MoveBehavior)) {
      this.endSession(session)
      return
    }

    const destination = releaseResult?.destination
    if (destination === undefined) {
      this.cancel(session.id, 'invalid-release-result')
      return
    }

    // 布局快照由 Runtime 在 commit 前统一捕获，避免业务 driver 自己编排
    // capture/schedule 与 Action、landing 产生竞态。
    // commit 阶段：执行业务变更（emitAction + FLIP + 清理跟手样式）
    try {
      await behavior.commit(this.createBehaviorContext(session), destination)
    } catch (error) {
      this.cancel(session.id, error instanceof Error ? error.message : 'commit-failed')
      return
    }

    behavior.playLayout(this.createBehaviorContext(session))

    if (this.sessions.get(session.id) !== session) return

    const moveContext = behavior instanceof MoveBehavior
      ? behavior.getContext(session.id)
      : null
    if (moveContext && this.emitMoveAction(session.objectId, moveContext.destination, moveContext.transaction)) {
      // Action 已由 Runtime 统一发出；视觉 driver 的 commit 仍负责布局和样式，
      // 但不再需要重复提交业务动作。
    }

    try {
      const landingResult = await behavior.landing(this.createBehaviorContext(session), destination)
      const liveSession = this.sessions.get(session.id)
      if (liveSession !== session) return
      if (liveSession.state === 'disposed' || liveSession.state === 'interrupt') return
      if (landingResult && !landingResult.completed) {
        this.cancel(session.id, landingResult.reason ?? 'landing-failed')
        return
      }
      // landing 完成只代表临时视觉运动结束；先进入 handoff，等待视觉策略
      // 把最终 DOM/样式交回业务节点，再允许 Session 正常结束。这样成功路径
      // 与取消、regrab 的终态边界一致，也不会把 reveal 误认为 dispose。
      session.handoff()
      if (behavior.reveal) await behavior.reveal(this.createBehaviorContext(session), destination)
      if (this.sessions.get(session.id) !== session) return
      this.endSession(session)
    } catch (error) {
      if (this.sessions.get(session.id) === session) {
        this.cancel(session.id, error instanceof Error ? error.message : 'landing-failed')
      }
    }
  }

  private emitMoveAction(
    objectId: string,
    destination: unknown,
    transaction: MoveContext['transaction'],
  ): boolean {
    if (transaction.actionEmitted || !isMoveActionDestination(destination)) return false
    const action: Action = {
      type: 'move',
      objectId,
      fromSurfaceId: destination.fromSurfaceId,
      toSurfaceId: destination.toSurfaceId,
      ...(destination.toIndex === undefined ? {} : { toIndex: destination.toIndex }),
      timestamp: Date.now(),
    }
    transaction.actionEmitted = true
    this.actions.emit(action)
    return true
  }

  cancel(sessionId: string, reason = 'cancelled'): void {
    const session = this.sessions.get(sessionId)
    if (!session) return
    const behavior = this.behaviors.get(session.type)
    const context = this.createBehaviorContext(session)

    try {
      if (behavior instanceof MoveBehavior) behavior.cancelLayout(context, reason)
      behavior?.cancel?.(context, reason)
    } catch (error) {
      console.error('Behavior cancel failed', error)
    } finally {
      try {
        session.cancel()
      } finally {
        this.disposeBehavior(behavior, context)
        this.sessions.delete(session.id)
      }
    }
  }

  interrupt(sessionId: string, reason: string = 'cancel'): void {
    const session = this.sessions.get(sessionId)
    if (!session) return
    const behavior = this.behaviors.get(session.type)
    const context = this.createBehaviorContext(session)

    try {
      if (behavior instanceof MoveBehavior) behavior.cancelLayout(context, reason)
      behavior?.interrupt?.(context, reason)
    } catch (error) {
      console.error('Behavior interrupt failed', error)
    } finally {
      try {
        session.interrupt(reason === 'regrab' ? 'regrab' : 'cancel')
      } finally {
        this.disposeBehavior(behavior, context)
        this.sessions.delete(session.id)
      }
    }
  }

  startSession(type: string, objectId = ''): Session {
    const session = new Session(type, objectId, this.owner)
    this.sessions.set(session.id, session)
    return session
  }

  getSession(id: string): Session | undefined {
    return this.sessions.get(id)
  }

  endSession(session: Session): void {
    const behavior = this.behaviors.get(session.type)
    const context = this.createBehaviorContext(session)
    try {
      session.dispose()
    } finally {
      this.disposeBehavior(behavior, context)
      this.sessions.delete(session.id)
    }
  }

  private disposeBehavior(behavior: Behavior | undefined, context: BehaviorContext): void {
    try {
      behavior?.dispose?.(context)
    } catch (error) {
      console.error('Behavior dispose failed', error)
    }
  }

  private createBehaviorContext(session: Session): BehaviorContext {
    const item = this.objects.get(session.objectId)
    return {
      session,
      emitAction: (action: Action) => this.actions.emit(action),
      visual: item ? this.getVisualAdapter(item.type) : undefined,
      hit: this.hitResolver,
    }
  }
}

export const runtime = new Runtime()

function isMoveActionDestination(value: unknown): value is MoveActionDestination {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<MoveActionDestination>
  return typeof candidate.fromSurfaceId === 'string'
    && typeof candidate.toSurfaceId === 'string'
    && (candidate.toIndex === undefined || typeof candidate.toIndex === 'number')
}
