import type { RuntimeInput, SessionHandle, StartRequest } from '../core/Interaction'
import type { Session } from '../session/Session'
import { MoveBehavior, type MoveVisualStrategy } from '../behavior/MoveBehavior'
import type { Behavior, BehaviorContext } from '../behavior/Behavior'
import type { Action } from '../action/Action'
import type { MoveActionDestination } from '../behavior/MoveTransaction'
import type { MoveContext } from '../behavior/MoveBehavior'

function isPromiseLike<T>(value: unknown): value is PromiseLike<T> {
  return Boolean(value && typeof (value as { then?: unknown }).then === 'function')
}

/** 移动事务功能域入口；Runtime 只通过该入口转发移动阶段操作。 */
export class RuntimeMoveCoordinator {
  constructor(
    private readonly updateCoordinator: MoveUpdateCoordinator,
    private readonly releaseCoordinator: MoveReleaseCoordinator,
    private readonly commitCoordinator: MoveCommitCoordinator,
    private readonly landingCoordinator: MoveLandingCoordinator,
  ) {}

  static fromPorts(
    updatePort: MoveUpdatePort,
    commitCoordinator: MoveCommitCoordinator,
    landingCoordinator: MoveLandingCoordinator,
  ): RuntimeMoveCoordinator {
    return new RuntimeMoveCoordinator(
      new MoveUpdateCoordinator(updatePort),
      new MoveReleaseCoordinator(),
      commitCoordinator,
      landingCoordinator,
    )
  }

  update(sessionId: string, input: RuntimeInput): void {
    this.updateCoordinator.update(sessionId, input)
  }

  prepareRelease(session: Session | undefined, input: RuntimeInput): ReleasePreflight {
    return this.releaseCoordinator.prepare(session, input)
  }

  async commit(session: Session, behavior: MoveBehavior, destination: unknown, emitAction = true): Promise<void> {
    return this.commitCoordinator.commit(session, behavior, destination, emitAction)
  }

  async land(session: Session, behavior: MoveBehavior, destination: unknown): Promise<void> {
    return this.landingCoordinator.run(session, behavior, destination)
  }

  release(sessionId: string, input: RuntimeInput, port: MoveReleasePort): Promise<void> {
    const candidate = port.getSession(sessionId)
    const preflight = this.prepareRelease(candidate, input)
    if (preflight.kind === 'ignore') return Promise.resolve()
    if (preflight.kind === 'cancel') {
      if (candidate) port.cancel(candidate.id, preflight.reason)
      return Promise.resolve()
    }
    const session = preflight.session
    const behavior = port.getBehavior(session.type)
    if (behavior instanceof MoveBehavior) port.captureLayout(session.id)
    let result: unknown
    try {
      result = behavior?.release?.(port.createContext(session), input)
    } catch (error) {
      port.cancel(session.id, error instanceof Error ? error.message : 'release-failed')
      return Promise.resolve()
    }
    if (isPromiseLike(result)) {
      return Promise.resolve(result)
        .then(releaseResult => this.finishRelease(session, behavior, releaseResult, port), error => {
          port.cancel(session.id, error instanceof Error ? error.message : 'release-failed')
        })
    }
    return this.finishRelease(session, behavior, result, port)
  }

  private async finishRelease(
    session: Session,
    behavior: Behavior | undefined,
    result: unknown,
    port: MoveReleasePort,
  ): Promise<void> {
    if (port.getSession(session.id) !== session) return
    const releaseResult = result as { accepted?: boolean; destination?: unknown; emitAction?: boolean } | undefined
    if (releaseResult?.accepted === false) {
      port.cancel(session.id, 'no-valid-drop')
      return
    }
    if (session.state === 'release') session.transition('landing')
    if (!(behavior instanceof MoveBehavior)) {
      port.end(session)
      return
    }
    const destination = releaseResult?.destination
    if (destination === undefined) {
      port.cancel(session.id, 'invalid-release-result')
      return
    }
    try {
      await this.commit(session, behavior, destination, releaseResult?.emitAction !== false)
    } catch (error) {
      port.cancel(session.id, error instanceof Error ? error.message : 'commit-failed')
      return
    }
    await this.land(session, behavior, destination)
  }

