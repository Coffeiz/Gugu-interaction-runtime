import { reactive } from 'vue'

/**
 * 对象级总闸：Vue 的 Transition/TransitionGroup 不会向 Runtime 申请 channel，
 * 只有一个对象/区域级别的"谁在控制"标记才能真正挡住它——channel 级的所有权
 * 只解决 Runtime 内部模块（Motion vs Layout）之间的冲突，见 docs/DESIGN.md。
 */
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
 * 两层控制权：
 * 1. 对象/区域级 ControlMode —— 决定 Vue 能不能播放这个对象的过渡动画。
 * 2. channel 级 Lease —— 决定 Runtime 内部哪个模块可以写这个对象的哪个属性。
 * 两层都要有：只做 1 挡不住 Motion/Layout 互相打架，只做 2 挡不住 Vue。
 */
export class Owner {
  private controlled = reactive(new Map<string, ControlEntry>())
  private channelOwners = new Map<string, Map<Channel, string>>()

  takeObject(id: string, sessionId: string): Lease {
    // 新 Session 可以直接抢占（例如 regrab 中途重新抓起）；旧 Session 手上的
    // Lease 之后 release 时会发现 ownerSessionId 已经不是自己，不会误清这里
    // 的状态——见规则 5。
    this.controlled.set(id, { mode: 'runtime', ownerSessionId: sessionId })
    let released = false
    return {
      release: () => {
        if (released) return
        released = true
        const current = this.controlled.get(id)
        // 旧 Session 只能释放自己持有的 Lease，不能重置别的 Session 已经
        // 接管的样式——见规则 5。
        if (current?.ownerSessionId === sessionId) {
          this.controlled.set(id, { mode: 'vue', ownerSessionId: null })
        }
      },
    }
  }

  takeSurface(id: string, sessionId: string): Lease {
    return this.takeObject(id, sessionId)
  }

  isControlled(id: string): boolean {
    return this.controlled.get(id)?.mode === 'runtime'
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
        if (map!.get(channel) === sessionId) map!.delete(channel)
      },
    }
  }

  ownsChannel(objectId: string, channel: Channel, sessionId: string): boolean {
    return this.channelOwners.get(objectId)?.get(channel) === sessionId
  }
}
