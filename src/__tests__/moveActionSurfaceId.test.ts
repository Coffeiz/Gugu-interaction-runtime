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
})
