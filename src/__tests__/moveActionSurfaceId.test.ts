import { describe, expect, it } from 'vitest'
import { MoveActionCoordinator } from '../runtime/RuntimeMove'

describe('MoveActionCoordinator', () => {
  it('保留业务注册的 Surface ID，不注入看板前缀', async () => {
    const actions: unknown[] = []
    const coordinator = new MoveActionCoordinator({
      getObjectSurface: () => 'active',
      emit: action => { actions.push(action) },
    })

    const transaction = { actionEmitted: false } as never
    await expect(coordinator.emit('project-1', { columnId: 'done', index: 2 }, transaction)).resolves.toBe(true)
    expect(actions).toEqual([{
      type: 'move',
      objectId: 'project-1',
      fromSurfaceId: 'active',
      toSurfaceId: 'done',
      toIndex: 2,
      timestamp: expect.any(Number),
    }])
  })

  it('Group Session 释放时发出一次 move-group，并保留对象顺序', async () => {
    const actions: unknown[] = []
    const coordinator = new MoveActionCoordinator({
      getObjectSurface: () => 'active',
      getGroup: () => ({ primaryObjectId: 'file:2', objectIds: ['file:2', 'file:1'] }),
      emit: action => { actions.push(action) },
    })

    const transaction = { actionEmitted: false } as never
    await expect(coordinator.emit('file:2', { columnId: 'done', index: 1 }, transaction)).resolves.toBe(true)
    expect(actions).toEqual([{
      type: 'move-group',
      objectId: 'file:2',
      primaryObjectId: 'file:2',
      objectIds: ['file:2', 'file:1'],
      fromSurfaceId: 'active',
      toSurfaceId: 'done',
      toIndex: 1,
      timestamp: expect.any(Number),
    }])
  })
})
