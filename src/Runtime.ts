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
import { DefaultVisualAdapter, VisualAdapters, type VisualAdapter, type VisualLifecycleContext, type VisualProxy } from './dom/VisualAdapter'
import type { VisualState } from './dom/VisualAdapterTypes'
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
  readonly visuals = new VisualAdapters()
  private readonly moveBehavior: MoveBehavior
  private hitResolver: HitResolver | null = null
  private sessions = new Map<string, Session>()
  private readonly events = new Emitter<RuntimeEvent>()
  private readonly actions = new Emitter<Action>()
  private readonly visualStrategies = new Map<string, MoveVisualStrategy>()
  private readonly objectTypes = new Map<string, ObjectTypeRegistration>()
  private readonly objectPointerBindings = new WeakMap<HTMLElement, () => void>()
  private readonly objectPointerDisposers = new Map<string, () => void>()
  private readonly completionGates = new Map<string, Set<RuntimeCompletionGate<unknown>>>()
  private readonly visualProxies = new Map<string, VisualProxy>()

  constructor() {
    this.moveBehavior = new MoveBehavior()
    this.behaviors.register(this.moveBehavior)
    this.objects.subscribe(event => {
      this.events.emit(event)
      if (event.type === 'object-added' || event.type === 'object-changed') {
        this.syncObjectPointerBinding(event.id)
      }
      if (event.type === 'object-removed') {
        this.objectPointerDisposers.get(event.id)?.()
        this.objectPointerDisposers.delete(event.id)
      }
    })
    this.surfaces.subscribe(event => this.events.emit(event))
    this.owner.subscribe(id => this.events.emit({ type: 'ownership-changed', id }))
  }

  registerVisualAdapter(type: string, adapter: VisualAdapter): void {
    this.visuals.register(type, adapter)
  }

  registerVisualStrategy(type: string, strategy: MoveVisualStrategy): void {
    this.visualStrategies.set(type, strategy)
  }

  registerObjectType(type: string, registration: ObjectTypeRegistration): void {
    this.objectTypes.set(type, registration)
    if (registration.visual) this.visuals.register(type, registration.visual)
    for (const object of this.objects.values()) {
      if (object.type === type || object.visual === type) this.syncObjectPointerBinding(object.id)
    }
  }

  startObjectPointer(objectId: string, element: HTMLElement, event: PointerEvent): boolean {
    const object = this.objects.get(objectId)
    if (!object) return false
    const registration = this.objectTypes.get(object.visual ?? object.type)
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
    const previous = this.objectPointerBindings.get(element)
    previous?.()
    const listener = (event: Event) => {
      if (event instanceof PointerEvent) this.startObjectPointer(objectId, element, event)
    }
    element.addEventListener('pointerdown', listener)
    const dispose = () => element.removeEventListener('pointerdown', listener)
    this.objectPointerBindings.set(element, dispose)
    return dispose
  }

  private syncObjectPointerBinding(objectId: string): void {
    const object = this.objects.get(objectId)
    this.objectPointerDisposers.get(objectId)?.()
    this.objectPointerDisposers.delete(objectId)
    if (!object?.element || !this.objectTypes.has(object.visual ?? object.type)) return
    const dispose = this.bindObjectPointer(objectId, object.element)
    this.objectPointerDisposers.set(objectId, dispose)
  }

  getVisualAdapter(type: string): VisualAdapter {
    return this.visuals.get(type) ?? new DefaultVisualAdapter()
  }

  getObjectVisualAdapter(objectId: string): VisualAdapter {
    const object = this.objects.get(objectId)
    const registration = object ? this.objectTypes.get(object.visual ?? object.type) : undefined
    if (registration?.visual) return registration.visual
    return this.getVisualAdapter(object?.visual ?? object?.type ?? '')
  }

  createVisualLifecycleContext(
    sessionId: string,
    destination?: unknown,
    targetElement?: HTMLElement,
    beforeContent?: HTMLElement,
  ): VisualLifecycleContext {
    const session = this.sessions.get(sessionId)
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
    const session = this.sessions.get(sessionId)
    if (!session) return undefined
    const proxy = this.getObjectVisualAdapter(session.objectId).createProxy?.(context)
    if (!proxy) return undefined
    this.registerVisualProxy(sessionId, proxy)
    return proxy
  }

  /** 调用当前对象适配器的 landing，并保证无代理时也有确定结果。 */
  async landVisualProxy(
    sessionId: string,
    target: HTMLElement,
    context?: VisualLifecycleContext,
  ): Promise<{ completed: boolean; reason?: string }> {
    const session = this.sessions.get(sessionId)
    const proxy = this.visualProxies.get(sessionId)
    if (!session || !proxy) return { completed: false, reason: 'visual-proxy-missing' }
    const lifecycleContext = context ?? this.createVisualLifecycleContext(sessionId, undefined, target)
    const result = await this.getObjectVisualAdapter(session.objectId).land?.(proxy, target, lifecycleContext)
    return result ?? { completed: true }
  }

  /** 将跟手或重定位更新转发给当前 session 的视觉适配器。 */
  updateVisualProxy(sessionId: string, context?: VisualLifecycleContext): void {
    const session = this.sessions.get(sessionId)
    const proxy = this.visualProxies.get(sessionId)
    if (!session || !proxy) return
    const lifecycleContext = context ?? this.createVisualLifecycleContext(sessionId)
    this.getObjectVisualAdapter(session.objectId).updateProxy?.(proxy, lifecycleContext)
  }

  /** 通过对象 VisualAdapter 解析最终揭示目标，并过滤已断开的节点。 */
  resolveVisualTarget(sessionId: string, destination: unknown): HTMLElement | null {
    const session = this.sessions.get(sessionId)
    if (!session) return null
    const adapter = this.getObjectVisualAdapter(session.objectId)
    const target = adapter.resolveTarget?.(session.objectId, destination)
      ?? new DefaultVisualAdapter().resolveTarget(session.objectId)
    return target?.isConnected ? target : null
  }

  /** 将对象的生命周期视觉状态交给其适配器写入。 */
  applyVisualState(objectId: string, element: HTMLElement, state: VisualState): void {
    const adapter = this.getObjectVisualAdapter(objectId)
    ;(adapter.applyState ?? new DefaultVisualAdapter().applyState)(element, state)
  }

  /** 获取对象当前视觉快照；未覆盖时使用默认 DOM 样式快照。 */
  captureVisualState(objectId: string, element: HTMLElement) {
    const adapter = this.getObjectVisualAdapter(objectId)
    return (adapter.captureVisualState ?? new DefaultVisualAdapter().captureVisualState)(element)
  }

  /** 调用当前对象适配器的 reveal；交接只允许由 Runtime 触发。 */
  async revealVisualProxy(
    sessionId: string,
    target: HTMLElement,
    context?: VisualLifecycleContext,
  ): Promise<void> {
    const session = this.sessions.get(sessionId)
    const proxy = this.visualProxies.get(sessionId)
    if (!session || !proxy) return
    const lifecycleContext = context ?? this.createVisualLifecycleContext(sessionId, undefined, target)
    await this.getObjectVisualAdapter(session.objectId).reveal?.(proxy, target, lifecycleContext)
  }

  registerVisualProxy(sessionId: string, proxy: VisualProxy): void {
    this.visualProxies.get(sessionId)?.dispose?.()
    this.visualProxies.set(sessionId, proxy)
  }

  getVisualProxy(sessionId: string): VisualProxy | undefined {
    return this.visualProxies.get(sessionId)
  }

  disposeVisualProxy(sessionId: string): void {
    const proxy = this.visualProxies.get(sessionId)
    if (!proxy) return
    const session = this.sessions.get(sessionId)
    if (session) {
      const context = this.createVisualLifecycleContext(sessionId)
      this.getObjectVisualAdapter(session.objectId).dispose?.(proxy, context)
    }
    proxy.dispose?.()
    this.visualProxies.delete(sessionId)
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
        this.completionGates.get(sessionId)?.delete(gate as RuntimeCompletionGate<unknown>)
      },
      fail: () => {
        if (settled) return
        settled = true
        resolvePromise(failureValue)
        this.completionGates.get(sessionId)?.delete(gate as RuntimeCompletionGate<unknown>)
      },
    }
    const gates = this.completionGates.get(sessionId) ?? new Set<RuntimeCompletionGate<unknown>>()
    gates.add(gate as RuntimeCompletionGate<unknown>)
    this.completionGates.set(sessionId, gates)
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
    const session = this.sessions.get(sessionId)
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
    const session = this.sessions.get(sessionId)
    if (!session) return
    this.registerRegrab(objectId, handler)
    const listener = (event: Event) => {
      if (event instanceof PointerEvent) this.regrab(objectId, event)
    }
    target.addEventListener('pointerdown', listener)
    session.cleanup.trackTargetListener(target, 'pointerdown', listener)
  }

  createRegrabContext(
    sessionId: string,
    event: PointerEvent,
    proxyElement: HTMLElement,
    sourceElement: HTMLElement,
  ): RegrabContext | null {
    const session = this.sessions.get(sessionId)
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
    const object = this.objects.get(request.objectId)
    const strategy = object ? this.visualStrategies.get(object.type) : undefined
    if (strategy) this.moveBehavior.bindLifecycle(session.id, strategy)
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
    const session = this.sessions.get(sessionId)
    if (!session || session.state !== 'active') return
    this.behaviors.get(session.type)?.update?.(this.createBehaviorContext(session), input)
  }

  async release(sessionId: string, input: RuntimeInput): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) return
    if (input.kind === 'pointercancel' || input.kind === 'blur' || input.kind === 'lostpointercapture') {
      this.cancel(session.id, input.kind)
      return
    }
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
    const lifecycle = this.moveBehavior.getLifecycle(session.id)
    const normalizedDestination = this.normalizeMoveDestination(session.objectId, destination)
    if (normalizedDestination) {
      await lifecycle?.surface?.leave?.(
        this.createBehaviorContext(session),
        normalizedDestination.fromSurfaceId,
      )
    }
    if (moveContext && this.emitMoveAction(session.objectId, moveContext.destination, moveContext.transaction)) {
      // Action 已由 Runtime 统一发出；视觉 driver 的 commit 仍负责布局和样式，
      // 但不再需要重复提交业务动作。
    }
    if (normalizedDestination) {
      await lifecycle?.surface?.enter?.(
        this.createBehaviorContext(session),
        normalizedDestination.toSurfaceId,
      )
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
      landingResult?.reveal?.()
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
    if (transaction.actionEmitted) return false
    const normalized = this.normalizeMoveDestination(objectId, destination)
    if (!normalized) return false
    const action: Action = {
      type: 'move',
      objectId,
      fromSurfaceId: normalized.fromSurfaceId,
      toSurfaceId: normalized.toSurfaceId,
      ...(normalized.toIndex === undefined ? {} : { toIndex: normalized.toIndex }),
      timestamp: Date.now(),
    }
    transaction.actionEmitted = true
    this.actions.emit(action)
    return true
  }

  private normalizeMoveDestination(objectId: string, value: unknown): MoveActionDestination | null {
    if (isMoveActionDestination(value)) return value
    if (!value || typeof value !== 'object') return null
    const candidate = value as { columnId?: unknown; index?: unknown }
    if (typeof candidate.columnId !== 'string') return null
    const fromSurfaceId = this.objects.get(objectId)?.surfaceId
    if (!fromSurfaceId) return null
    return {
      fromSurfaceId,
      toSurfaceId: candidate.columnId.startsWith('column:')
        ? candidate.columnId
        : `column:${candidate.columnId}`,
      ...(typeof candidate.index === 'number' ? { toIndex: candidate.index } : {}),
    }
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
      this.failCompletionGates(session.id)
      this.disposeVisualProxy(session.id)
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
      this.failCompletionGates(session.id)
      this.disposeVisualProxy(session.id)
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

  takeSurface(sessionId: string, surfaceId: string): boolean {
    const session = this.sessions.get(sessionId)
    if (!session) return false
    session.takeSurface(surfaceId)
    return this.owner.isOwnedBy(surfaceId, sessionId)
  }

  /** 获取需要在 landing 前提前释放的对象 Lease（例如 detach 本体）。 */
  acquireObject(sessionId: string, objectId: string): Lease | null {
    const session = this.sessions.get(sessionId)
    if (!session) return null
    return this.owner.takeObject(objectId, sessionId)
  }

  /** 将 Surface placeholder 的销毁纳入当前移动事务清理。 */
  trackPlaceholder(sessionId: string, dispose: () => void): void {
    const session = this.sessions.get(sessionId)
    if (!session) return
    session.cleanup.track(dispose)
  }

  takeSurfaces(sessionId: string, surfaceIds: readonly string[]): boolean {
    return surfaceIds.every(surfaceId => this.takeSurface(sessionId, surfaceId))
  }

  endSession(session: Session): void {
    const behavior = this.behaviors.get(session.type)
    const context = this.createBehaviorContext(session)
    try {
      session.dispose()
    } finally {
      this.failCompletionGates(session.id)
      this.disposeVisualProxy(session.id)
      this.disposeBehavior(behavior, context)
      this.sessions.delete(session.id)
    }
  }

  private failCompletionGates(sessionId: string): void {
    const gates = this.completionGates.get(sessionId)
    if (!gates) return
    for (const gate of [...gates]) gate.fail()
    this.completionGates.delete(sessionId)
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

function isMoveActionDestination(value: unknown): value is MoveActionDestination {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<MoveActionDestination>
  return typeof candidate.fromSurfaceId === 'string'
    && typeof candidate.toSurfaceId === 'string'
    && (candidate.toIndex === undefined || typeof candidate.toIndex === 'number')
}
