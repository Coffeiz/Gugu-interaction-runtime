import { Owner } from './owner/Owner'
import type { Lease } from './owner/Owner'
import { Session } from './session/Session'
import { ObjectStore } from './object/ObjectStore'
import { SurfaceStore } from './surface/SurfaceStore'
import { Emitter } from './core/Emitter'
import type { RuntimeInput, SessionHandle, StartRequest } from './core/Interaction'
import type { Behavior, BehaviorContext } from './behavior/Behavior'
import { BehaviorStore } from './behavior/BehaviorStore'
import { MoveBehavior, type MoveBehaviorDriver, type MoveContext, type MoveVisualLifecycle, type MoveVisualStrategy } from './behavior/MoveBehavior'
import { DefaultVisualAdapter, type VisualAdapter, type VisualLifecycleContext, type VisualProxy } from './dom/VisualAdapter'
import type { VisualState } from './dom/VisualAdapterTypes'
import type { HitResolver } from './dom/Hit'
import type { LandingTargetTrackerOptions } from './dom/LandingTargetTracker'
import type { PointerSessionInputOptions } from './input/PointerSessionInput'
import type { Action } from './action/Action'
import { RuntimeRegistry } from './runtime/RuntimeRegistry'
import { RuntimeDispatcher } from './runtime/RuntimeDispatcher'
import { SessionCoordinator, type SessionCompletionGate } from './runtime/SessionCoordinator'
import { MoveActionCoordinator } from './runtime/MoveActionCoordinator'
import { VisualProxyCoordinator } from './runtime/VisualProxyCoordinator'
import { MoveCommitCoordinator } from './runtime/MoveCommitCoordinator'
import { MoveLandingCoordinator } from './runtime/MoveLandingCoordinator'
import { VisualStateCoordinator } from './runtime/VisualStateCoordinator'
import { VisualMotionCoordinator } from './runtime/VisualMotionCoordinator'
import { RuntimeInputCoordinator } from './runtime/RuntimeInput'
import { RuntimeMoveCoordinator } from './runtime/RuntimeMove'
import { RuntimeSessionCoordinator } from './runtime/RuntimeSession'

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
  /** 可选的对象视觉策略；未传时按对象类型从 Runtime 注册表解析。 */
  visualStrategy?: MoveVisualStrategy
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

export interface ObjectTypeRegistration {
  defaultVisualMode: string
  /** 类型级视觉适配器；每个对象只复用这一份适配器定义。 */
  visual?: ObjectVisualAdapter
  /** 兼容旧 demo 的手动启动入口。 */
  start?(context: { objectId: string; element: HTMLElement; event: PointerEvent; mode: string }): void
  /** 新入口：Runtime 根据适配器自动创建并编排一次 Move Session。 */
  createMove?(context: {
    objectId: string
    element: HTMLElement
    event: PointerEvent
    mode: string
  }): {
    request?: StartRequest
    driver?: MoveBehaviorDriver
    lifecycle?: MoveVisualLifecycle
    pointerInput?: PointerSessionInputOptions
  }
}

export interface ObjectVisualAdapter extends VisualAdapter {
  /** 迁移阶段的视觉启动实现；最终由 createMove 替代。 */
  legacyStart?(context: {
    objectId: string
    element: HTMLElement
    event: PointerEvent
    mode: string
  }): void
  createMove?(context: {
    objectId: string
    element: HTMLElement
    event: PointerEvent
    mode: string
  }): {
    request?: StartRequest
    driver?: MoveBehaviorDriver
    lifecycle?: MoveVisualLifecycle
    pointerInput?: PointerSessionInputOptions
  }
}

export interface RuntimeCompletionGate<T> {
  readonly promise: Promise<T>
  complete(value: T): void
  fail(reason?: string): void
}

export interface RegrabContext {
  readonly sessionId: string
  readonly objectId: string
  readonly event: PointerEvent
  readonly proxyElement: HTMLElement
  readonly sourceElement: HTMLElement
  readonly proxyRect: DOMRect
  interrupt(reason?: string): void
}

