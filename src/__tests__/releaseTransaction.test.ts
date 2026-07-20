/**
 * release transaction 回归测试。
 *
 * 验证 resolveDestination → commit → landing → reveal 生命周期在
 * clone/detach 两种策略下的行为一致性。
 */

import { describe, it, expect, vi } from 'vitest'
import { MoveBehavior, type MoveBehaviorDriver, type MoveVisualLifecycle } from '../behavior/MoveBehavior'
import type { BehaviorContext } from '../behavior/Behavior'
import type { RuntimeInput, StartRequest } from '../core/Interaction'

function createMockContext(): BehaviorContext {
  return {
    session: {
      id: 'test-session',
      state: 'active',
      type: 'move',
      objectId: 'test-card',
    } as any,
    emitAction: () => undefined,
    visual: undefined,
    hit: null,
  }
}

function createMockRequest(): StartRequest {
  return {
    type: 'move',
    objectId: 'test-card',
    input: { kind: 'pointerdown', event: new PointerEvent('pointerdown') },
  }
}

describe('release transaction', () => {
  it('clone cross-column: resolveDestination + commit + landing + reveal', async () => {
    const behavior = new MoveBehavior()
    const sessionId = 'test-session'
    const commit = vi.fn()
    const landing = vi.fn().mockResolvedValue({ completed: true })
    const reveal = vi.fn()

    behavior.bindSession(sessionId, {
      resolveDestination: () => ({ accepted: true, destination: { columnId: 'done', index: 0 } }),
      commit,
    })
    behavior.bindLifecycle(sessionId, { landing, reveal })

    const context = createMockContext()
    const result = await behavior.release(context, { kind: 'pointerup', event: new PointerEvent('pointerup') })
    const releaseResult = result as { accepted: boolean; destination: unknown }

    expect(releaseResult.accepted).toBe(true)
    expect(releaseResult.destination).toEqual({ columnId: 'done', index: 0 })

    await behavior.commit(context, releaseResult.destination)
    expect(commit).toHaveBeenCalledOnce()

    await behavior.landing(context, releaseResult.destination)
    expect(landing).toHaveBeenCalledOnce()

    await behavior.reveal(context, releaseResult.destination)
    expect(reveal).toHaveBeenCalledOnce()
  })

  it('detach cross-column: resolveDestination + commit + landing + reveal', async () => {
    const behavior = new MoveBehavior()
    const sessionId = 'test-session'
    const commit = vi.fn()
    const landing = vi.fn().mockResolvedValue({ completed: true })
    const reveal = vi.fn()

    behavior.bindSession(sessionId, {
      resolveDestination: () => ({ accepted: true, destination: { columnId: 'doing', index: 2 } }),
      commit,
    })
    behavior.bindLifecycle(sessionId, { landing, reveal })

    const context = createMockContext()
    const result = await behavior.release(context, { kind: 'pointerup', event: new PointerEvent('pointerup') })
    const releaseResult = result as { accepted: boolean; destination: unknown }

    expect(releaseResult.accepted).toBe(true)
    expect(releaseResult.destination).toEqual({ columnId: 'doing', index: 2 })

    await behavior.commit(context, releaseResult.destination)
    expect(commit).toHaveBeenCalledOnce()

    await behavior.landing(context, releaseResult.destination)
    expect(landing).toHaveBeenCalledOnce()

    await behavior.reveal(context, releaseResult.destination)
    expect(reveal).toHaveBeenCalledOnce()
  })

  it('invalid drop: resolveDestination returns accepted=false', async () => {
    const behavior = new MoveBehavior()
    const sessionId = 'test-session'
    const commit = vi.fn()

    behavior.bindSession(sessionId, {
      resolveDestination: () => ({ accepted: false }),
      commit,
    })

    const context = createMockContext()
    const result = await behavior.release(context, { kind: 'pointerup', event: new PointerEvent('pointerup') })
    const releaseResult = result as { accepted: boolean }

    expect(releaseResult.accepted).toBe(false)
    // commit 不应被调用
    expect(commit).not.toHaveBeenCalled()
  })

  it('regrab: resolveDestination + commit + landing + reveal', async () => {
    const behavior = new MoveBehavior()
    const sessionId = 'test-session'
    const commit = vi.fn()
    const landing = vi.fn().mockResolvedValue({ completed: true })
    const reveal = vi.fn()

    behavior.bindSession(sessionId, {
      resolveDestination: () => ({ accepted: true, destination: { columnId: 'todo', index: 1 } }),
      commit,
    })
    behavior.bindLifecycle(sessionId, { landing, reveal })

    const context = createMockContext()
    const result = await behavior.release(context, { kind: 'pointerup', event: new PointerEvent('pointerup') })
    const releaseResult = result as { accepted: boolean; destination: unknown }

    expect(releaseResult.accepted).toBe(true)
    expect(releaseResult.destination).toEqual({ columnId: 'todo', index: 1 })

    await behavior.commit(context, releaseResult.destination)
    expect(commit).toHaveBeenCalledOnce()

    await behavior.landing(context, releaseResult.destination)
    expect(landing).toHaveBeenCalledOnce()

    await behavior.reveal(context, releaseResult.destination)
    expect(reveal).toHaveBeenCalledOnce()
  })

  it('legacy release fallback: accepted', async () => {
    const behavior = new MoveBehavior()
    const sessionId = 'test-session'
    const release = vi.fn().mockResolvedValue({ accepted: true, destination: { columnId: 'done', index: 3 } })

    behavior.bindSession(sessionId, { release })

    const context = createMockContext()
    const result = await behavior.release(context, { kind: 'pointerup', event: new PointerEvent('pointerup') })
    const releaseResult = result as { accepted: boolean; destination: unknown }

    expect(releaseResult.accepted).toBe(true)
    expect(releaseResult.destination).toEqual({ columnId: 'done', index: 3 })
    expect(release).toHaveBeenCalledOnce()
  })

  it('legacy release fallback: rejected', async () => {
    const behavior = new MoveBehavior()
    const sessionId = 'test-session'
    const release = vi.fn().mockResolvedValue({ accepted: false })

    behavior.bindSession(sessionId, { release })

    const context = createMockContext()
    const result = await behavior.release(context, { kind: 'pointerup', event: new PointerEvent('pointerup') })
    const releaseResult = result as { accepted: boolean }

    expect(releaseResult.accepted).toBe(false)
    expect(release).toHaveBeenCalledOnce()
  })

  it('resolveDestination takes priority over legacy release', async () => {
    const behavior = new MoveBehavior()
    const sessionId = 'test-session'
    const resolveDestination = vi.fn().mockResolvedValue({ accepted: true, destination: { columnId: 'done', index: 0 } })
    const release = vi.fn()

    // 同时提供 resolveDestination 和 release，应优先走 resolveDestination
    behavior.bindSession(sessionId, { resolveDestination, release })

    const context = createMockContext()
    const result = await behavior.release(context, { kind: 'pointerup', event: new PointerEvent('pointerup') })
    const releaseResult = result as { accepted: boolean; destination: unknown }

    expect(releaseResult.accepted).toBe(true)
    expect(releaseResult.destination).toEqual({ columnId: 'done', index: 0 })
    expect(resolveDestination).toHaveBeenCalledOnce()
    expect(release).not.toHaveBeenCalled()
  })

  it('commit stores destination in MoveContext', async () => {
    const behavior = new MoveBehavior()
    const sessionId = 'test-session'
    const destination = { columnId: 'done', index: 0 }

    behavior.bindSession(sessionId, {
      resolveDestination: () => ({ accepted: true, destination }),
      commit: () => undefined,
    })

    const context = createMockContext()
    await behavior.release(context, { kind: 'pointerup', event: new PointerEvent('pointerup') })

    const moveContext = behavior.getContext(sessionId)
    expect(moveContext.destination).toEqual(destination)
  })
})