import { describe, expect, it, vi } from 'vitest'
import { captureDetachTargetSnapshot, completeDetachLanding } from '../runtime/DetachMoveDriver'

describe('detach landing completion gate', () => {
  it('捕获交接目标时忽略临时 opacity:0，但恢复目标原状态', () => {
    const element = document.createElement('div')
    element.style.opacity = '0'
    document.body.append(element)

    const snapshot = captureDetachTargetSnapshot(
      target => ({
        rect: target.getBoundingClientRect(),
        borderRadius: '',
        boxShadow: '',
        border: '',
        backdropFilter: '',
        background: '',
        // 模拟 CSS 动画仍让 computedStyle 返回 0；快照层必须归一化它。
        opacity: '0',
        transform: 'none',
      }),
      element,
      { ignoreTemporaryOpacity: true },
    )

    expect(snapshot.opacity).toBe('1')
    expect(element.style.opacity).toBe('0')
    element.remove()
  })

  it('只有 landing 成功才携带 reveal', () => {
    const complete = vi.fn()
    const reveal = vi.fn()

    completeDetachLanding({
      active: true,
      result: { completed: false, reason: 'cancelled' },
      complete,
      reveal,
    })

    expect(complete).toHaveBeenCalledWith({
      completed: false,
      reason: 'cancelled',
      reveal: undefined,
    })
    expect(reveal).not.toHaveBeenCalled()
  })

  it('非 active session 不写入完成门', () => {
    const complete = vi.fn()
    completeDetachLanding({
      active: false,
      result: { completed: true },
      complete,
      reveal: vi.fn(),
    })
    expect(complete).not.toHaveBeenCalled()
  })

  it('成功结果只通过一次完成回调交接 reveal', () => {
    const complete = vi.fn()
    const reveal = vi.fn()
    completeDetachLanding({
      active: true,
      result: { completed: true, reason: '' },
      complete,
      reveal,
    })
    expect(complete).toHaveBeenCalledOnce()
    const result = complete.mock.calls[0][0]
    expect(result.completed).toBe(true)
    result.reveal?.()
    expect(reveal).toHaveBeenCalledOnce()
  })
})
