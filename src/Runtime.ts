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
import type { MotionProfile } from './dom/MotionProfile'
import type { MotionControllerConfig } from './motion/MotionProfile'
import { FOLLOW_PROFILE, FOLLOW_ROTATION } from './motion/MotionProfile'
import { DEFAULT_RELEASE_PROFILE } from './motion/ReleaseMotion'
import type { HitResolver, HitResult } from './dom/Hit'
import { createRegisteredHitResolver } from './dom/RegisteredHit'
import type { Surface } from './surface/Surface'
import type { LandingTargetTrackerOptions } from './dom/LandingTargetTracker'
import type { PointerSessionInputOptions } from './input/PointerSessionInput'
import type { Action } from './action/Action'
import { RuntimeRegistry } from './runtime/RuntimeRegistry'
import { SessionCoordinator, type SessionCompletionGate } from './runtime/RuntimeSession'
import { MoveActionCoordinator } from './runtime/RuntimeMove'
import { VisualProxyCoordinator, VisualStateCoordinator, VisualMotionCoordinator } from './runtime/RuntimeVisual'
import { MoveCommitCoordinator, MoveLandingCoordinator } from './runtime/RuntimeMove'
import { RuntimeInputCoordinator, RuntimeDispatcher } from './runtime/RuntimeInput'
import { RuntimeMoveCoordinator, type MoveReleasePort } from './runtime/RuntimeMove'
import { setDefaultDraggingGlassEnabled } from './dom/Visual'
import { RuntimeSessionCoordinator } from './runtime/RuntimeSession'
import { setLayoutPresenceEnabled, setMotionProfiles } from './dom/GroupLayout'

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

/** 抓取时卡片跟指针的对齐方式，按对象类型注册（见 ObjectTypeRegistration.grabAlign）。 */
export interface GrabAlignConfig {
  /**
   * 基准对齐方式：
   * - 'center'（默认）：卡片几何中心对指针，不管实际点在卡片哪个位置。
   * - 'pointer'：保留实际点击位置在卡片里的相对偏移，点哪抓哪。
   */
  align?: 'center' | 'pointer'
  /** 在基准对齐结果上再叠加的水平偏移(px)，正值往右；默认 0。 */
  offsetX?: number
  /** 在基准对齐结果上再叠加的垂直偏移(px)，正值往下；默认 0。 */
  offsetY?: number
}

export interface ObjectTypeRegistration {
  defaultVisualMode: string
  /** 类型级视觉适配器；每个对象只复用这一份适配器定义。 */
  visual?: ObjectVisualAdapter
  /** 运动实现与参数；默认启用 Runtime MotionController。 */
  motion?: { enabled?: boolean; profile?: MotionProfile }
  /** 抓取对齐方式；不传就是纯几何中心对齐（等价于 { align: 'center' }）。 */
  grabAlign?: GrabAlignConfig
  /** 类型级 pointer 输入配置；业务无需自行绑定 pointer listener。 */
  pointerInput?: PointerSessionInputOptions
  /** 兼容旧 demo 的手动启动入口。 */
  start?(context: { objectId: string; element: HTMLElement; event: PointerEvent; mode: string }): void
  /** 新入口：Runtime 根据适配器自动创建并编排一次 Move Session。 */
  createMove?(context: {
    objectId: string
    element: HTMLElement
    event: PointerEvent
    mode: string
    fromRect?: DOMRect
  }): {
    request?: StartRequest
    driver?: MoveBehaviorDriver
    lifecycle?: MoveVisualLifecycle
    pointerInput?: PointerSessionInputOptions
  }
}

