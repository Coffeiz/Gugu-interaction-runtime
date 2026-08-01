import type { ObjectStore } from '../object/ObjectStore'
import type { RuntimeRegistry } from './RuntimeRegistry'
import type { Session } from '../session/Session'
import { bindPointerSessionInput, type PointerSessionInputOptions } from '../input/PointerSessionInput'
import type { RuntimeInput, SessionHandle, StartRequest } from '../core/Interaction'

export interface RuntimeInputPort {
  objects: ObjectStore
  registry: RuntimeRegistry
  startObjectPointer(objectId: string, element: HTMLElement, event: PointerEvent): boolean
  registerRegrab(objectId: string, handler: (event: PointerEvent) => void): void
  regrab(objectId: string, event: PointerEvent): boolean
  update(sessionId: string, input: RuntimeInput): void
  release(sessionId: string, input: RuntimeInput): void | Promise<void>
}

/** 输入功能域；负责对象 DOM 绑定。 */
export class RuntimeInputCoordinator {
  private readonly bindings = new WeakMap<HTMLElement, () => void>()
  private readonly disposers = new Map<string, () => void>()

  constructor(private readonly port: RuntimeInputPort) {}

  bind(objectId: string, element: HTMLElement): () => void {
    this.disposers.get(objectId)?.()
    this.bindings.get(element)?.()
    let pending: {
      down: PointerEvent
      move: (event: Event) => void
      up: (event: Event) => void
    } | null = null

    const clearPending = () => {
      if (!pending) return
      window.removeEventListener('pointermove', pending.move)
      window.removeEventListener('pointerup', pending.up)
      window.removeEventListener('pointercancel', pending.up)
      pending = null
    }

    const listener = (event: Event) => {
      if (!(event instanceof PointerEvent)) return
      // 保留原生 click：只有真正越过拖拽阈值后才启动 VisualAdapter，避免
      // adapter 的 preventDefault() 把普通项目卡片点击吞掉。
      if (event.button !== 0 && event.pointerType === 'mouse') return
      // 某些非浏览器测试环境不会填充 pointerType；保留原有同步入口，避免
      // 让这类环境的显式 pointerdown 测试被阈值监听拖延。
      if (!event.pointerType) {
        this.port.startObjectPointer(objectId, element, event)
        return
      }
      clearPending()
      const startX = event.clientX
      const startY = event.clientY
      const move = (moveEvent: Event) => {
        if (!(moveEvent instanceof PointerEvent)) return
        if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 5) return
        clearPending()
        moveEvent.preventDefault()
        this.port.startObjectPointer(objectId, element, event)
      }
      const up = () => clearPending()
      pending = { down: event, move, up }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
      window.addEventListener('pointercancel', up)
    }
    element.addEventListener('pointerdown', listener)
    const dispose = () => {
      element.removeEventListener('pointerdown', listener)
      clearPending()
    }
    this.bindings.set(element, dispose)
    this.disposers.set(objectId, dispose)
    return dispose
  }

  sync(objectId: string): void {
    const object = this.port.objects.get(objectId)
    this.disposers.get(objectId)?.()
    this.disposers.delete(objectId)
    if (!object?.element || !this.port.registry.objectTypes.has(object.visual ?? object.type)) return
    this.bind(objectId, object.element)
  }

  remove(objectId: string): void {
    this.disposers.get(objectId)?.()
    this.disposers.delete(objectId)
  }

  bindRegrabTarget(
    session: Session,
    objectId: string,
    target: HTMLElement,
    handler: (event: PointerEvent) => void,
  ): void {
    this.port.registerRegrab(objectId, handler)
    const listener = (event: Event) => {
      if (event instanceof PointerEvent) this.port.regrab(objectId, event)
    }
    target.addEventListener('pointerdown', listener)
    session.cleanup.trackTargetListener(target, 'pointerdown', listener)
  }

  bindSession(session: Session, options: PointerSessionInputOptions = {}): () => void {
    return bindPointerSessionInput({
      update: (sessionId, input) => this.port.update(sessionId, input),
      release: (sessionId, input) => this.port.release(sessionId, input),
    }, session, options)
  }
}

export interface RuntimeDispatchHandlers {
  start(request: StartRequest): SessionHandle
  update(sessionId: string, input: RuntimeInput): void
  release(sessionId: string, input: RuntimeInput): Promise<void>
  cancel(sessionId: string, reason?: string): void
  interrupt(sessionId: string, reason?: string): void
}

export class RuntimeDispatcher {
  constructor(private readonly handlers: RuntimeDispatchHandlers) {}
  start(request: StartRequest): SessionHandle { return this.handlers.start(request) }
  update(sessionId: string, input: RuntimeInput): void { this.handlers.update(sessionId, input) }
  release(sessionId: string, input: RuntimeInput): Promise<void> { return this.handlers.release(sessionId, input) }
  cancel(sessionId: string, reason?: string): void { this.handlers.cancel(sessionId, reason) }
  interrupt(sessionId: string, reason?: string): void { this.handlers.interrupt(sessionId, reason) }
}
