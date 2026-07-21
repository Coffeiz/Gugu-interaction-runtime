import { describe, expect, it, vi } from 'vitest'
import { Runtime } from '../Runtime'
import type { MoveBehaviorDriver, MoveVisualLifecycle } from '../behavior/MoveBehavior'

function createRuntime() {
  const runtime = new Runtime()
  runtime.objects.register({
    id: 'card-1',
    type: 'project-card',
    surfaceId: 'column:todo',
    element: null,
    abilities: ['move'],
  })
  runtime.registerVisualAdapter('project-card', { resolveSource: () => null })
  runtime.surfaces.register({ id: 'column:todo', type: 'list', element: null, accepts: ['project-card'] })
  runtime.surfaces.register({ id: 'column:done', type: 'list', element: null, accepts: ['project-card'] })
  return runtime
}

function createDriver(commit: () => void | Promise<void>): MoveBehaviorDriver {
  return {
    resolveDestination: () => ({
      accepted: true,
      destination: {
        fromSurfaceId: 'column:todo',
        toSurfaceId: 'column:done',
        toIndex: 0,
      },
    }),
    commit,
  }
}

function createRequest() {
  return {
    type: 'move',
    objectId: 'card-1',
    input: { kind: 'pointerdown', event: new PointerEvent('pointerdown') },
  } as const
}

describe('Runtime move orchestration', () => {
  it('通过 Runtime 统一转发 regrab handler', () => {
    const runtime = createRuntime()
    const handler = vi.fn()
    runtime.registerRegrab('card-1', handler)
    const event = new PointerEvent('pointerdown')

    expect(runtime.regrab('card-1', event)).toBe(true)
    expect(runtime.regrab('missing', event)).toBe(false)
    expect(handler).toHaveBeenCalledWith(event)
  })

  it('按对象类型自动绑定 VisualStrategy 生命周期', async () => {
    const runtime = createRuntime()
    const events: string[] = []
    runtime.registerVisualStrategy('project-card', {
      beginDrag: () => { events.push('begin') },
      landing: () => { events.push('landing'); return { completed: true } },
      reveal: () => { events.push('reveal') },
      dispose: () => { events.push('dispose') },
    })
    const handle = runtime.start(createRequest())
    runtime.bindMoveSession(handle.id, createDriver(() => undefined))

    await runtime.release(handle.id, { kind: 'pointerup', event: new PointerEvent('pointerup') })

    expect(events).toEqual(['begin', 'landing', 'reveal', 'dispose'])
  })

  it('由 Runtime 为移动目标生成一次 MoveAction', async () => {
    const runtime = createRuntime()
    const actions: unknown[] = []
    runtime.onAction(action => actions.push(action))
    const handle = runtime.start(createRequest())
    runtime.bindMoveSession(handle.id, createDriver(() => undefined))

    await runtime.release(handle.id, { kind: 'pointerup', event: new PointerEvent('pointerup') })

    expect(actions).toEqual([expect.objectContaining({
      type: 'move',
      objectId: 'card-1',
      fromSurfaceId: 'column:todo',
      toSurfaceId: 'column:done',
      toIndex: 0,
    })])
  })

  it('将业务侧 columnId/index 落点归一为 MoveAction', async () => {
    const runtime = createRuntime()
    const actions: unknown[] = []
    runtime.onAction(action => actions.push(action))
    const handle = runtime.start(createRequest())
    runtime.bindMoveSession(handle.id, {
      resolveDestination: () => ({ accepted: true, destination: { columnId: 'done', index: 0 } }),
      commit: () => undefined,
    })

    await runtime.release(handle.id, { kind: 'pointerup', event: new PointerEvent('pointerup') })

    expect(actions).toEqual([expect.objectContaining({
      fromSurfaceId: 'column:todo',
      toSurfaceId: 'column:done',
      toIndex: 0,
    })])
  })

  it('成功路径按 landing → handoff → reveal → dispose 完成', async () => {
    const runtime = createRuntime()
    const events: string[] = []
    const lifecycle: MoveVisualLifecycle = {
      landing: () => { events.push('landing'); return { completed: true } },
      reveal: () => { events.push('reveal') },
    }
    const handle = runtime.start(createRequest())
    runtime.bindMoveSession(handle.id, createDriver(() => { events.push('commit') }))
    runtime.bindMoveLifecycle(handle.id, lifecycle)

    await runtime.release(handle.id, { kind: 'pointerup', event: new PointerEvent('pointerup') })

    expect(events).toEqual(['commit', 'landing', 'reveal'])
    expect(runtime.getSession(handle.id)).toBeUndefined()
  })

  it('由 Runtime 在 commit 前后编排布局 capture/play', async () => {
    const runtime = createRuntime()
    const events: string[] = []
    const handle = runtime.start(createRequest())
    runtime.bindMoveSession(handle.id, createDriver(() => { events.push('commit') }))
    runtime.bindMoveLifecycle(handle.id, {
      layout: {
        capture: () => { events.push('capture'); return { id: 'layout-1' } },
        play: (_context, snapshot) => { events.push(`play:${(snapshot as { id: string }).id}`) },
      },
      landing: () => ({ completed: true }),
    })

    await runtime.release(handle.id, { kind: 'pointerup', event: new PointerEvent('pointerup') })

    expect(events).toEqual(['capture', 'commit', 'play:layout-1'])
  })

  it('commit 失败时不进入 landing/reveal 且清理 session', async () => {
    const runtime = createRuntime()
    const landing = vi.fn()
    const reveal = vi.fn()
    const handle = runtime.start(createRequest())
    runtime.bindMoveSession(handle.id, createDriver(() => { throw new Error('commit failed') }))
    runtime.bindMoveLifecycle(handle.id, { landing, reveal })

    await runtime.release(handle.id, { kind: 'pointerup', event: new PointerEvent('pointerup') })

    expect(landing).not.toHaveBeenCalled()
    expect(reveal).not.toHaveBeenCalled()
    expect(runtime.getSession(handle.id)).toBeUndefined()
  })

  it('landing 失败时不触发 reveal', async () => {
    const runtime = createRuntime()
    const reveal = vi.fn()
    const handle = runtime.start(createRequest())
    runtime.bindMoveSession(handle.id, createDriver(() => undefined))
    runtime.bindMoveLifecycle(handle.id, {
      landing: () => ({ completed: false, reason: 'target-invalid' }),
      reveal,
    })

    await runtime.release(handle.id, { kind: 'pointerup', event: new PointerEvent('pointerup') })

    expect(reveal).not.toHaveBeenCalled()
    expect(runtime.getSession(handle.id)).toBeUndefined()
  })

  it('landing 被 interrupt 后，旧 Promise 完成不能触发 reveal', async () => {
    const runtime = createRuntime()
    const reveal = vi.fn()
    let resolveLanding!: (result: { completed: boolean }) => void
    const landing = new Promise<{ completed: boolean }>(resolve => { resolveLanding = resolve })
    const handle = runtime.start(createRequest())
    runtime.bindMoveSession(handle.id, createDriver(() => undefined))
    runtime.bindMoveLifecycle(handle.id, { landing: () => landing, reveal })

    const release = runtime.release(handle.id, { kind: 'pointerup', event: new PointerEvent('pointerup') })
    await Promise.resolve()
    runtime.interrupt(handle.id, 'regrab')
    resolveLanding({ completed: true })
    await release

    expect(reveal).not.toHaveBeenCalled()
    expect(runtime.getSession(handle.id)).toBeUndefined()
  })
})