export class Runtime {
  readonly owner = new Owner()
  readonly objects = new ObjectStore()
  readonly surfaces = new SurfaceStore()
  readonly behaviors = new BehaviorStore()
  readonly registry = new RuntimeRegistry()
  /** 兼容现有调用方；新的注册逻辑统一落在 registry。 */
  get visuals() { return this.registry.visuals }
  private readonly moveBehavior: MoveBehavior
  private hitResolver: HitResolver | null = null
  private readonly sessionCoordinator = new SessionCoordinator()
  private readonly runtimeSession = new RuntimeSessionCoordinator(this.sessionCoordinator)
  private readonly events = new Emitter<RuntimeEvent>()
  private readonly actions = new Emitter<Action>()
  private readonly inputCoordinator: RuntimeInputCoordinator
  private readonly visualProxyCoordinator = new VisualProxyCoordinator()
  private readonly dispatcher: RuntimeDispatcher
  private readonly moveActions: MoveActionCoordinator
  private readonly runtimeMove: RuntimeMoveCoordinator
  private readonly moveCommit: MoveCommitCoordinator
  private readonly moveLanding: MoveLandingCoordinator
  private readonly visualState: VisualStateCoordinator
  private readonly visualMotion: VisualMotionCoordinator

  constructor() {
    this.moveBehavior = new MoveBehavior()
    this.inputCoordinator = new RuntimeInputCoordinator({
      objects: this.objects,
      registry: this.registry,
      startObjectPointer: (objectId, element, event) => this.startObjectPointer(objectId, element, event),
      registerRegrab: (objectId, handler) => this.registerRegrab(objectId, handler),
      regrab: (objectId, event) => this.regrab(objectId, event),
      update: (sessionId, input) => this.update(sessionId, input),
      release: (sessionId, input) => this.release(sessionId, input),
    })
    this.moveActions = new MoveActionCoordinator({
      getObjectSurface: objectId => this.objects.get(objectId)?.surfaceId,
      emit: action => this.actions.emit(action),
    })
    this.moveCommit = new MoveCommitCoordinator({
      createContext: session => this.createBehaviorContext(session),
      getLifecycle: sessionId => this.moveBehavior.getLifecycle(sessionId),
      normalize: (objectId, destination) => this.moveActions.normalize(objectId, destination),
    }, this.moveActions)
    this.moveLanding = new MoveLandingCoordinator({
      createContext: session => this.createBehaviorContext(session),
      getSession: sessionId => this.sessionCoordinator.get(sessionId),
      cancel: (sessionId, reason) => this.cancel(sessionId, reason),
      end: session => this.endSession(session),
    })
    this.runtimeMove = RuntimeMoveCoordinator.fromPorts({
      getSession: sessionId => this.sessionCoordinator.get(sessionId),
      getBehavior: type => this.behaviors.get(type),
      createContext: sessionId => this.createBehaviorContext(this.sessionCoordinator.get(sessionId)!),
    }, this.moveCommit, this.moveLanding)
    this.visualState = new VisualStateCoordinator({ getAdapter: objectId => this.getObjectVisualAdapter(objectId) })
    this.visualMotion = new VisualMotionCoordinator({
      getSession: sessionId => this.sessionCoordinator.get(sessionId),
      getAdapter: objectId => this.getObjectVisualAdapter(objectId),
      createContext: (sessionId, destination, target) => this.createVisualLifecycleContext(sessionId, destination, target),
    }, this.visualProxyCoordinator)
    this.dispatcher = new RuntimeDispatcher({
      start: request => this.startInternal(request),
      update: (sessionId, input) => this.updateInternal(sessionId, input),
      release: (sessionId, input) => this.releaseInternal(sessionId, input),
      cancel: (sessionId, reason) => this.cancelInternal(sessionId, reason),
      interrupt: (sessionId, reason) => this.interruptInternal(sessionId, reason),
    })
    this.behaviors.register(this.moveBehavior)
    this.objects.subscribe(event => {
      this.events.emit(event)
      if (event.type === 'object-added' || event.type === 'object-changed') {
        this.syncObjectPointerBinding(event.id)
      }
      if (event.type === 'object-removed') {
        this.inputCoordinator.remove(event.id)
      }
    })
    this.surfaces.subscribe(event => this.events.emit(event))
    this.owner.subscribe(id => this.events.emit({ type: 'ownership-changed', id }))
  }

