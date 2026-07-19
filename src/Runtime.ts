import { Owner } from './owner/Owner'
import { Session } from './session/Session'
import { ObjectStore } from './object/ObjectStore'
import { SurfaceStore } from './surface/SurfaceStore'
import { Emitter } from './core/Emitter'
import type { RuntimeInput, SessionHandle, StartRequest } from './core/Interaction'
import type { Behavior } from './behavior/Behavior'
import { BehaviorStore } from './behavior/BehaviorStore'
import { MoveBehavior, type MoveBehaviorDriver, type MoveContext, type MoveVisualLifecycle } from './behavior/MoveBehavior'
import { DefaultVisualAdapter, VisualAdapters, type VisualAdapter } from './dom/VisualAdapter'
import type { HitResolver } from './dom/Hit'
import type { Action } from './action/Action'

export type RuntimeEvent =
  | { type: 'object-added' | 'object-removed' | 'object-changed'; id: string }
  | { type: 'surface-added' | 'surface-removed' | 'surface-changed'; id: string }
  | { type: 'ownership-changed'; id: string }

/**
 * Runtime 只组织其余模块，不写具体项目逻辑——具体的拖拽流程（Hit test、
 * 生成 Action）由业务侧的 dragSession 之类的编排函数调用 Runtime 提供的
 * 原语来完成，见 src/demo/kanbanDrag.ts。
 */
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

  /** 阶段 B：sourceElement/dragOffset 现在由 MoveBehavior.prepare() 统一算好，
   * driver 读这里，不用各自重新计算一遍。 */
  getMoveContext(sessionId: string): MoveContext {
    return this.moveBehavior.getContext(sessionId)
  }

  /** 阶段 E：落地飞行期间的 regrab 登记表，从 demo 模块作用域收到这里。 */
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
    const runtime = this
    const context = this.createBehaviorContext(session)
    Promise.resolve(behavior.prepare?.(context, request)).catch(error => {
      if (runtime.sessions.has(session.id)) {
        runtime.cancel(session.id, error instanceof Error ? error.message : 'prepare-failed')
      }
    })
    return {
      id: session.id,
      get state() { return session.state },
      cancel: reason => {
        behavior.cancel?.(context, reason ?? 'cancelled')
        session.cancel()
        runtime.sessions.delete(session.id)
      },
      interrupt: reason => {
        behavior.interrupt?.(context, reason ?? 'interrupted')
        session.interrupt()
        runtime.sessions.delete(session.id)
      },
    }
  }

  update(sessionId: string, input: RuntimeInput): void {
    const session = this.sessions.get(sessionId)
    if (!session) return
    this.behaviors.get(session.type)?.update?.(this.createBehaviorContext(session), input)
  }

  async release(sessionId: string, input: RuntimeInput): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) return
    if (session.state === 'active') session.transition('release')
    let result: unknown
    try {
      result = await this.behaviors.get(session.type)?.release?.(this.createBehaviorContext(session), input)
    } catch (error) {
      this.cancel(session.id, error instanceof Error ? error.message : 'release-failed')
      return
    }
    const releaseResult = result as { accepted?: boolean; destination?: unknown } | undefined
    if (releaseResult?.accepted === false) {
      this.cancel(session.id, 'no-valid-drop')
      return
    }
    // driver 可以兼容旧的本地 landing 编排；如果它没有推进状态，Runtime
    // 在 release 完成后统一收口到 landing，避免状态机长期停在 release。
    if (session.state === 'release') session.transition('landing')
    const destination = releaseResult?.destination
    const behavior = this.behaviors.get(session.type)
    if (behavior instanceof MoveBehavior && destination !== undefined) {
      const landingResult = await behavior.landing(this.createBehaviorContext(session), destination)
      if (this.sessions.get(session.id) !== session || session.state === 'disposed' || session.state === 'interrupt') return
      if (landingResult && !landingResult.completed) {
        this.cancel(session.id, landingResult.reason ?? 'landing-failed')
        return
      }
      if (behavior.reveal) await behavior.reveal(this.createBehaviorContext(session), destination)
      if (this.sessions.get(session.id) !== session) return
      this.endSession(session)
    }
  }

  cancel(sessionId: string, reason = 'cancelled'): void {
    const session = this.sessions.get(sessionId)
    if (!session) return
    const behavior = this.behaviors.get(session.type)
    behavior?.cancel?.(this.createBehaviorContext(session), reason)
    // 不能直接调 session.dispose()（即 endSession）：dispose() 假定状态已经
    // 是 done/cancelled/interrupt 之一，从 active/release/landing 这些正常
    // 交互中的状态直接进 dispose() 会漏掉 transition('cancelled') 这一步，
    // dispose() 内部再尝试 xxx -> done 就会因为不在允许列表里而抛异常，
    // 导致 cleanup.disposeAll() 根本没机会执行——这正是取消回原位时
    // Cleanup 计数泄漏的根因。session.cancel() 会先合法地转到 'cancelled'
    // 再走 dispose()。
    session.cancel()
    this.sessions.delete(session.id)
  }

  interrupt(sessionId: string, reason = 'interrupted'): void {
    const session = this.sessions.get(sessionId)
    if (!session) return
    const behavior = this.behaviors.get(session.type)
    behavior?.interrupt?.(this.createBehaviorContext(session), reason)
    session.interrupt()
    this.sessions.delete(session.id)
  }

  startSession(type: string, objectId = ''): Session {
    const session = new Session(type, objectId, this.owner)
    this.sessions.set(session.id, session)
    return session
  }

  /** 适配器迁移期间读取已创建 Session；业务不应直接修改其状态。 */
  getSession(id: string): Session | undefined {
    return this.sessions.get(id)
  }

  endSession(session: Session) {
    session.dispose()
    this.sessions.delete(session.id)
  }

  private createBehaviorContext(session: Session) {
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