  start(request: StartRequest, port: MoveStartPort): SessionHandle {
    const behavior = port.getBehavior(request.type)
    if (!behavior) throw new Error(`Unknown interaction behavior: ${request.type}`)
    const session = port.createSession(request.type, request.objectId)
    const strategy = port.getVisualStrategy(request.objectId)
    if (strategy) port.bindLifecycle(session.id, strategy)
    const context = port.createContext(session)
    try {
      const result = behavior.prepare?.(context, request)
      if (result && typeof (result as { then?: unknown }).then === 'function') {
        ;(result as Promise<void>).catch(error => {
          if (port.isCurrent(session.id)) port.cancel(session.id, error instanceof Error ? error.message : 'prepare-failed')
        })
      }
    } catch (error) {
      port.cancel(session.id, error instanceof Error ? error.message : 'prepare-failed')
    }
    if (port.isCurrent(session.id) && session.state === 'prepare') session.transition('active')
    return {
      id: session.id,
      get state() { return session.state },
      cancel: reason => port.cancel(session.id, reason ?? 'cancelled'),
      interrupt: reason => port.interrupt(session.id, reason ?? 'interrupted'),
    }
  }
}

export interface MoveStartPort {
  getBehavior(type: string): Behavior | undefined
  createSession(type: string, objectId: string): Session
  getVisualStrategy(objectId: string): MoveVisualStrategy | undefined
  bindLifecycle(sessionId: string, strategy: MoveVisualStrategy): void
  createContext(session: Session): BehaviorContext
  isCurrent(sessionId: string): boolean
  cancel(sessionId: string, reason: string): void
  interrupt(sessionId: string, reason: string): void
}

export interface MoveReleasePort {
  getSession(sessionId: string): Session | undefined
  getBehavior(type: string): Behavior | undefined
  createContext(session: Session): BehaviorContext
  captureLayout(sessionId: string): void
  playLayout(sessionId: string, useRaf?: boolean): void
  cancel(sessionId: string, reason: string): void
  end(session: Session): void
}

export interface MoveActionPort { getObjectSurface(objectId: string): string | undefined; emit(action: Action): void | Promise<void> }

export interface MoveUpdatePort { getSession(id: string): { type: string; state: string } | undefined; getBehavior(type: string): Behavior | undefined; createContext(id: string): BehaviorContext }
export class MoveUpdateCoordinator {
  constructor(private readonly port: MoveUpdatePort) {}
  update(sessionId: string, input: RuntimeInput): void {
    const session = this.port.getSession(sessionId)
    if (!session || session.state !== 'active') return
    this.port.getBehavior(session.type)?.update?.(this.port.createContext(sessionId), input)
  }
}

export type ReleasePreflight = { kind: 'cancel'; reason: string } | { kind: 'continue'; session: Session } | { kind: 'ignore' }
export class MoveReleaseCoordinator {
  prepare(session: Session | undefined, input: RuntimeInput): ReleasePreflight {
    if (!session) return { kind: 'ignore' }
    if (input.kind === 'pointercancel' || input.kind === 'blur' || input.kind === 'lostpointercapture') return { kind: 'cancel', reason: input.kind }
    if (session.state === 'prepare') return { kind: 'cancel', reason: 'interaction-not-ready' }
    if (session.state === 'active') session.transition('release')
    return session.state === 'release' ? { kind: 'continue', session } : { kind: 'ignore' }
  }
}

