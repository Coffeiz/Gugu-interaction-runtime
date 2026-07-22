import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { Cleanup } from '../cleanup/Cleanup'
import { trackLandingTarget } from '../dom/LandingTargetTracker'

describe('LandingTargetTracker retarget', () => {
  let cleanup: Cleanup
  let target: HTMLElement

  beforeEach(() => {
    cleanup = new Cleanup()
    target = document.createElement('div')
    document.body.appendChild(target)
  })

  afterEach(() => {
    cleanup.disposeAll()
    target.remove()
    vi.restoreAllMocks()
  })

  function createTracker() {
    const rafQueue: Array<() => void> = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      const wrapped = () => { cb(performance.now()) }
      rafQueue.push(wrapped)
      return rafQueue.length
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {
      rafQueue.length = 0
    })
    if (typeof ResizeObserver === 'undefined') {
      ;(window as any).ResizeObserver = class {
        observe() { /* noop */ }
        disconnect() { /* noop */ }
      }
    }
    return rafQueue
  }

  it('rAF 轮询检测到位置变化时调用 retarget', async () => {
    const rafQueue = createTracker()
    const spy = vi.fn()
    target.getBoundingClientRect = () => new DOMRect(0, 0, 100, 50)

    trackLandingTarget({ cleanup, target, retarget: spy })

    expect(rafQueue.length).toBe(1)
    rafQueue[0]()
    expect(spy).toHaveBeenCalledTimes(1)

    // 模拟过了 80ms 冷却
    await new Promise(r => setTimeout(r, 100))
    target.getBoundingClientRect = () => new DOMRect(50, 0, 100, 50)
    rafQueue[1]()
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('位置未变化时不重复调用 retarget', () => {
    const rafQueue = createTracker()
    const spy = vi.fn()
    target.getBoundingClientRect = () => new DOMRect(10, 20, 100, 50)

    trackLandingTarget({ cleanup, target, retarget: spy })

    rafQueue[0]()
    expect(spy).toHaveBeenCalledTimes(1)

    rafQueue[1]()
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('cleanup 后停止 rAF 轮询', () => {
    createTracker()
    const spy = vi.fn()
    target.getBoundingClientRect = () => new DOMRect(50, 0, 100, 50)

    const stop = trackLandingTarget({ cleanup, target, retarget: spy })
    stop()

    expect(spy).not.toHaveBeenCalled()
  })
})
