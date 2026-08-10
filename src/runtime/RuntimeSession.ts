import { Session } from '../session/Session'
import type { Owner, Lease } from '../owner/Owner'
import type { Behavior, BehaviorContext } from '../behavior/Behavior'

export interface SessionCompletionGate<T> { readonly promise: Promise<T>; complete(value: T): void; fail(): void }

/** Session 索引、Lease、Gate 与终态清理的统一功能域。 */
export class SessionCoordinator {
  private readonly sessions = new Map<string, Session>()
  private readonly completionGates = new Map<string, Set<SessionCompletionGate<unknown>>>()
  create(type: string, objectId: string, owner: Owner): Session { const session = new Session(type, objectId, owner); this.sessions.set(session.id, session); return session }
  get(id: string): Session | undefined { return this.sessions.get(id) }
  set(session: Session): void { this.sessions.set(session.id, session) }
  delete(id: string): void { this.sessions.delete(id) }
  addGate(sessionId: string, gate: SessionCompletionGate<unknown>): void { const gates = this.completionGates.get(sessionId) ?? new Set(); gates.add(gate); this.completionGates.set(sessionId, gates) }
  trackForObject(objectId: string, dispose: () => void): boolean {
    let tracked = false
    for (const session of this.sessions.values()) {
      if (session.objectId !== objectId) continue
      session.trackCleanup(dispose)
      tracked = true
    }
    return tracked
  }
  removeGate(sessionId: string, gate: SessionCompletionGate<unknown>): void { this.completionGates.get(sessionId)?.delete(gate) }
  failGates(sessionId: string): void { const gates = this.completionGates.get(sessionId); if (!gates) return; for (const gate of [...gates]) gate.fail(); this.completionGates.delete(sessionId) }
  acquireObject(sessionId: string, objectId: string): Lease | null { const session = this.sessions.get(sessionId); return session ? session.takeObject(objectId) : null }
  track(sessionId: string, dispose: () => void): void { this.sessions.get(sessionId)?.trackCleanup(dispose) }
  finalize(sessionId: string, beforeDispose?: (session: Session) => void): Session | undefined { const session = this.sessions.get(sessionId); if (!session) return; beforeDispose?.(session); session.dispose(); this.failGates(sessionId); this.sessions.delete(sessionId); return session }
  cancel(sessionId: string, beforeDispose?: (session: Session) => void): Session | undefined { const session = this.sessions.get(sessionId); if (!session) return; beforeDispose?.(session); session.cancel(); this.sessions.delete(sessionId); return session }
  interrupt(sessionId: string, reason: 'cancel' | 'regrab', beforeDispose?: (session: Session) => void): Session | undefined { const session = this.sessions.get(sessionId); if (!session) return; beforeDispose?.(session); session.interrupt(reason); this.sessions.delete(sessionId); return session }
}

/** Runtime Session 终态编排入口。 */
export class RuntimeSessionCoordinator {
  constructor(private readonly sessions: SessionCoordinator) {}
  finalize(session: Session, behavior: Behavior | undefined, context: BehaviorContext, disposeVisualProxy: (sessionId: string) => void, disposeBehavior: (behavior: Behavior | undefined, context: BehaviorContext) => void): void { try { this.sessions.finalize(session.id, current => disposeVisualProxy(current.id)) } finally { disposeBehavior(behavior, context) } }
  terminate(session: Session, behavior: Behavior | undefined, context: BehaviorContext, reason: string, mode: 'cancel' | 'interrupt', cancelBehavior: (behavior: Behavior | undefined, context: BehaviorContext, reason: string) => void, beforeSession: (session: Session) => void, disposeBehavior: (behavior: Behavior | undefined, context: BehaviorContext) => void): void { try { cancelBehavior(behavior, context, reason) } catch (error) { console.error(`Behavior ${mode} failed`, error) } finally { try { beforeSession(session); if (mode === 'cancel') this.sessions.cancel(session.id); else this.sessions.interrupt(session.id, reason === 'regrab' ? 'regrab' : 'cancel') } finally { disposeBehavior(behavior, context) } } }
}