  registerVisualAdapter(type: string, adapter: VisualAdapter): void {
    this.registry.registerVisualAdapter(type, adapter)
  }

  registerVisualStrategy(type: string, strategy: MoveVisualStrategy): void {
    this.registry.registerVisualStrategy(type, strategy)
  }

  registerObjectType(type: string, registration: ObjectTypeRegistration): void {
    this.registry.registerObjectType(type, registration)
    for (const object of this.objects.values()) {
      if (object.type === type || object.visual === type) this.syncObjectPointerBinding(object.id)
    }
  }

  startObjectPointer(objectId: string, element: HTMLElement, event: PointerEvent): boolean {
    const object = this.objects.get(objectId)
    if (!object) return false
    const registration = this.registry.objectTypes.get(object.visual ?? object.type)
    if (!registration) return false
    if (object.element !== element) this.objects.setElement(objectId, element)
    const context = {
      objectId,
      element,
      event,
      mode: object.visualMode ?? registration.defaultVisualMode,
    }
    const createMove = registration.visual?.createMove ?? registration.createMove
    if (createMove) {
      const move = createMove(context)
      this.orchestrateMoveSession(
        move.request ?? {
          type: 'move',
          objectId,
          input: { kind: 'pointerdown', event },
        },
        {
          driver: move.driver,
          lifecycle: move.lifecycle,
          pointerInput: move.pointerInput,
          followElement: element,
        },
      )
    } else if (registration.visual?.legacyStart) {
      registration.visual.legacyStart(context)
    } else {
      registration.start?.(context)
    }
    return true
  }

  bindObjectPointer(objectId: string, element: HTMLElement): () => void {
    return this.inputCoordinator.bind(objectId, element)
  }

  private syncObjectPointerBinding(objectId: string): void {
    this.inputCoordinator.sync(objectId)
  }

  getVisualAdapter(type: string): VisualAdapter {
    return this.registry.visuals.get(type) ?? new DefaultVisualAdapter()
  }

  getObjectVisualAdapter(objectId: string): VisualAdapter {
    const object = this.objects.get(objectId)
    const registration = object ? this.registry.objectTypes.get(object.visual ?? object.type) : undefined
    if (registration?.visual) return registration.visual
    return this.getVisualAdapter(object?.visual ?? object?.type ?? '')
  }

  createVisualLifecycleContext(
    sessionId: string,
    destination?: unknown,
    targetElement?: HTMLElement,
    beforeContent?: HTMLElement,
  ): VisualLifecycleContext {
    const session = this.sessionCoordinator.get(sessionId)
    const object = session ? this.objects.get(session.objectId) : undefined
    const sourceElement = object?.element ?? undefined
    const adapter = session ? this.getObjectVisualAdapter(session.objectId) : new DefaultVisualAdapter()
    const fallback = new DefaultVisualAdapter()
    return {
      objectId: session?.objectId ?? '',
      sessionId,
      mode: object?.visualMode ?? 'detach',
      destination,
      sourceElement,
      beforeContent,
      targetElement,
      sourceRect: sourceElement?.getBoundingClientRect(),
      visualSnapshot: sourceElement
        ? (adapter.captureVisualState ?? fallback.captureVisualState)(sourceElement)
        : undefined,
      targetSnapshot: targetElement
        ? (adapter.captureVisualState ?? fallback.captureVisualState)(targetElement)
        : undefined,
    }
  }

  /** 由注册的 VisualAdapter 创建并登记当前 session 的唯一视觉代理。 */
  createVisualProxy(
    sessionId: string,
    context: VisualLifecycleContext,
  ): VisualProxy | undefined {
    return this.visualMotion.create(sessionId, context)
  }

  /** 调用当前对象适配器的 landing，并保证无代理时也有确定结果。 */
  async landVisualProxy(
    sessionId: string,
    target: HTMLElement,
    context?: VisualLifecycleContext,
  ): Promise<{ completed: boolean; reason?: string }> {
    return this.visualMotion.land(sessionId, target, context)
  }

