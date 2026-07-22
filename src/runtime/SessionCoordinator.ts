import { Session } from '../session/Session'
import type { Owner } from '../owner/Owner'
import type { Lease } from '../owner/Owner'

export interface SessionCompletionGate<T> {
  readonly promise: Promise<T>
  complete(value: T): void
  fail(): void
}

/** Session 的唯一索引；清理细节暂由 Runtime 继续编排。 */
export class SessionCoordinator {
  private readonly sessions = new Map<string, Session>()
  private readonly completionGates = new Map<string, Set<SessionCompletionGate<unknown>>>()

  create(type: string, objectId: string, owner: Owner): Session {
    const session = new Session(type, objectId, owner)
    this.sessions.set(session.id, session)
    return session
  }

  get(id: string): Session | undefined { return this.sessions.get(id) }
  set(session: Session): void { this.sessions.set(session.id, session) }
  delete(id: string): void { this.sessions.delete(id) }

  addGate(sessionId: string, gate: SessionCompletionGate<unknown>): void {
    const gates = this.completionGates.get(sessionId) ?? new Set<SessionCompletionGate<unknown>>()
    gates.add(gate)
    this.completionGates.set(sessionId, gates)
  }

  removeGate(sessionId: string, gate: SessionCompletionGate<unknown>): void {
    this.completionGates.get(sessionId)?.delete(gate)
  }

  failGates(sessionId: string): void {
    const gates = this.completionGates.get(sessionId)
    if (!gates) return
    for (const gate of [...gates]) gate.fail()
    this.completionGates.delete(sessionId)
  }

  acquireObject(sessionId: string, objectId: string): Lease | null {
    const session = this.sessions.get(sessionId)
    if (!session) return null
    return session.takeObject(objectId)
  }

  track(sessionId: string, dispose: () => void): void {
    this.sessions.get(sessionId)?.trackCleanup(dispose)
  }

  /** 成功结束事务；视觉和 Behavior 的外围清理由 Runtime 按既有顺序调用。 */
  finalize(sessionId: string): Session | undefined {
    const session = this.sessions.get(sessionId)
    if (!session) return undefined
    session.dispose()
    this.failGates(sessionId)
    this.sessions.delete(sessionId)
    return session
  }

  cancel(sessionId: string): Session | undefined {
    const session = this.sessions.get(sessionId)
    if (!session) return undefined
    session.cancel()
    this.failGates(sessionId)
    this.sessions.delete(sessionId)
    return session
  }

  interrupt(sessionId: string, reason: 'cancel' | 'regrab'): Session | undefined {
    const session = this.sessions.get(sessionId)
    if (!session) return undefined
    session.interrupt(reason)
    this.failGates(sessionId)
    this.sessions.delete(sessionId)
    return session
  }
}
