import { describe, expect, it } from 'vitest'
import { GroupDragSession } from '../session/GroupDragSession'
import { Owner } from '../owner/Owner'
import type { MoveGroupAction } from '../action/Action'

describe('GroupDragSession', () => {
  it('保留选择顺序、去重，并以主卡作为底层 Session objectId', () => {
    const group = new GroupDragSession(['file:2', 'file:1', 'file:2'], 'file:1', new Owner())

    expect(group.objectIds).toEqual(['file:2', 'file:1'])
    expect(group.primaryObjectId).toBe('file:1')
    expect(group.type).toBe('move')
    expect(group.state).toBe('prepare')
  })

  it('要求主卡属于选择集合且集合不能为空', () => {
    expect(() => new GroupDragSession([], 'file:1', new Owner())).toThrow('at least one object')
    expect(() => new GroupDragSession(['file:1'], 'file:2', new Owner())).toThrow('not part of group')
  })

  it('一次获取全部对象 ownership，重复获取不会覆盖会话内的 Lease', () => {
    const owner = new Owner()
    const group = new GroupDragSession(['file:1', 'file:2'], 'file:1', owner)

    group.takeObjects()
    group.takeObjects()
    expect(owner.isOwnedBy('file:1', group.id)).toBe(true)
    expect(owner.isOwnedBy('file:2', group.id)).toBe(true)

    group.cancel()
    expect(owner.isControlled('file:1')).toBe(false)
    expect(owner.isControlled('file:2')).toBe(false)
    expect(group.state).toBe('disposed')
  })

  it('共享附属卡相对主卡的初始偏移，并在 interrupt/regrab 时释放全部 ownership', () => {
    const owner = new Owner()
    const group = new GroupDragSession(['file:1', 'file:2'], 'file:1', owner, {
      offsets: new Map([['file:2', { x: 12, y: 18 }]]),
    })
    group.takeObjects()

    expect(group.offsetFor('file:2')).toEqual({ x: 12, y: 18 })
    expect(group.offsetFor('file:1')).toBeUndefined()

    group.transition('active')
    group.interrupt('regrab')
    expect(owner.isControlled('file:1')).toBe(false)
    expect(owner.isControlled('file:2')).toBe(false)
    expect(group.state).toBe('disposed')
  })

  it('附属对象也属于会话，组件卸载清理可以挂到同一生命周期', () => {
    const group = new GroupDragSession(['file:1', 'file:2'], 'file:1', new Owner())

    expect(group.hasObject('file:1')).toBe(true)
    expect(group.hasObject('file:2')).toBe(true)
    expect(group.hasObject('file:3')).toBe(false)
  })

  it('MoveGroupAction 暴露主卡和完整对象列表', () => {
    const action: MoveGroupAction = {
      type: 'move-group',
      objectId: 'file:1',
      primaryObjectId: 'file:1',
      objectIds: ['file:1', 'file:2'],
      fromSurfaceId: 'surface:source',
      toSurfaceId: 'surface:target',
      timestamp: 1,
    }

    expect(action.objectIds).toHaveLength(2)
    expect(action.primaryObjectId).toBe(action.objectId)
  })
})