  /** 将跟手或重定位更新转发给当前 session 的视觉适配器。 */
  updateVisualProxy(sessionId: string, context?: VisualLifecycleContext): void {
    this.visualMotion.update(sessionId, context)
  }

  /** 通过对象 VisualAdapter 解析最终揭示目标，并过滤已断开的节点。 */
  resolveVisualTarget(sessionId: string, destination: unknown): HTMLElement | null {
    const session = this.sessionCoordinator.get(sessionId)
    if (!session) return null
    return this.visualState.resolveTarget(session.objectId, destination)
  }

  /** 将对象的生命周期视觉状态交给其适配器写入。 */
  applyVisualState(objectId: string, element: HTMLElement, state: VisualState): void {
    this.visualState.apply(objectId, element, state)
  }

  /** 获取对象当前视觉快照；未覆盖时使用默认 DOM 样式快照。 */
  captureVisualState(objectId: string, element: HTMLElement) {
    return this.visualState.capture(objectId, element)
  }

  /** 调用当前对象适配器的 reveal；交接只允许由 Runtime 触发。 */
  async revealVisualProxy(
    sessionId: string,
    target: HTMLElement,
    context?: VisualLifecycleContext,
  ): Promise<void> {
    await this.visualMotion.reveal(sessionId, target, context)
  }

  registerVisualProxy(sessionId: string, proxy: VisualProxy): void {
    this.visualProxyCoordinator.register(sessionId, proxy)
  }

  getVisualProxy(sessionId: string): VisualProxy | undefined {
    return this.visualProxyCoordinator.get(sessionId)
  }

  disposeVisualProxy(sessionId: string): void {
    const proxy = this.visualProxyCoordinator.get(sessionId)
    if (!proxy) return
    const session = this.sessionCoordinator.get(sessionId)
    if (session) {
      const context = this.createVisualLifecycleContext(sessionId)
      this.getObjectVisualAdapter(session.objectId).dispose?.(proxy, context)
    }
    proxy.dispose?.()
    this.visualProxyCoordinator.remove(sessionId)
  }

