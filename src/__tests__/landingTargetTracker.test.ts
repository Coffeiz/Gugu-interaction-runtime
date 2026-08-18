import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { Cleanup } from '../cleanup/Cleanup'
import { trackLandingTarget } from '../dom/LandingTargetTracker'
import { animateRafTransform, cancelRafTransform, readRafVisualOffset } from '../dom/RafLayoutAnimator'

describe('LandingTargetTracker retarget', () => {
  let cleanup: Cleanup
  let target: HTMLElement

  beforeEach(() => {
    cleanup = new Cleanup()
    target = document.createElement('div')
    document.body.appendChild(target)
  })

  afterEach(() => {
    cancelRafTransform(target)
    cleanup.disposeAll()
    target.remove()
    vi.restoreAllMocks()
  })

  function createTracker() {
    const rafQueue: Array<(() => void) | null> = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      const wrapped = () => { cb(performance.now()) }
      rafQueue.push(wrapped)
      return rafQueue.length
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id: number) => {
      if (id > 0 && id <= rafQueue.length) rafQueue[id - 1] = null
    })
    if (typeof ResizeObserver === 'undefined') {
      ;(window as any).ResizeObserver = class {
        observe() { /* noop */ }
        disconnect() { /* noop */ }
      }
    }
    return rafQueue
  }

  function runFrame(queue: Array<(() => void) | null>, index: number): void {
    const callback = queue[index]
    if (callback) callback()
  }

  it('rAF 轮询检测到位置变化时调用 retarget', async () => {
    const rafQueue = createTracker()
    const spy = vi.fn()
    target.getBoundingClientRect = () => new DOMRect(0, 0, 100, 50)

    trackLandingTarget({ cleanup, target, retarget: spy })

    expect(rafQueue.length).toBe(1)
    runFrame(rafQueue, 0)
    expect(spy).toHaveBeenCalledTimes(1)

    // 稳定几帧后轮询会降频；下一次有效采样仍会发现位移。
    await new Promise(r => setTimeout(r, 100))
    target.getBoundingClientRect = () => new DOMRect(50, 0, 100, 50)
    runFrame(rafQueue, 1)
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('位置未变化时不重复调用 retarget', () => {
    const rafQueue = createTracker()
    const spy = vi.fn()
    target.getBoundingClientRect = () => new DOMRect(10, 20, 100, 50)

    trackLandingTarget({ cleanup, target, retarget: spy })

    runFrame(rafQueue, 0)
    expect(spy).toHaveBeenCalledTimes(1)

    runFrame(rafQueue, 1)
    runFrame(rafQueue, 2)
    runFrame(rafQueue, 3)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('Runtime-owned FLIP 有 initialRect 时每帧不再读取 DOM geometry', () => {
    const rafQueue = createTracker()
    vi.spyOn(performance, 'now').mockReturnValue(0)
    const rectSpy = vi.spyOn(target, 'getBoundingClientRect')
      .mockReturnValue(new DOMRect(100, 20, 120, 60))
    const retarget = vi.fn()

    animateRafTransform(target, 100, 0, 1000, 'cubic-bezier(.22,1,.36,1)')
    expect(readRafVisualOffset(target, 0)).toEqual({ x: 100, y: 0 })

    trackLandingTarget({
      cleanup,
      target,
      retarget,
      initialRect: new DOMRect(100, 20, 120, 60),
    })

    // queue[0] 是共享 FLIP scheduler，queue[1] 是 tracker。只推进 tracker；
    // active Runtime trajectory 应完全由数学轨迹得到，不调用 gBCR。
    runFrame(rafQueue, 1)
    expect(rectSpy).not.toHaveBeenCalled()
  })

  it('其它 Runtime layout 动画仍在运行时新 target 也不做 fallback geometry polling', () => {
    const rafQueue = createTracker()
    vi.spyOn(performance, 'now').mockReturnValue(0)
    const sibling = document.createElement('div')
    document.body.appendChild(sibling)
    const rectSpy = vi.spyOn(target, 'getBoundingClientRect')
      .mockReturnValue(new DOMRect(20, 30, 120, 60))

    animateRafTransform(sibling, 60, 0, 1000, 'cubic-bezier(.22,1,.36,1)')
    trackLandingTarget({
      cleanup,
      target,
      retarget: vi.fn(),
      initialRect: new DOMRect(20, 30, 120, 60),
    })

    runFrame(rafQueue, 1)
    expect(rectSpy).not.toHaveBeenCalled()

    cancelRafTransform(sibling)
    sibling.remove()
  })

  it('Relative FLIP 会合成祖先和目标自身的 Runtime 位移', () => {
    const rafQueue = createTracker()
    vi.spyOn(performance, 'now').mockReturnValue(0)
    const parent = document.createElement('div')
    parent.appendChild(target)
    document.body.appendChild(parent)

    animateRafTransform(parent, 40, 10, 1000, 'cubic-bezier(.22,1,.36,1)')
    animateRafTransform(target, 5, -3, 1000, 'cubic-bezier(.22,1,.36,1)')

    // 两个元素登记到同一个 scheduler，不应各自创建一条初始 rAF。
    expect(rafQueue.length).toBe(1)
    expect(readRafVisualOffset(target, 0)).toEqual({ x: 45, y: 7 })

    cancelRafTransform(parent)
    parent.remove()
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
