import { Owner } from './owner/Owner'
import { Session } from './session/Session'
import { ObjectStore } from './object/ObjectStore'
import { SurfaceStore } from './surface/SurfaceStore'

/**
 * Runtime 只组织其余模块，不写具体项目逻辑——具体的拖拽流程（Hit test、
 * 生成 Action）由业务侧的 dragSession 之类的编排函数调用 Runtime 提供的
 * 原语来完成，见 src/demo/kanbanDrag.ts。
 */
export class Runtime {
  readonly owner = new Owner()
  readonly objects = new ObjectStore()
  readonly surfaces = new SurfaceStore()
  private sessions = new Map<string, Session>()

  startSession(type: string): Session {
    const session = new Session(type, this.owner)
    this.sessions.set(session.id, session)
    return session
  }

  endSession(session: Session) {
    session.dispose()
    this.sessions.delete(session.id)
  }
}

export const runtime = new Runtime()
