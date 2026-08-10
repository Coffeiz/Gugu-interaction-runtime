import { describe, expect, it } from 'vitest'
import { Runtime } from '../Runtime'
import { ObjectStore } from '../object/ObjectStore'
import { SurfaceStore } from '../surface/SurfaceStore'
import { TargetStore } from '../target/TargetStore'

describe('Runtime 注册表生命周期', () => {
  it('ObjectStore 只允许当前 generation 注销对象', () => {
    const store = new ObjectStore()
    const first = store.register({ id: 'card:1', type: 'card', surfaceId: 'surface:a', element: null, abilities: ['move'] })
    const second = store.register({ id: 'card:1', type: 'card', surfaceId: 'surface:b', element: null, abilities: ['move'] })

    expect(second).toBe(first + 1)
    expect(store.unregister('card:1', first)).toBe(false)
    expect(store.get('card:1')?.generation).toBe(second)
    expect(store.unregister('card:1', second)).toBe(true)
  })

  it('ObjectStore update 不改变注册代次，并对重复值保持幂等', () => {
    const store = new ObjectStore()
    const generation = store.register({ id: 'card:1', type: 'card', surfaceId: 'surface:a', element: null, abilities: ['move'] })

    expect(store.update('card:1', { surfaceId: 'surface:b', abilities: ['move', 'sort'] })).toBe(true)
    expect(store.get('card:1')).toMatchObject({ generation, surfaceId: 'surface:b', abilities: ['move', 'sort'] })
    expect(store.update('card:1', { surfaceId: 'surface:b' })).toBe(true)
    expect(store.get('card:1')?.generation).toBe(generation)
  })

  it('SurfaceStore 和 TargetStore 同样保护 generation 并支持增量更新', () => {
    const surfaces = new SurfaceStore()
    const targets = new TargetStore()
    const surfaceGeneration = surfaces.register({ id: 'surface:a', type: 'list', element: null, accepts: ['card'] })
    const targetGeneration = targets.register({ id: 'target:a', surfaceId: 'surface:a', element: null, accepts: ['card'], priority: 1 })

    expect(surfaces.update('surface:a', { accepts: ['card', 'folder'] })).toBe(true)
    expect(targets.update('target:a', { priority: 2, surfaceId: 'surface:b' })).toBe(true)
    expect(surfaces.get('surface:a')).toMatchObject({ generation: surfaceGeneration, accepts: ['card', 'folder'] })
    expect(targets.get('target:a')).toMatchObject({ generation: targetGeneration, priority: 2, surfaceId: 'surface:b' })
    expect(surfaces.unregister('surface:a', surfaceGeneration - 1)).toBe(false)
    expect(targets.unregister('target:a', targetGeneration - 1)).toBe(false)
    expect(surfaces.get('surface:a')?.generation).toBe(surfaceGeneration)
    expect(targets.get('target:a')?.generation).toBe(targetGeneration)
  })

  it('Object 内嵌 Target 更新时保持 Target 身份连续', () => {
    const runtime = new Runtime()
    runtime.objects.register({
      id: 'folder:1',
      type: 'folder',
      surfaceId: 'surface:browser',
      element: null,
      abilities: ['move'],
      target: { id: 'business-target:folder:1', surfaceId: 'surface:folder:1', accepts: ['file'], priority: 1 },
    })

    const targetId = 'object-target:folder:1'
    const generation = runtime.targets.get(targetId)?.generation
    runtime.objects.update('folder:1', { target: { surfaceId: 'surface:folder:1', accepts: ['file', 'folder'], priority: 2 } })

    expect(runtime.targets.get(targetId)).toMatchObject({
      id: targetId,
      generation,
      accepts: ['file', 'folder'],
      priority: 2,
    })
  })

  it('活动 session 内卸载对象时延迟注销，session 结束后再清理', () => {
    const runtime = new Runtime()
    const generation = runtime.objects.register({
      id: 'file:readme',
      type: 'file-item',
      visual: 'file-item',
      surfaceId: 'file:surface:browser',
      element: null,
      abilities: ['move'],
    })
    const session = runtime.startSession('move', 'file:readme')

    runtime.unregisterObjectWhenIdle('file:readme', generation)
    expect(runtime.objects.get('file:readme')).toBeDefined()

    runtime.cancel(session.id)
    expect(runtime.objects.get('file:readme')).toBeUndefined()
  })
})
