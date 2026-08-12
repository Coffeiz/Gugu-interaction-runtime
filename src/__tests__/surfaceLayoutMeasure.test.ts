import { describe, expect, it, vi } from 'vitest'
import { captureSurfaceLayout, playSurfaceResize } from '../dom/GroupLayout'

function mockRect(element: HTMLElement, height: number): void {
  element.getBoundingClientRect = () => ({
    top: 0,
    left: 0,
    width: 280,
    height,
    right: 280,
    bottom: height,
    x: 0,
    y: 0,
    toJSON() {},
  } as DOMRect)
}

describe('Surface 自然尺寸 FLIP', () => {
  it('固定 viewport 盒子未变时仍按 measureLayout 播放目标高度', () => {
    vi.useFakeTimers()
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      return window.setTimeout(() => callback(performance.now()), 16)
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)

    const viewport = document.createElement('div')
    viewport.style.boxSizing = 'border-box'
    mockRect(viewport, 240)
    document.body.append(viewport)
    const measure = vi.fn(() => ({ height: 120 }))
    const snapshot = captureSurfaceLayout(
      [viewport],
      undefined,
      new Map([[viewport, measure]]),
    )

    expect(viewport.dataset.runtimeLayoutTransaction).toBe('true')
    playSurfaceResize(snapshot, 20, 'linear')
    expect(measure).toHaveBeenCalled()
    vi.advanceTimersByTime(32)
    const animatedHeight = Number.parseFloat(viewport.style.height)
    expect(animatedHeight).toBeGreaterThan(120)
    expect(animatedHeight).toBeLessThanOrEqual(240)

    vi.advanceTimersByTime(1000)
    expect(viewport.style.height).toBe('120px')
    expect(viewport.dataset.runtimeLayoutTransaction).toBeUndefined()
    expect(viewport.dataset.runtimeSurfaceResize).toBeUndefined()

    viewport.remove()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })
})
