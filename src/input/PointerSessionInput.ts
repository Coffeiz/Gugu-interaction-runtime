import type { Cleanup } from '../cleanup/Cleanup'
import type { RuntimeInput } from '../core/Interaction'

export interface PointerSessionInputSink {
  update(sessionId: string, input: RuntimeInput): void
  release(sessionId: string, input: RuntimeInput): void | Promise<void>
  cancel?(sessionId: string, reason?: string): void
  interrupt?(sessionId: string, reason?: string): void
}

export interface PointerSessionInputOptions {
  readonly target?: Window
  /** 只响应启动这次 Session 的 pointer，避免多指/触控笔串扰。 */
  readonly pointerId?: number
  readonly moveKind?: string
  readonly releaseKind?: string
  readonly pointerCancelReason?: string
  readonly blurReason?: string
  readonly escapeReason?: string
  readonly cancelOnEscape?: boolean
  readonly interruptOnBlur?: boolean
}

/**
 * 把一次 pointer 交互的 window 监听收进 Session 生命周期。
 *
 * - pointerup 后立即解绑，Session dispose 时再幂等兜底；
 * - 只接受同一个 pointerId，避免另一个手指/笔错误释放当前 Session；
 * - pointercancel / Escape 走 cancel，窗口失焦走 interrupt。
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
  const matchesPointer = (event: PointerEvent) => (
    options.pointerId === undefined || event.pointerId === options.pointerId
  )

  const onMove = (event: PointerEvent) => {
    if (disposed || !matchesPointer(event)) return
    sink.update(sessionId, { kind: options.moveKind ?? 'pointermove', event })
  }

  const onUp = (event: PointerEvent) => {
    if (disposed || !matchesPointer(event)) return
    dispose()
    void sink.release(sessionId, { kind: options.releaseKind ?? 'pointerup', event })
  }

  const onPointerCancel = (event: PointerEvent) => {
    if (disposed || !matchesPointer(event)) return
    dispose()
    sink.cancel?.(sessionId, options.pointerCancelReason ?? 'pointer-cancelled')
  }

  const onBlur = () => {
    if (disposed || options.interruptOnBlur === false) return
    dispose()
    if (sink.interrupt) sink.interrupt(sessionId, options.blurReason ?? 'window-blur')
    else sink.cancel?.(sessionId, options.blurReason ?? 'window-blur')
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (disposed || options.cancelOnEscape === false || event.key !== 'Escape') return
    dispose()
    sink.cancel?.(sessionId, options.escapeReason ?? 'escape')
  }

  const dispose = () => {
    if (disposed) return
    disposed = true
    target.removeEventListener('pointermove', onMove)
    target.removeEventListener('pointerup', onUp)
    target.removeEventListener('pointercancel', onPointerCancel)
    target.removeEventListener('blur', onBlur)
    target.removeEventListener('keydown', onKeyDown)
  }

  target.addEventListener('pointermove', onMove)
  target.addEventListener('pointerup', onUp)
  target.addEventListener('pointercancel', onPointerCancel)
  target.addEventListener('blur', onBlur)
  target.addEventListener('keydown', onKeyDown)
  cleanup.track(dispose)
  return dispose
}
