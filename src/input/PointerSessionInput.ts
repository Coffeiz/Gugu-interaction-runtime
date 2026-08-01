import type { RuntimeInput } from '../core/Interaction'
import type { Session } from '../session/Session'

export interface PointerSessionInputRuntime {
  update(sessionId: string, input: RuntimeInput): void
  release(sessionId: string, input: RuntimeInput): void | Promise<void>
}

export interface PointerSessionInputOptions {
  /** 从 pointerdown 移动多少像素后才启动拖拽；默认 5px。 */
  dragThreshold?: number
  /** 默认绑定到 window；测试或 iframe 场景可以注入其他 Window。 */
  target?: Window
  /** 使用 setPointerCapture 时，传入实际捕获元素以监听丢失捕获。 */
  captureTarget?: EventTarget
}

/**
 * 把一次 pointer Session 的 move/up 输入统一接到 Runtime。
 *
 * pointerup 后监听器立即解绑，不等待 landing/reveal 完成；同时把同一个幂等
 * disposer 登记进 Session Cleanup，保证 cancel/interrupt/prepare 失败时也不会
 * 留下全局监听器。
 */
export function bindPointerSessionInput(
  runtime: PointerSessionInputRuntime,
  session: Session,
  options: PointerSessionInputOptions = {},
): () => void {
  const target = options.target ?? window
  const captureTarget = options.captureTarget
  let disposed = false

  const onPointerMove = (event: PointerEvent): void => {
    runtime.update(session.id, { kind: 'pointermove', event })
  }

  const onPointerUp = (event: PointerEvent): void => {
    stop()
    void runtime.release(session.id, { kind: 'pointerup', event })
  }

  const onPointerCancel = (event: PointerEvent): void => {
    stop()
    runtime.release(session.id, { kind: 'pointercancel', event })
  }

  const onBlur = (): void => {
    stop()
    runtime.release(session.id, { kind: 'blur' })
  }

  const onLostPointerCapture = (event: Event): void => {
    stop()
    runtime.release(session.id, { kind: 'lostpointercapture', event })
  }

  function stop(): void {
    if (disposed) return
    disposed = true
    target.removeEventListener('pointermove', onPointerMove)
    target.removeEventListener('pointerup', onPointerUp)
    target.removeEventListener('pointercancel', onPointerCancel)
    target.removeEventListener('blur', onBlur)
    captureTarget?.removeEventListener('lostpointercapture', onLostPointerCapture)
  }

  target.addEventListener('pointermove', onPointerMove)
  target.addEventListener('pointerup', onPointerUp)
  target.addEventListener('pointercancel', onPointerCancel)
  target.addEventListener('blur', onBlur)
  captureTarget?.addEventListener('lostpointercapture', onLostPointerCapture)
  session.cleanup.track(stop)

  return stop
}