export interface MoveCommitPort {
  createContext(session: Session): BehaviorContext
  getLifecycle(id: string): import('../behavior/MoveBehavior').MoveVisualLifecycle | undefined
  playLayout(sessionId: string, useRaf?: boolean): void
  normalize(objectId: string, destination: unknown): MoveActionDestination | null
  /** 目标 Surface 当前的对象数（用于列尾判定兜底：toIndex >= count 即追加）。 */
  getSurfaceObjectCount?(surfaceId: string): number
  /** Surface 内存在非对象的布局锚点时，列尾也可能发生位移，必须即时写入 Invert。 */
  hasLayoutAnchor?(surfaceId: string): boolean
  /**
   * 对象在目标 Surface 里真实的、按屏幕布局排序算出的索引（不依赖拖拽落点
   * 算出的 toIndex）。业务可能对目标列有自己的排序/分组规则（比如已完成列
   * 按日期分年月分组），拖拽落点算出的 toIndex 未必是卡片最终真实停留的
   * 位置——用这个量到的才是"卡片实际会不会在最后一个位置"的真相。
   */
  getObjectIndex?(objectId: string, surfaceId: string): number | undefined
}
export class MoveCommitCoordinator {
  constructor(private readonly port: MoveCommitPort, private readonly actions: MoveActionCoordinator) {}
  private resolveIsAppend(objectId: string, normalized: MoveActionDestination | null): boolean {
    if (!normalized) return false
    const finalIndex = this.port.getObjectIndex?.(objectId, normalized.toSurfaceId)
    const surfaceObjectCount = this.port.getSurfaceObjectCount?.(normalized.toSurfaceId)
    if (this.port.hasLayoutAnchor?.(normalized.toSurfaceId)) return false
    // 优先用真实 DOM 排序算出的最终索引：拖拽落点算出的 toIndex 只是"打算
    // 插到哪"，如果目标列自己还会按业务规则重新排（比如已完成列按日期分
    // 组），真正停在哪由渲染结果说了算，只有量 DOM 才不会被业务排序骗。
    if (finalIndex !== undefined && finalIndex >= 0 && surfaceObjectCount !== undefined) {
      return finalIndex >= surfaceObjectCount - 1
    }
    return normalized.toIndex !== undefined
      && surfaceObjectCount !== undefined
      && normalized.toIndex >= surfaceObjectCount - 1
  }
  async commit(session: Session, behavior: MoveBehavior, destination: unknown, emitAction = true): Promise<void> {
    const context = this.port.createContext(session)
    await behavior.commit(context, destination)
    if (!emitAction) {
      // 无效落点回原 Surface 没有业务 Action，但目标等待仍需要知道这是
      // 同 Surface 事务，避免把隐藏源节点误判成跨列尚未重挂载的旧节点。
      const normalized = this.port.normalize(session.objectId, destination)
      if (normalized) behavior.getContext(session.id).transaction.destination = normalized
      // 回弹本质也是"落回原 Surface 的某个位置"，同样存在列尾场景（卡片
      // 本来就在列尾/底部，回弹后仍是列尾，无位移 FLIP），必须走同样的
      // isAppend 判定，否则永远走 microtask，复现顶动问题。此时没有 emit，
      // 不需要等 Vue patch，DOM 已经是回弹后的真实位置，可以直接量。
      const isAppend = this.resolveIsAppend(session.objectId, normalized)
      if (isAppend) {
        this.port.playLayout(session.id, true)
      } else {
        this.port.playLayout(session.id)
      }
      return
    }
    const lifecycle = this.port.getLifecycle(session.id)
    const normalized = this.port.normalize(session.objectId, destination)
    if (normalized) await lifecycle?.surface?.leave?.(context, normalized.fromSurfaceId)
    await this.actions.emit(session.objectId, behavior.getContext(session.id).destination, behavior.getContext(session.id).transaction)
    // surface.enter 必须在 playLayout 之前调用：detach 策略在这里释放对象
    // ownership，触发业务 <Teleport :disabled="!isDetached(...)"> 把卡片
    // 传送回真实 DOM（这时 store 已经落地在新 Surface，传送回来的就是最终
    // 位置）。release() 内部同步 emit 事件，Vue 监听者同步把 ownershipVersion
    // 加一，但 Vue 自己的渲染/DOM patch 是异步排到它自己的微任务队列的。
    // 这里的 await 会先让出一轮微任务：Vue 的渲染 job 比 playLayout 内部
    // scheduleLayoutFlip 排的 job 先入队（因为 release() 在 await 之前同步
    // 触发），因此也会先执行，FLIP 拿到的就是 Teleport 落位后的最终布局。
    // 顺序反过来（先 playLayout 再 surface.enter）会导致 FLIP 的微任务先于
    // Vue 的 DOM patch 执行，量到还没搬回真实位置的旧布局，表现为松手瞬间
    // 闪一帧最终布局——这正是 devlog 记录过的三帧问题的另一个诱因。
    if (normalized) await lifecycle?.surface?.enter?.(context, normalized.toSurfaceId)
    // playLayout 必须等 emit 的 Vue patch 落地后再量布局：emit 触发的 store
    // 变更、卡片 DOM 重挂载都发生在这一步，之前的调用会量到旧布局（顶动）。
    // isAppend 判定也放到这里之后算：只有 DOM 真正落地后，getObjectIndex
    // 量到的才是卡片最终会不会停在最后一个位置的真相（而不是拖拽落点算出
    // 的 toIndex——业务自己的排序规则，比如按日期分组，可能让卡片实际落
    // 点跟 toIndex 完全不对应）。
    //  - 列尾区域（真实最终索引 >= count - 1）：目标列已有卡片无位移（或仅
    //    列尾让位），没有 transform Invert，rAF 不会闪现；且 rAF 必然晚于
    //    Vue patch 微任务，resize 冻结与播放同帧起步，不顶动。
    //  - 中间插入：有卡片位移 FLIP（有 Invert），必须 microtask 让 Invert
    //    在 paint 前写入，不闪现；此时 Vue patch 已完成，microtask 量到的
    //    也是最终布局，不顶动。
    const isAppend = this.resolveIsAppend(session.objectId, normalized)
    if (isAppend) {
      this.port.playLayout(session.id, true)
    } else {
      this.port.playLayout(session.id)
    }
  }
}

