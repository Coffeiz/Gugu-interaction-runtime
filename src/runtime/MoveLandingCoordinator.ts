import type { BehaviorContext } from '../behavior/Behavior'
import type { MoveBehavior } from '../behavior/MoveBehavior'
import type { Session } from '../session/Session'

export interface MoveLandingPort {
  createContext(session: Session): BehaviorContext
  getSession(id: string): Session | undefined
  cancel(id: string, reason: string): void
  end(session: Session): void
}

/** landing → handoff → reveal 的唯一编排入口。 */
export class MoveLandingCoordinator {
  constructor(private readonly port: MoveLandingPort) {}

  async run(session: Session, behavior: MoveBehavior, destination: unknown): Promise<void> {
    try {
      const landingResult = await behavior.landing(this.port.createContext(session), destination)
      const liveSession = this.port.getSession(session.id)
      if (liveSession !== session) return
      if (liveSession.state === 'disposed' || liveSession.state === 'interrupt') return
      if (landingResult && !landingResult.completed) {
        this.port.cancel(session.id, landingResult.reason ?? 'landing-failed')
        return
      }
      landingResult?.reveal?.()
      session.handoff()
      if (behavior.reveal) await behavior.reveal(this.port.createContext(session), destination)
      if (this.port.getSession(session.id) !== session) return
      this.port.end(session)
    } catch (error) {
      if (this.port.getSession(session.id) === session) {
        this.port.cancel(session.id, error instanceof Error ? error.message : 'landing-failed')
      }
    }
  }
}
