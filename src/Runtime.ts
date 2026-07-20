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
import type { Action } from './action/Action'

export type RuntimeEvent =
  | { type: 'object-added' | 'object-removed' | 'object-changed'; id: string }
  | { type: 'surface-added' | 'surface-removed' | 'surface-changed'; id: string }
  | { type: 'ownership-changed'; id: string }

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

    try {
      const landingResult = await behavior.landing(this.createBehaviorContext(session), destination)
      const liveSession = this.sessions.get(session.id)
      if (liveSession !== session) return
      if (liveSession.state === 'disposed' || liveSession.state === 'interrupt') return
      if (landingResult && !landingResult.completed) {
        this.cancel(session.id, landingResult.reason ?? 'landing-failed')
        return
      }
      if (behavior.reveal) await behavior.reveal(this.createBehaviorContext(session), destination)
      if (this.sessions.get(session.id) !== session) return
      this.endSession(session)
    } catch (error) {
      if (this.sessions.get(session.id) === session) {
        this.cancel(session.id, error instanceof Error ? error.message : 'landing-failed')
      }
    }
  }

  cancel(sessionId: string, reason = 'cancelled'): void {
    const session = this.sessions.get(sessionId)
    if (!session) return
    const behavior = this.behaviors.get(session.type)
    const context = this.createBehaviorContext(session)

    try {
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

  interrupt(sessionId: string, reason = 'interrupted'): void {
    const session = this.sessions.get(sessionId)
    if (!session) return
    const behavior = this.behaviors.get(session.type)
    const context = this.createBehaviorContext(session)

    try {
      behavior?.interrupt?.(context, reason)
    } catch (error) {
      console.error('Behavior interrupt failed', error)
    } finally {
      try {
        session.interrupt()
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
