import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Cleanup } from '../cleanup/Cleanup'
import { createAutoScroller } from '../dom/AutoScroll'

function createContainer(rect: Partial<DOMRect>, scrollHeight = 1000): HTMLElement {
  const el = document.createElement('div')
  document.body.appendChild(el)
  el.getBoundingClientRect = () => ({
    left: 0, right: 200, top: 0, bottom: 400, width: 200, height: 400, x: 0, y: 0, toJSON() {},
    ...rect,
  })
  Object.defineProperty(el, 'scrollHeight', { value: scrollHeight, configurable: true })
  return el
}

describe('createAutoScroller', () => {
  let rafCallbacks: FrameRequestCallback[] = []
  beforeEach(() => {
    rafCallbacks = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb)
      return rafCallbacks.length
    })
    vi.stubGlobal('cancelAnimationFrame', () => undefined)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function tick(): void {
    const callbacks = rafCallbacks
    rafCallbacks = []
    for (const cb of callbacks) cb(0)
  }

  it('指针贴近容器底部边缘时向下滚动', () => {
    const cleanup = new Cleanup()
    const container = createContainer({ top: 0, bottom: 400 })
    const scroller = createAutoScroller(cleanup, { edgeSize: 48, maxSpeed: 16 })

    scroller.update(container, { x: 100, y: 390 })
    tick()

    expect(container.scrollTop).toBeGreaterThan(0)
  })

  it('指针贴近容器顶部边缘时向上滚动', () => {
    const cleanup = new Cleanup()
    const container = createContainer({ top: 0, bottom: 400 })
    container.scrollTop = 200
    const scroller = createAutoScroller(cleanup, { edgeSize: 48, maxSpeed: 16 })

    scroller.update(container, { x: 100, y: 10 })
    tick()

    expect(container.scrollTop).toBeLessThan(200)
  })

  it('指针在容器中间不触发滚动', () => {
    const cleanup = new Cleanup()
    const container = createContainer({ top: 0, bottom: 400 })
    const scroller = createAutoScroller(cleanup, { edgeSize: 48, maxSpeed: 16 })

    scroller.update(container, { x: 100, y: 200 })
    tick()

    expect(container.scrollTop).toBe(0)
  })

  it('指针超出容器水平范围不触发滚动', () => {
    const cleanup = new Cleanup()
    const container = createContainer({ left: 0, right: 200, top: 0, bottom: 400 })
    const scroller = createAutoScroller(cleanup, { edgeSize: 48, maxSpeed: 16 })

    scroller.update(container, { x: 300, y: 390 })
    tick()

    expect(container.scrollTop).toBe(0)
  })

  it('stop() 之后不再滚动，且 Cleanup.disposeAll() 会调用 stop', () => {
    const cleanup = new Cleanup()
    const container = createContainer({ top: 0, bottom: 400 })
    const scroller = createAutoScroller(cleanup, { edgeSize: 48, maxSpeed: 16 })

    scroller.stop()
    scroller.update(container, { x: 100, y: 390 })
    tick()
    expect(container.scrollTop).toBe(0)

    // Cleanup.disposeAll 应该能安全地再次调用 stop（幂等），不抛异常
    expect(() => cleanup.disposeAll()).not.toThrow()
  })

  it('越靠近边缘滚动速度越快', () => {
    const cleanupA = new Cleanup()
    const containerA = createContainer({ top: 0, bottom: 400 })
    const scrollerA = createAutoScroller(cleanupA, { edgeSize: 48, maxSpeed: 16 })
    scrollerA.update(containerA, { x: 100, y: 399 }) // 距边缘 1px
    tick()
    const fastSpeed = containerA.scrollTop

    const cleanupB = new Cleanup()
    const containerB = createContainer({ top: 0, bottom: 400 })
    const scrollerB = createAutoScroller(cleanupB, { edgeSize: 48, maxSpeed: 16 })
    scrollerB.update(containerB, { x: 100, y: 360 }) // 距边缘 40px
    tick()
    const slowSpeed = containerB.scrollTop

    expect(fastSpeed).toBeGreaterThan(slowSpeed)
  })
})