  createCompletionGate<T>(sessionId: string, failureValue: T): RuntimeCompletionGate<T> {
    let settled = false
    let resolvePromise!: (value: T) => void
    const promise = new Promise<T>(resolve => { resolvePromise = resolve })
    const gate: RuntimeCompletionGate<T> = {
      promise,
      complete: value => {
        if (settled) return
        settled = true
        resolvePromise(value)
        this.sessionCoordinator.removeGate(sessionId, gate as SessionCompletionGate<unknown>)
      },
      fail: () => {
        if (settled) return
        settled = true
        resolvePromise(failureValue)
        this.sessionCoordinator.removeGate(sessionId, gate as SessionCompletionGate<unknown>)
      },
    }
    this.sessionCoordinator.addGate(sessionId, gate as SessionCompletionGate<unknown>)
    return gate
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

  resolveMoveTarget(
    sessionId: string,
    destination: unknown,
    fallback?: () => HTMLElement | null,
  ): HTMLElement | null {
    const session = this.sessionCoordinator.get(sessionId)
    if (!session) return null
    const context = this.createBehaviorContext(session)
    const target = context.visual?.resolveTarget?.(session.objectId, destination) ?? fallback?.() ?? null
    if (!target || !target.isConnected) return null
    this.moveBehavior.getContext(sessionId).transaction.target = target
    return target
  }

  registerRegrab(objectId: string, handler: (event: PointerEvent) => void): void {
    this.moveBehavior.registerRegrab(objectId, handler)
  }

  getRegrab(objectId: string): ((event: PointerEvent) => void) | undefined {
    return this.moveBehavior.getRegrab(objectId)
  }

  regrab(objectId: string, event: PointerEvent): boolean {
    const handler = this.moveBehavior.getRegrab(objectId)
    if (!handler) return false
    handler(event)
    return true
  }

  clearRegrab(objectId: string, handler?: (event: PointerEvent) => void): void {
    this.moveBehavior.clearRegrab(objectId, handler)
  }

  /** 将落地代理的 regrab 监听与当前 Session 清理绑定。 */
  bindRegrabTarget(
    sessionId: string,
    objectId: string,
    target: HTMLElement,
    handler: (event: PointerEvent) => void,
  ): void {
    const session = this.sessionCoordinator.get(sessionId)
    if (!session) return
    this.inputCoordinator.bindRegrabTarget(session, objectId, target, handler)
  }

  createRegrabContext(
    sessionId: string,
    event: PointerEvent,
    proxyElement: HTMLElement,
    sourceElement: HTMLElement,
  ): RegrabContext | null {
    const session = this.sessionCoordinator.get(sessionId)
    if (!session || session.state !== 'landing') return null
    return {
      sessionId,
      objectId: session.objectId,
      event,
      proxyElement,
      sourceElement,
      proxyRect: proxyElement.getBoundingClientRect(),
      interrupt: reason => this.interrupt(sessionId, reason ?? 'regrab'),
    }
  }

  /**
   * 绑定 active 阶段的全局 pointer 输入。pointerup 会先立即解绑监听器，再把
   * release 交回 Runtime；cancel/interrupt 时由 Session Cleanup 兜底。
   */
  bindPointerSessionInput(
    sessionId: string,
    options: PointerSessionInputOptions = {},
  ): () => void {
    const session = this.sessionCoordinator.get(sessionId)
    if (!session) return () => undefined
    return this.inputCoordinator.bindSession(session, options)
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
    const session = this.sessionCoordinator.get(sessionId)
    if (!session) return () => undefined
    return this.visualState.trackTarget(session.cleanup, target, retarget, options)
  }

  start(request: StartRequest): SessionHandle {
    return this.dispatcher.start(request)
  }

  private startInternal(request: StartRequest): SessionHandle {
    return this.runtimeMove.start(request, {
      getBehavior: type => this.behaviors.get(type),
      createSession: (type, objectId) => this.startSession(type, objectId),
      getVisualStrategy: objectId => {
        const object = this.objects.get(objectId)
        return object ? this.registry.visualStrategies.get(object.type) : undefined
      },
      bindLifecycle: (sessionId, strategy) => this.moveBehavior.bindLifecycle(sessionId, strategy),
      createContext: session => this.createBehaviorContext(session),
      isCurrent: sessionId => Boolean(this.sessionCoordinator.get(sessionId)),
      cancel: (sessionId, reason) => this.cancel(sessionId, reason),
      interrupt: (sessionId, reason) => this.interrupt(sessionId, reason),
    })
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
      const existing = this.sessionCoordinator.get(options.sessionId)
      if (!existing) throw new Error(`Session not found: ${options.sessionId}`)
      session = existing
    } else {
      const handle = this.start(request)
      session = this.sessionCoordinator.get(handle.id)!
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
    } else if (options.visualStrategy) {
      this.bindMoveLifecycle(session.id, options.visualStrategy)
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
    this.dispatcher.update(sessionId, input)
  }

  private updateInternal(sessionId: string, input: RuntimeInput): void {
    this.runtimeMove.update(sessionId, input)
  }

  async release(sessionId: string, input: RuntimeInput): Promise<void> {
    return this.dispatcher.release(sessionId, input)
  }

  private async releaseInternal(sessionId: string, input: RuntimeInput): Promise<void> {
    const sessionCandidate = this.sessionCoordinator.get(sessionId)
    const preflight = this.runtimeMove.prepareRelease(sessionCandidate, input)
    if (preflight.kind === 'ignore') return
    if (preflight.kind === 'cancel') {
      if (sessionCandidate) this.cancel(sessionCandidate.id, preflight.reason)
      return
    }
    const activeSession = preflight.session
    const session = activeSession

    const behavior = this.behaviors.get(activeSession.type)
    if (behavior instanceof MoveBehavior) {
      behavior.captureLayout(this.createBehaviorContext(activeSession))
    }
    let result: unknown
    try {
      result = await behavior?.release?.(this.createBehaviorContext(activeSession), input)
    } catch (error) {
      this.cancel(activeSession.id, error instanceof Error ? error.message : 'release-failed')
      return
    }

    if (this.sessionCoordinator.get(activeSession.id) !== activeSession) return

    const releaseResult = result as { accepted?: boolean; destination?: unknown } | undefined
    if (releaseResult?.accepted === false) {
      this.cancel(session.id, 'no-valid-drop')
      return
    }

    if (activeSession.state === 'release') activeSession.transition('landing')

    if (!(behavior instanceof MoveBehavior)) {
      this.endSession(activeSession)
      return
    }

    const destination = releaseResult?.destination
    if (destination === undefined) {
      this.cancel(activeSession.id, 'invalid-release-result')
      return
    }

    try {
      await this.runtimeMove.commit(session, behavior, destination)
    } catch (error) {
      this.cancel(session.id, error instanceof Error ? error.message : 'commit-failed')
      return
    }

    await this.runtimeMove.land(session, behavior, destination)
  }

  cancel(sessionId: string, reason = 'cancelled'): void {
    this.dispatcher.cancel(sessionId, reason)
  }

  private cancelInternal(sessionId: string, reason = 'cancelled'): void {
    const session = this.sessionCoordinator.get(sessionId)
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
        this.sessionCoordinator.cancel(session.id, current => this.failCompletionGates(current.id))
      } finally {
        this.disposeBehavior(behavior, context)
      }
    }
  }

  interrupt(sessionId: string, reason: string = 'cancel'): void {
    this.dispatcher.interrupt(sessionId, reason)
  }

  private interruptInternal(sessionId: string, reason: string = 'cancel'): void {
    const session = this.sessionCoordinator.get(sessionId)
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
        this.sessionCoordinator.interrupt(
          session.id,
          reason === 'regrab' ? 'regrab' : 'cancel',
          current => this.failCompletionGates(current.id),
        )
      } finally {
        this.disposeBehavior(behavior, context)
      }
    }
  }

  startSession(type: string, objectId = ''): Session {
    return this.sessionCoordinator.create(type, objectId, this.owner)
  }

  getSession(id: string): Session | undefined {
    return this.sessionCoordinator.get(id)
  }

  takeSurface(sessionId: string, surfaceId: string): boolean {
    const session = this.sessionCoordinator.get(sessionId)
    if (!session) return false
    session.takeSurface(surfaceId)
    return this.owner.isOwnedBy(surfaceId, sessionId)
  }

  /** 获取需要在 landing 前提前释放的对象 Lease（例如 detach 本体）。 */
  acquireObject(sessionId: string, objectId: string): Lease | null {
    return this.sessionCoordinator.acquireObject(sessionId, objectId)
  }

  /** 将 Surface placeholder 的销毁纳入当前移动事务清理。 */
  trackPlaceholder(sessionId: string, dispose: () => void): void {
    this.sessionCoordinator.track(sessionId, dispose)
  }

  takeSurfaces(sessionId: string, surfaceIds: readonly string[]): boolean {
    return surfaceIds.every(surfaceId => this.takeSurface(sessionId, surfaceId))
  }

  endSession(session: Session): void {
    const behavior = this.behaviors.get(session.type)
    const context = this.createBehaviorContext(session)
    this.runtimeSession.finalize(
      session,
      behavior,
      context,
      sessionId => this.disposeVisualProxy(sessionId),
      (currentBehavior, currentContext) => this.disposeBehavior(currentBehavior, currentContext),
    )
  }

  private failCompletionGates(sessionId: string): void {
    this.sessionCoordinator.failGates(sessionId)
    this.disposeVisualProxy(sessionId)
  }

  private disposeBehavior(behavior: Behavior | undefined, context: BehaviorContext): void {
    try {
      if (behavior instanceof MoveBehavior) {
        behavior.getLifecycle(context.session.id)?.surface?.dispose?.(context)
      }
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
      // 行为准备阶段仍使用可解析 DOM 的通用适配器；对象注册的 VisualAdapter
      // 通过 createVisualProxy/生命周期入口逐步接管视觉，不改变现有 demo 的
      // source 解析与拖拽起点。
      visual: item ? this.getVisualAdapter(item.visual ?? item.type) : undefined,
      hit: this.hitResolver,
    }
  }
}

export const runtime = new Runtime()
