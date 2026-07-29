import { describe, expect, it, vi } from 'vitest'
import { createCardMotionController } from '../motion/CardMotionController'

describe('CardMotionController', () => {
  it('retarget 不重置当前位置和速度', () => {
    vi.useFakeTimers()
    const controller = createCardMotionController({ onFrame: () => {} })
    controller.seed({ x: 0, y: 0, vx: 200 })
    controller.setTarget({ x: 1000, y: 0 })
    controller.start()
    vi.advanceTimersByTime(80)
    const before = controller.getState()
    controller.setTarget({ x: 300, y: 0 })
    vi.advanceTimersByTime(16)
    const after = controller.getState()
    expect(after.x).toBeCloseTo(before.x, 0)
    expect(after.vx).not.toBe(0)
    controller.stop()
    vi.useRealTimers()
  })

  it('follow 模式持续输出，不自动结束，并按速度生成姿态', () => {
    vi.useFakeTimers()
    const onFrame = vi.fn()
    const arrived = vi.fn()
    const controller = createCardMotionController({
      onFrame,
      onArrived: arrived,
      mode: 'follow',
      followRotation: { tilt: 5, sway: 0.25 },
    })
    controller.setTarget({ x: 1000, y: 0 })
    controller.start()
    vi.advanceTimersByTime(16 * 20)
    expect(onFrame).toHaveBeenCalled()
    expect(arrived).not.toHaveBeenCalled()
    expect(onFrame.mock.lastCall?.[0].rotateZ).toBeGreaterThan(0)
    controller.stop()
    vi.useRealTimers()
  })

  it('settle 到达后只回调一次并停止 RAF', () => {
    vi.useFakeTimers()
    const onFrame = vi.fn()
    const arrived = vi.fn()
    const controller = createCardMotionController({
      onFrame,
      onArrived: arrived,
      arriveThreshold: { position: 1, velocity: 50 },
    })
    controller.setTarget({ x: 5, y: 0 })
    controller.start()
    vi.advanceTimersByTime(16 * 80)
    const calls = onFrame.mock.calls.length
    expect(arrived).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(16 * 10)
    expect(onFrame.mock.calls.length).toBe(calls)
    vi.useRealTimers()
  })

  it('interrupt 返回当前帧状态并停止后续 RAF', () => {
    vi.useFakeTimers()
    const onFrame = vi.fn()
    const controller = createCardMotionController({ onFrame })
    controller.seed({ x: 12, y: 24, vx: 300, vy: -40 })
    controller.setTarget({ x: 500, y: 200 })
    controller.start()
    vi.advanceTimersByTime(32)
    const interrupted = controller.interrupt()
    const calls = onFrame.mock.calls.length
    expect(interrupted.x).not.toBe(0)
    expect(interrupted.vx).not.toBe(0)
    vi.advanceTimersByTime(100)
    expect(onFrame.mock.calls.length).toBe(calls)
    vi.useRealTimers()
  })
})
