import type { RuntimeInput, SessionHandle, StartRequest } from '../core/Interaction'

/** Runtime 的输入分发边界；具体事务逻辑仍由 Runtime 内部实现。 */
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
