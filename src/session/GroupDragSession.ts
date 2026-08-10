import type { Owner, Lease } from '../owner/Owner'
import { Session } from './Session'

export interface GroupObjectOffset {
  readonly x: number
  readonly y: number
}

export interface GroupDragSessionOptions {
  readonly type?: string
  readonly offsets?: ReadonlyMap<string, GroupObjectOffset>
}

/**
 * 多对象拖拽的 Core 会话。
 *
 * 物理上仍只有一个主会话：primaryObjectId 负责指针、速度和落点；其余对象只
 * 共享会话生命周期与相对偏移。底层复用单对象 Session，避免改动既有单卡状态机。
 */
export class GroupDragSession extends Session {
  private readonly leasedObjectIds = new Set<string>()
  private readonly offsets: ReadonlyMap<string, GroupObjectOffset>

  readonly objectIds: readonly string[]
  readonly primaryObjectId: string

  constructor(
    objectIds: readonly string[],
    primaryObjectId: string,
    owner: Owner,
    options: GroupDragSessionOptions = {},
  ) {
    const uniqueIds = [...new Set(objectIds)]
    if (uniqueIds.length === 0) throw new Error('GroupDragSession requires at least one object')
    if (!uniqueIds.includes(primaryObjectId)) {
      throw new Error(`Primary object is not part of group: ${primaryObjectId}`)
    }

    super(options.type ?? 'move', primaryObjectId, owner)
    this.objectIds = Object.freeze(uniqueIds)
    this.primaryObjectId = primaryObjectId
    this.offsets = options.offsets ? new Map(options.offsets) : new Map()
  }

  hasObject(objectId: string): boolean { return this.objectIds.includes(objectId) }

  offsetFor(objectId: string): GroupObjectOffset | undefined {
    return this.offsets.get(objectId)
  }

  /** 获取 group 内尚未获取的对象 Lease，保证重复调用不会重复登记。 */
  takeObject(objectId: string): Lease {
    if (!this.hasObject(objectId)) throw new Error(`Object is not part of group: ${objectId}`)
    if (this.leasedObjectIds.has(objectId)) {
      return { release: () => undefined }
    }
    const lease = super.takeObject(objectId)
    this.leasedObjectIds.add(objectId)
    return lease
  }

  takeObjects(): readonly Lease[] {
    return this.objectIds.map(objectId => this.takeObject(objectId))
  }

}