export interface MoveLandingPort { createContext(session: Session): BehaviorContext; getSession(id: string): Session | undefined; cancel(id: string, reason: string): void; end(session: Session): void }
export class MoveLandingCoordinator {
  constructor(private readonly port: MoveLandingPort) {}
  async run(session: Session, behavior: MoveBehavior, destination: unknown): Promise<void> {
    try {
      const result = await behavior.landing(this.port.createContext(session), destination)
      const live = this.port.getSession(session.id)
      if (live !== session || live.state === 'disposed' || live.state === 'interrupt') return
      if (result && !result.completed) return this.port.cancel(session.id, result.reason ?? 'landing-failed')
      if (result && result.reveal) await result.reveal()
      session.handoff()
      if (behavior.reveal) await behavior.reveal(this.port.createContext(session), destination)
      if (this.port.getSession(session.id) === session) this.port.end(session)
    } catch (error) {
      if (this.port.getSession(session.id) === session) this.port.cancel(session.id, error instanceof Error ? error.message : 'landing-failed')
    }
  }
}

export class MoveActionCoordinator {
  constructor(private readonly port: MoveActionPort) {}
  normalize(objectId: string, value: unknown): MoveActionDestination | null {
    if (this.isDestination(value)) return value
    if (!value || typeof value !== 'object') return null
    const candidate = value as { columnId?: unknown; index?: unknown }
    if (typeof candidate.columnId !== 'string') return null
    const fromSurfaceId = this.port.getObjectSurface(objectId)
    if (!fromSurfaceId) return null
    // Surface ID 是业务注册表的稳定标识，不是看板列名。Runtime 不能擅自添加
    // `column:` 前缀，否则 file/drawer/canvas 等 Surface 以及真实业务 Store
    // 会收到与注册值不同的 Action。
    return { fromSurfaceId, toSurfaceId: candidate.columnId, ...(typeof candidate.index === 'number' ? { toIndex: candidate.index } : {}) }
  }
  async emit(objectId: string, destination: unknown, transaction: MoveContext['transaction']): Promise<boolean> {
    if (transaction.actionEmitted) return false
    const normalized = this.normalize(objectId, destination)
    if (!normalized) return false
    transaction.actionEmitted = true
    transaction.destination = normalized
    await this.port.emit({ type: 'move', objectId, fromSurfaceId: normalized.fromSurfaceId, toSurfaceId: normalized.toSurfaceId, ...(normalized.toIndex === undefined ? {} : { toIndex: normalized.toIndex }), timestamp: Date.now() })
    return true
  }
  private isDestination(value: unknown): value is MoveActionDestination {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<MoveActionDestination>
    return typeof candidate.fromSurfaceId === 'string' && typeof candidate.toSurfaceId === 'string'
  }
}
