import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { Cleanup } from '../cleanup/Cleanup'
import { trackLandingTarget } from '../dom/LandingTargetTracker'

describe('LandingTargetTracker retarget', () => {
  let cleanup: Cleanup
  let target: HTMLElement
  let retarget: ReturnType<typeof vi.fn>
  let rafQueue: Array<() => void>

  beforeEach(() => {
    cleanup = new Cleanup()
    target = document.createElement('div')
    document.body.appendChild(target)
    retarget = vi.fn()
    rafQueue = []

    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
      rafQueue.push(cb)
      return rafQueue.length
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {
      rafQueue.length = 0
    })
    // 确保 ResizeObserver 可用
    if (typeof ResizeObserver === 'undefined') {
      ;(window as any).ResizeObserver = class {
        observe() { /* noop */ }
        disconnect() { /* noop */ }
      }
    }
  })

  afterEach(() => {
    cleanup.disposeAll()
    target.remove()
    vi.restoreAllMocks()
  })

  it('rAF 轮询检测到位置变化时调用 retarget', () => {
    // mock 位置
    target.getBoundingClientRect = () => new DOMRect(0, 0, 100, 50)

    trackLandingTarget({ cleanup, target, retarget })

    expect(rafQueue.length).toBe(1)

    // 第一帧 poll：lastRect 为 null，应 retarget 一次
    rafQueue[0]()
    expect(retarget).toHaveBeenCalledTimes(1)
    expect(retarget.mock.calls[0][0]).toEqual(new DOMRect(0, 0, 100, 50))

    // 改变位置（模拟 FLIP transform 位移）
    target.getBoundingClientRect = () => new DOMRect(50, 0, 100, 50)

    // 第二帧 poll
    rafQueue[1]()
    expect(retarget).toHaveBeenCalledTimes(2)
    expect(retarget.mock.calls[1][0]).toEqual(new DOMRect(50, 0, 100, 50))
  })

  it('位置未变化时不重复调用 retarget', () => {
    target.getBoundingClientRect = () => new DOMRect(10, 20, 100, 50)

    trackLandingTarget({ cleanup, target, retarget })

    rafQueue[0]()
    expect(retarget).toHaveBeenCalledTimes(1)

    // 同一位置再 poll 一次
    rafQueue[1]()
    expect(retarget).toHaveBeenCalledTimes(1)
  })

  it('cleanup 后停止 rAF 轮询', () => {
    target.getBoundingClientRect = () => new DOMRect(50, 0, 100, 50)

    const stop = trackLandingTarget({ cleanup, target, retarget })
    stop()

    // poll 被 stop 裁掉了，rafQueue 里不应该有值
    expect(retarget).not.toHaveBeenCalled()
  })

  it('ResizeObserver 触发尺寸变化时调用 retarget', () => {
    // 不 mock ResizeObserver，用真实的
    vi.restoreAllMocks()
    cleanup = new Cleanup()

    // 重新 mock rAF 但用真实的 setTimeout 驱动
    let rafId: number
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
      rafId = setTimeout(cb, 1) as unknown as number
      return rafId
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => {
      clearTimeout(id)
    })

    const resizeCallback: (entries: ResizeObserverEntry[]) => void = vi.fn()
    const OrigObserver = window.ResizeObserver
    ;(window as any).ResizeObserver = class MockRO {
      constructor(cb: (entries: ResizeObserverEntry[]) => void) {
        resizeCallback.mockImplementation(cb)
      }
      observe() { /* noop */ }
      disconnect() { /* noop */ }
    }

    trackLandingTarget({ cleanup, target, retarget })

    // 模拟尺寸变化
    target.getBoundingClientRect = () => new DOMRect(0, 0, 300, 150)
    retarget(target.getBoundingClientRect())
    expect(retarget).toHaveBeenCalledWith(new DOMRect(0, 0, 300, 150))

    ;(window as any).ResizeObserver = OrigObserver
  })
})
