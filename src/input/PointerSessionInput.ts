import type { Cleanup } from '../cleanup/Cleanup'
import type { RuntimeInput } from '../core/Interaction'

export interface PointerSessionInputSink {
  update(sessionId: string, input: RuntimeInput): void
  release(sessionId: string, input: RuntimeInput): void | Promise<void>
}

export interface PointerSessionInputOptions {
  readonly target?: Window
  readonly moveKind?: string
  readonly releaseKind?: string
}

/**
 * 把一次 pointer 交互的 window 监听收进 Session 生命周期。
 * pointerup 后立即解绑，Session dispose 时再幂等兜底，避免 landing 期间旧
 * pointerup 重新触发已经结束的 release。
 */
export function bindPointerSessionInput(
  sink: PointerSessionInputSink,
  sessionId: string,
  cleanup: Cleanup,
  options: PointerSessionInputOptions = {},
): () => void {
  const target = options.target ?? (typeof window !== 'undefined' ? window : undefined)
  if (!target) return () => undefined

  let disposed = false
  const onMove = (event: PointerEvent) => {
    sink.update(sessionId, { kind: options.moveKind ?? 'pointermove', event })
  }
  const onUp = (event: PointerEvent) => {
    dispose()
    void sink.release(sessionId, { kind: options.releaseKind ?? 'pointerup', event })
  }
  const dispose = () => {
    if (disposed) return
    disposed = true
    target.removeEventListener('pointermove', onMove)
    target.removeEventListener('pointerup', onUp)
  }

  target.addEventListener('pointermove', onMove)
  target.addEventListener('pointerup', onUp)
  cleanup.track(dispose)
  return dispose
}
