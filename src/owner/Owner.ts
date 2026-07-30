import { Emitter } from '../core/Emitter'

export type ControlMode = 'vue' | 'runtime'
export type Channel = 'position' | 'scale' | 'rotation' | 'opacity' | 'visibility' | 'layout' | 'hover' | 'zIndex'

export interface Lease {
  release(): void
}

interface ControlEntry {
  mode: ControlMode
  ownerSessionId: string | null
}

/**
 * 两层控制权：对象/区域级 ControlMode 挡住 Vue；channel Lease 避免 Runtime
 * 内部模块同时写同一属性。
 */
export class Owner {
  private controlled = new Map<string, ControlEntry>()
  private channelOwners = new Map<string, Map<Channel, string>>()
  private readonly events = new Emitter<string>()

  subscribe(listener: (id: string) => void): () => void {
    return this.events.subscribe(listener)
  }

  takeObject(id: string, sessionId: string): Lease {
    this.controlled.set(id, { mode: 'runtime', ownerSessionId: sessionId })
    this.events.emit(id)
    let released = false

    return {
      release: () => {
        if (released) return
        released = true
        const current = this.controlled.get(id)
        if (current?.ownerSessionId === sessionId) {
          this.controlled.delete(id)
          this.events.emit(id)
        }
      },
    }
  }

  takeSurface(id: string, sessionId: string): Lease {
    const current = this.controlled.get(id)
    if (current && current.ownerSessionId !== sessionId) {
      // Surface 是事务级锁，不能静默覆盖另一个 Session 的控制权。
      return { release: () => undefined }
    }
    return this.takeObject(id, sessionId)
  }

  isControlled(id: string): boolean {
    return this.controlled.get(id)?.mode === 'runtime'
  }

  isOwnedBy(id: string, sessionId: string): boolean {
    return this.controlled.get(id)?.ownerSessionId === sessionId
  }

  takeChannel(objectId: string, channel: Channel, sessionId: string): Lease {
    let map = this.channelOwners.get(objectId)
    if (!map) {
      map = new Map()
      this.channelOwners.set(objectId, map)
    }
    map.set(channel, sessionId)
    let released = false

    return {
      release: () => {
        if (released) return
        released = true
        if (map!.get(channel) === sessionId) {
          map!.delete(channel)
          if (map!.size === 0) this.channelOwners.delete(objectId)
        }
      },
    }
  }

  ownsChannel(objectId: string, channel: Channel, sessionId: string): boolean {
    return this.channelOwners.get(objectId)?.get(channel) === sessionId
  }
}
