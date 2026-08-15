import { describe, expect, it, vi } from 'vitest'
import { Runtime } from '../Runtime'
import { resolveDetachRegrabTarget, startDetachLandingVisual } from '../runtime/DetachMoveDriver'

function rect(width: number, height: number): DOMRect {
  return {
    left: 10,
    top: 20,
    right: 10 + width,
    bottom: 20 + height,
    width,
    height,
    x: 10,
    y: 20,
    toJSON: () => ({}),
  } as DOMRect
}

describe('landing snapshot Phase 4 异常接力', () => {
  it('regrab 不接管断开或零尺寸节点，避免从左上角重建代理', () => {
    const root = document.createElement('div')
    const zero = document.createElement('div')
    const valid = document.createElement('div')
    root.append(zero, valid)
    document.body.append(root)
    zero.getBoundingClientRect = () => rect(0, 0)
    valid.getBoundingClientRect = () => rect(120, 48)

    expect(resolveDetachRegrabTarget(() => zero, () => null)).toBeNull()
    expect(resolveDetachRegrabTarget(() => valid, () => null)).toBe(valid)

    valid.remove()
    root.remove()
    expect(resolveDetachRegrabTarget(() => valid, () => null)).toBeNull()
  })

  it('landing 适配器失败时通过统一完成回调结束异常路径', async () => {
    const complete = vi.fn()
    const proxy = document.createElement('div')
    document.body.append(proxy)

    startDetachLandingVisual({
      createProxy: () => ({ element: proxy }),
      enableProxy: vi.fn(),
      bindRegrab: vi.fn(),
      land: async () => { throw new Error('visual failure') },
      onMissing: vi.fn(),
      onComplete: complete,
    })

    await vi.waitFor(() => expect(complete).toHaveBeenCalledWith({ completed: false, reason: 'landing-error' }))
    proxy.remove()
  })

  it('Runtime 不为断开或零尺寸节点创建 regrab 上下文', () => {
    const runtime = new Runtime()
    const handle = runtime.start({
      type: 'move',
      objectId: 'card-1',
      input: { kind: 'pointerdown', event: new PointerEvent('pointerdown') },
    } as never)
    const session = runtime.getSession(handle.id)!
    session.transition('active')
    session.transition('landing')
    const proxy = document.createElement('div')
    const source = document.createElement('div')
    document.body.append(proxy, source)
    proxy.getBoundingClientRect = () => rect(0, 0)
    source.getBoundingClientRect = () => rect(120, 48)

    expect(runtime.createRegrabContext(handle.id, new PointerEvent('pointerdown'), proxy, source)).toBeNull()
    proxy.remove()
    expect(runtime.createRegrabContext(handle.id, new PointerEvent('pointerdown'), proxy, source)).toBeNull()
    source.remove()
  })

})