export interface ObjectVisualAdapter extends VisualAdapter {
  createMove?(context: {
    objectId: string
    element: HTMLElement
    event: PointerEvent
    mode: string
    fromRect?: DOMRect
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
  /** 代理当前屏幕位置配合真实节点的未变换布局尺寸，供新 session 接管。 */
  readonly regrabRect: DOMRect
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
      emit: action => this.actions.emitAsync(action),
    })
    this.moveCommit = new MoveCommitCoordinator({
      createContext: session => this.createBehaviorContext(session),
      getLifecycle: sessionId => this.moveBehavior.getLifecycle(sessionId),
      normalize: (objectId, destination) => this.moveActions.normalize(objectId, destination),
      getSurfaceObjectCount: surfaceId =>
        [...this.objects.values()].filter(item => item.surfaceId === surfaceId).length,
      getObjectIndex: (objectId, surfaceId) => this.getObjectSurfaceIndex(objectId, surfaceId),
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
setMotionProfiles(this.registry.motionProfile)
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

  registerSurface(surface: import('./surface/Surface').Surface): void {
    this.surfaces.register(surface)
  }

  configureMotion(config: {
    profile?: import('./dom/MotionProfile').MotionProfile
    controller?: MotionControllerConfig
  } & import('./dom/MotionProfile').MotionProfile): void {
    const { profile, controller, ...directProfile } = config
    const nextProfile = profile ?? (Object.keys(directProfile).length ? directProfile : undefined)
    if (nextProfile) this.registry.setMotionProfile(nextProfile)
    if (controller) {
      this.registry.setMotionController(controller)
      if (controller.follow) Object.assign(FOLLOW_PROFILE.position, controller.follow)
      if (controller.rotation) Object.assign(FOLLOW_ROTATION, controller.rotation)
      if (controller.release) Object.assign(DEFAULT_RELEASE_PROFILE, controller.release)
    }
    setMotionProfiles(this.registry.motionProfile)
  }

  /** 配置 Runtime 默认代理视觉；业务也可以完全关闭并由 VisualAdapter 自行绘制。 */
  configureVisual(config: { dragGlass?: boolean; layoutPresence?: boolean }): void {
    if (config.dragGlass !== undefined) setDefaultDraggingGlassEnabled(config.dragGlass)
    if (config.layoutPresence !== undefined) setLayoutPresenceEnabled(config.layoutPresence)
  }

  getMotionProfile(): import('./dom/MotionProfile').MotionProfile | null {
    return this.registry.motionProfile
  }

  startObjectPointer(objectId: string, element: HTMLElement, event: PointerEvent, fromRect?: DOMRect, returnRect?: DOMRect): boolean {
    // 对象当前已经登记了 regrab handler（悬空 landing 中的代理正等着被再次抓起）时，
    // 直接转发给它，不重新走一遍完整的 move 编排——避免代理与实体元素上的
    // pointerdown 在极端时序下重复触发两条 Session。
    const activeRegrab = this.getRegrab(objectId)
    if (activeRegrab) {
      activeRegrab(event)
      return true
    }
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
      fromRect,
      returnRect,
    }
    // 优先用户自定义 createMove，没有则用 DefaultVisualAdapter 的内置 createMove
    const userCreateMove = registration.visual?.createMove ?? registration.createMove
    const defaultCreateMove = () => {
      const adapter = this.defaultVisualAdapter
      const move = adapter.createMove(context)
      return move
    }
    const createMove = userCreateMove ?? defaultCreateMove
    if (createMove) {
      const move = createMove(context)
      if (!move.driver && !move.lifecycle) {
        // createMove 返回空对象（无能力 / 非 detach 模式），fallback 到 start
        registration.start?.(context)
        return true
      }
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
          // 默认 detach driver 已由 MotionController 接管跟手；这里再把业务
          // 本体设为 followElement 会在同一 pointermove 写两次 left/top。
          // 跟手节点应由 Runtime visual driver 自行指定，业务 DOM 不参与。
          followElement: null,
        },
      )
      return true
    }
    return false
  }

  bindObjectPointer(objectId: string, element: HTMLElement): () => void {
    return this.inputCoordinator.bind(objectId, element)
  }

  private syncObjectPointerBinding(objectId: string): void {
    this.inputCoordinator.sync(objectId)
  }

  private defaultVisualAdapter = new DefaultVisualAdapter(this)

  getVisualAdapter(type: string): VisualAdapter {
    return this.registry.visuals.get(type) ?? this.defaultVisualAdapter
  }

  /** 按对象类型读取抓取对齐配置；未注册的类型返回 undefined，调用方按纯居中兜底。 */
  getObjectGrabAlign(objectId: string): GrabAlignConfig | undefined {
    const object = this.objects.get(objectId)
    const registration = object ? this.registry.objectTypes.get(object.visual ?? object.type) : undefined
    return registration?.grabAlign
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
    const adapter = session ? this.getObjectVisualAdapter(session.objectId) : this.defaultVisualAdapter
    const fallback = new DefaultVisualAdapter()
    const registration = object ? this.registry.objectTypes.get(object.visual ?? object.type) : undefined
    const registeredProfile = registration?.motion?.profile
    const globalProfile = this.registry.motionProfile
    const motionProfile: MotionProfile | undefined = registeredProfile || globalProfile
      ? {
          ...globalProfile,
          ...registeredProfile,
          flip: { ...globalProfile?.flip, ...registeredProfile?.flip },
          resize: { ...globalProfile?.resize, ...registeredProfile?.resize },
          landing: { ...globalProfile?.landing, ...registeredProfile?.landing },
          group: { ...globalProfile?.group, ...registeredProfile?.group },
        } as MotionProfile
      : undefined
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
      motion: motionProfile,
      motionEnabled: registration?.motion?.enabled,
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
    // 代理替换必须经过 Runtime 的统一销毁边界，不能让协调器直接调用
    // proxy.dispose() 绕过当前对象的 VisualAdapter。
    if (this.visualProxyCoordinator.get(sessionId)) this.disposeVisualProxy(sessionId)
    this.visualProxyCoordinator.register(sessionId, proxy)
  }

  getVisualProxy(sessionId: string): VisualProxy | undefined {
    return this.visualProxyCoordinator.get(sessionId)
  }

  disposeVisualProxy(sessionId: string): void {
    const proxy = this.visualProxyCoordinator.get(sessionId)
    if (!proxy) return
    const session = this.sessionCoordinator.get(sessionId)
    let adapterDisposed = false
    if (session) {
      const context = this.createVisualLifecycleContext(sessionId)
      const adapter = this.getObjectVisualAdapter(session.objectId)
      if (adapter.dispose) {
        adapter.dispose(proxy, context)
        adapterDisposed = true
      }
    }
    // dispose 若由 VisualAdapter 提供，则由 adapter 负责完整销毁代理。
    // Runtime 只在没有 adapter 实现时调用 proxy 自身的兜底 dispose，避免
    // DefaultVisualAdapter/custom adapter 与 Runtime 重复清理同一个节点。
    if (!adapterDisposed) proxy.dispose?.()
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

  /** 默认命中由已注册 Object/Surface 推导；特殊几何才需 setHitResolver()。 */
  createRegisteredHitResolver(objectId: string): HitResolver<Surface, HTMLElement> {
    return createRegisteredHitResolver(this.objects, this.surfaces, objectId)
  }

  /** 将自定义或注册表默认命中统一归一成业务无关的 Surface id 与插入索引。 */
  resolveMoveHit(objectId: string, x: number, y: number): HitResult | null {
    if (this.hitResolver) {
      const surface = this.hitResolver.findSurface({ x, y })
      if (!surface?.dataset.column) return null
      return {
        columnId: surface.dataset.column,
        index: this.hitResolver.findIndex(surface, { x, y }, objectId),
      }
    }
    const resolver = this.createRegisteredHitResolver(objectId)
    const surface = resolver.findSurface({ x, y })
    if (!surface) return null
    return { columnId: surface.id, index: resolver.findIndex(surface, { x, y }, objectId) }
  }

  /** 自动滚动只需要当前命中 Surface 的真实滚动元素。 */
  resolveMoveSurfaceElement(objectId: string, x: number, y: number): HTMLElement | null {
    if (this.hitResolver) return this.hitResolver.findSurface({ x, y })
    const surface = this.createRegisteredHitResolver(objectId).findSurface({ x, y })
    return surface?.viewport?.() ?? surface?.element ?? null
  }

  /** 取得指定 Surface 的滚动视口，不让视觉 driver 探查业务 DOM 结构。 */
  resolveMoveSurfaceViewport(surfaceId: string): HTMLElement | null {
    const surface = this.surfaces.get(surfaceId)
    return surface?.viewport?.() ?? surface?.element ?? null
  }

  /** 已注册对象按屏幕布局排序后的索引，不依赖业务 DOM 的 data 属性。 */
  getObjectSurfaceIndex(objectId: string, surfaceId?: string): number {
    const object = this.objects.get(objectId)
    const ownerSurface = surfaceId ?? object?.surfaceId
    if (!object || !ownerSurface) return -1
    return [...this.objects.values()]
      .filter(item => item.surfaceId === ownerSurface)
      .map(item => item.id)
      .sort((leftId, rightId) => {
        const left = this.objects.get(leftId)?.element?.getBoundingClientRect()
        const right = this.objects.get(rightId)?.element?.getBoundingClientRect()
        if (!left || !right) return 0
        return left.top - right.top || left.left - right.left
      })
      .indexOf(objectId)
  }

  subscribe(listener: (event: RuntimeEvent) => void): () => void {
    return this.events.subscribe(listener)
  }

  onAction(listener: (action: Action) => void | Promise<void>): () => void {
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
    const resolveResult = context.visual?.resolveTarget?.(session.objectId, destination)
    const fallbackResult = fallback?.()
    const registeredElement = this.objects.get(session.objectId)?.element
    const target = resolveResult ?? fallbackResult ?? registeredElement ?? null
    if (!target || !target.isConnected) return null
    this.moveBehavior.getContext(sessionId).transaction.target = target
    return target
  }

  /**
   * 统一取得 landing 交接目标：先尝试当前帧的同步目标，再等待业务 Action
   * 触发的 DOM 重渲染。视觉 adapter 不需要再组合这两个阶段，也不会各自
   * 实现一套跨 Surface 的等待规则。
   */
  async resolveLandingTarget(
    sessionId: string,
    destination: unknown,
    maxFrames = 6,
  ): Promise<HTMLElement | null> {
    const immediate = this.resolveMoveTarget(sessionId, destination)
    return immediate ?? this.waitForMoveTarget(sessionId, destination, maxFrames)
  }

  /**
   * 等待 Action 引起的业务 DOM 重渲染并取得落地目标。
   *
   * 跨 Surface 时框架通常会先更新对象所属 Surface，再在随后一两帧销毁旧
   * 组件、登记新组件。不能把仍是源节点的 hidden element 当成 target；同
   * Surface 放回则允许复用原业务节点。业务 adapter 不需要自行轮询 DOM。
   */
  async waitForMoveTarget(sessionId: string, destination: unknown, maxFrames = 6): Promise<HTMLElement | null> {
    const session = this.sessionCoordinator.get(sessionId)
    if (!session) return null
    const moveContext = this.moveBehavior.getContext(sessionId)
    const source = moveContext.sourceElement
    const expectedSurface = this.getDestinationSurfaceId(destination)
    const transactionDestination = moveContext.transaction.destination as Partial<import('./behavior/MoveTransaction').MoveActionDestination> | null
    const sourceSurface = typeof transactionDestination?.fromSurfaceId === 'string'
      ? transactionDestination.fromSurfaceId
      : null
    const crossSurface = !!expectedSurface && expectedSurface !== sourceSurface
    for (let frame = 0; frame < maxFrames; frame += 1) {
      const current = this.sessionCoordinator.get(sessionId)
      if (current !== session || current.state === 'disposed' || current.state === 'interrupt') return null
      const object = this.objects.get(session.objectId)
      const target = this.resolveMoveTarget(sessionId, destination)
      const surfaceReady = !expectedSurface || object?.surfaceId === expectedSurface
      // 同列放回：target 就是业务节点的最终落点（原地放回时 DOM 不动、
      // target === source；换位时 Vue 复用实例则 target 仍是同一节点但
      // rect 已随业务 patch 更新到新位置）——只要节点有效即可放行，
      // 不能要求 target !== source（复用实例时永远相等）。
      // 跨列：Vue 用 :key 复用时组件实例不会重挂载，source 节点会被直接
      // 复用为 target（仍是同一个节点），此时不能以 surfaceId 判完成——
      // watchEffect(flush:'pre') 在 Vue DOM patch 前就更新 surfaceId，
      // rect 还是旧列位置。要用 DOM 级信号：目标 Surface 容器已包含
      // target，说明 Vue 已把节点 patch 到新列文档流。
      const movedToSurface = !!expectedSurface && !!target
        ? (this.surfaces.get(expectedSurface)?.element?.contains(target) ?? false)
        : false
      const moved = crossSurface ? movedToSurface : true
      if (target && surfaceReady && moved) return target
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    }
    return null
  }

  private getDestinationSurfaceId(destination: unknown): string | null {
    if (!destination || typeof destination !== 'object') return null
    const candidate = destination as { toSurfaceId?: unknown; columnId?: unknown }
    if (typeof candidate.toSurfaceId === 'string') return candidate.toSurfaceId
    return typeof candidate.columnId === 'string' ? candidate.columnId : null
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
    const proxyRect = proxyElement.getBoundingClientRect()
    const sourceRect = sourceElement.getBoundingClientRect()
    const layoutWidth = sourceElement.offsetWidth || sourceRect.width
    const layoutHeight = sourceElement.offsetHeight || sourceRect.height
    const regrabRect = new DOMRect(proxyRect.left, proxyRect.top, layoutWidth, layoutHeight)
    return {
      sessionId,
      objectId: session.objectId,
      event,
      proxyElement,
      sourceElement,
      proxyRect,
      regrabRect,
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
      if (options.driver) this.moveBehavior.setDriver(options.driver)
      const handle = this.start(request)
      if (options.driver) this.moveBehavior.setDriver({})
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
    const port: MoveReleasePort = {
      getSession: id => this.sessionCoordinator.get(id),
      getBehavior: type => this.behaviors.get(type),
      createContext: session => this.createBehaviorContext(session),
      cancel: (id, reason) => this.cancel(id, reason),
      end: session => this.endSession(session),
    }
    return this.runtimeMove.release(sessionId, input, port)
  }

  cancel(sessionId: string, reason = 'cancelled'): void {
    this.dispatcher.cancel(sessionId, reason)
  }

  private cancelInternal(sessionId: string, reason = 'cancelled'): void {
    const session = this.sessionCoordinator.get(sessionId)
    if (!session) return
    const behavior = this.behaviors.get(session.type)
    const context = this.createBehaviorContext(session)

    this.runtimeSession.terminate(
        session,
        behavior,
        context,
        reason,
        'cancel',
        (currentBehavior, currentContext, currentReason) => {
          if (currentBehavior instanceof MoveBehavior) currentBehavior.cancelLayout(currentContext, currentReason)
          currentBehavior?.cancel?.(currentContext, currentReason)
        },
        current => this.failCompletionGates(current.id),
        (currentBehavior, currentContext) => this.disposeBehavior(currentBehavior, currentContext),
    )
  }

  interrupt(sessionId: string, reason: string = 'cancel'): void {
    this.dispatcher.interrupt(sessionId, reason)
  }

  private interruptInternal(sessionId: string, reason: string = 'cancel'): void {
    const session = this.sessionCoordinator.get(sessionId)
    if (!session) return
    const behavior = this.behaviors.get(session.type)
    const context = this.createBehaviorContext(session)

    this.runtimeSession.terminate(
        session,
        behavior,
        context,
        reason,
        'interrupt',
        (currentBehavior, currentContext, currentReason) => {
          if (currentBehavior instanceof MoveBehavior) currentBehavior.cancelLayout(currentContext, currentReason)
          currentBehavior?.interrupt?.(currentContext, currentReason)
        },
        current => this.failCompletionGates(current.id),
        (currentBehavior, currentContext) => this.disposeBehavior(currentBehavior, currentContext),
    )
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
