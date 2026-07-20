import type { RuntimeInput } from '../core/Interaction'
import type { Session } from '../session/Session'

export interface PointerSessionInputRuntime {
  update(sessionId: string, input: RuntimeInput): void
  release(sessionId: string, input: RuntimeInput): void | Promise<void>
}

export interface PointerSessionInputOptions {
  /** 默认绑定到 window；测试或 iframe 场景可以注入其他 Window。 */
  target?: Window
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
  let disposed = false

  const onPointerMove = (event: PointerEvent): void => {
    runtime.update(session.id, { kind: 'pointermove', event })
  }

  const onPointerUp = (event: PointerEvent): void => {
    stop()
    void runtime.release(session.id, { kind: 'pointerup', event })
  }

  function stop(): void {
    if (disposed) return
    disposed = true
    target.removeEventListener('pointermove', onPointerMove)
    target.removeEventListener('pointerup', onPointerUp)
  }

  target.addEventListener('pointermove', onPointerMove)
  target.addEventListener('pointerup', onPointerUp)
  session.cleanup.track(stop)

  return stop
}
