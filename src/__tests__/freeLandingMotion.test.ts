import { describe, expect, it, vi } from 'vitest'
import { createCubicBezierEasing, createFreeLandingMotion, resolveFreeLandingEasing, resolveFreeLandingPoint } from '../motion/FreeLandingMotion'

describe('FreeLandingMotion', () => {
  it('physical 释放会把最终落点沿速度方向外推', () => {
    expect(resolveFreeLandingPoint({ x: 100, y: 80 }, { x: 500, y: 0 }, 'physical'))
      .toEqual({ x: 160, y: 80 })
  })

  it('normal 释放保持鼠标落点，不使用惯性外推', () => {
    expect(resolveFreeLandingPoint({ x: 100, y: 80 }, { x: 500, y: 0 }, 'normal'))
      .toEqual({ x: 100, y: 80 })
  })

  it('使用与 CSS 相同的 cubic-bezier 时间进度，并保持单调', () => {
    const easing = createCubicBezierEasing(0.22, 1, 0.36, 1)
    expect(easing(0)).toBeCloseTo(0, 6)
    expect(easing(1)).toBeCloseTo(1, 6)
    expect(easing(0.25)).toBeGreaterThan(0.25)
    expect(easing(0.5)).toBeGreaterThan(easing(0.25))
    expect(easing(0.75)).toBeGreaterThan(easing(0.5))
    expect(resolveFreeLandingEasing('cubic-bezier(.22,1,.36,1)')(0.5)).toBeCloseTo(easing(0.5), 6)
  })

  it('按缓出曲线单调到达目标，不产生弹簧回弹', () => {
    vi.useFakeTimers()
    const frames: number[] = []
    const arrived = vi.fn()
    const motion = createFreeLandingMotion({
      duration: 550,
      easing: 'cubic-bezier(.22,1,.36,1)',
      onFrame: frame => frames.push(frame.x),
      onArrived: arrived,
    })
    motion.seed({ x: 0, y: 0, rotateX: 5, rotateZ: -2 })
    motion.setTarget({ x: 300, y: 0, scaleX: 1, scaleY: 1 })
    motion.start()
    vi.advanceTimersByTime(700)

    expect(arrived).toHaveBeenCalledOnce()
    expect(frames[frames.length - 1]).toBeCloseTo(300, 3)
    expect(frames.every((value, index) => index === 0 || value >= frames[index - 1])).toBe(true)
    vi.useRealTimers()
  })

  it('启动时不重复发出起点帧，避免 landing 首段停顿后突然加速', () => {
    vi.useFakeTimers()
    const frames: number[] = []
    const motion = createFreeLandingMotion({
      duration: 550,
      easing: 'cubic-bezier(.22,1,.36,1)',
      onFrame: frame => frames.push(frame.x),
    })
    motion.seed({ x: 0, y: 0 })
    motion.setTarget({ x: 300, y: 0 })
    motion.start()

    expect(frames).toHaveLength(0)
    vi.advanceTimersByTime(16)
    expect(frames.length).toBeGreaterThan(0)
    expect(frames[0]).toBeGreaterThan(0)
    motion.stop()
    vi.useRealTimers()
  })

  it('retarget 从当前视觉位置接管，不回到旧起点', () => {
    vi.useFakeTimers()
    const frames: number[] = []
    const motion = createFreeLandingMotion({
      duration: 550,
      easing: 'cubic-bezier(.22,1,.36,1)',
      onFrame: frame => frames.push(frame.x),
    })
    motion.seed({ x: 0, y: 0 })
    motion.setTarget({ x: 300, y: 0 })
    motion.start()
    vi.advanceTimersByTime(220)
    const before = frames[frames.length - 1] ?? 0
    motion.retarget({ x: 600, y: 0 })
    vi.advanceTimersByTime(16)

    expect(frames[frames.length - 1]).toBeGreaterThanOrEqual(before)
    expect(frames[frames.length - 1]).not.toBe(0)
    motion.stop()
    vi.useRealTimers()
  })
})
