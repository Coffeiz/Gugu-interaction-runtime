import { afterEach, describe, expect, it, vi } from 'vitest'
import { captureLayoutFlip, getLastLayoutFlipTelemetry, playLayoutFlip } from '../dom/GroupLayout'

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

function mockRect(
  element: HTMLElement,
  read: () => { left: number; top: number; width: number; height: number },
) {
  return vi.spyOn(element, 'getBoundingClientRect').mockImplementation(() => {
    const rect = read()
    return new DOMRect(rect.left, rect.top, rect.width, rect.height)
  })
}

describe('Layout FLIP participant reduction', () => {
  it('release 只二次测量 destination 后缀中的 viewport participant', () => {
    const surface = document.createElement('section')
    surface.dataset.layoutSurface = 'test'
    const viewport = document.createElement('div')
    viewport.dataset.scrollViewport = ''
    const list = document.createElement('div')
    viewport.append(list)
    surface.append(viewport)
    document.body.append(surface)

    const before = document.createElement('article')
    before.dataset.layoutRole = 'card'
    before.dataset.layoutKey = 'before'
    const source = document.createElement('article')
    source.dataset.layoutRole = 'card'
    source.dataset.layoutKey = 'moving'
    const near = document.createElement('article')
    near.dataset.layoutRole = 'card'
    near.dataset.layoutKey = 'near'
    const far = document.createElement('article')
    far.dataset.layoutRole = 'card'
    far.dataset.layoutKey = 'far'

    // Release capture happens while the source is detached/floating: siblings already occupy
    // their pickup layout. The business mutation later inserts the semantic source again.
    list.append(before, near, far)

    let phase: 'before' | 'after' = 'before'
    mockRect(surface, () => ({ left: 0, top: 0, width: 300, height: 300 }))
    mockRect(viewport, () => ({ left: 0, top: 0, width: 300, height: 300 }))
    const beforeSpy = mockRect(before, () => ({ left: 0, top: 10, width: 250, height: 50 }))
    const nearSpy = mockRect(near, () => ({
      left: 0,
      top: phase === 'before' ? 70 : 130,
      width: 250,
      height: 50,
    }))
    const farSpy = mockRect(far, () => ({
      left: 0,
      top: phase === 'before' ? 900 : 960,
      width: 250,
      height: 50,
    }))

    const snapshot = captureLayoutFlip(
      [before, near, far],
      document,
      false,
      undefined,
      {
        scopeSurfaces: [surface],
        viewportBySurface: new Map([[surface, viewport]]),
        focus: { sourceElement: source, layoutKey: 'moving', mode: 'move' },
      },
    )

    phase = 'after'
    list.insertBefore(source, near)
    playLayoutFlip(snapshot)

    const telemetry = getLastLayoutFlipTelemetry()
    expect(telemetry).not.toBeNull()
    expect(telemetry?.candidateCards).toBe(3)
    expect(telemetry?.eligibleCards).toBe(1)
    expect(telemetry?.rangeSkipped).toBe(1)
    expect(telemetry?.offscreenSkipped).toBe(1)
    expect(telemetry?.measuredCards).toBe(1)
    expect(telemetry?.animatedCards).toBe(1)

    // All three cards are captured once. At play only `near` gets an after-rect read:
    // prefix (`before`) and far-offscreen (`far`) never perform the second measurement.
    expect(beforeSpy).toHaveBeenCalledTimes(1)
    expect(nearSpy).toHaveBeenCalledTimes(2)
    expect(farSpy).toHaveBeenCalledTimes(1)
  })

  it('pickup/removal 在 capture 阶段就裁掉 source 前缀', () => {
    const surface = document.createElement('section')
    surface.dataset.layoutSurface = 'test'
    const list = document.createElement('div')
    surface.append(list)
    document.body.append(surface)

    const prefix = document.createElement('article')
    prefix.dataset.layoutRole = 'card'
    const source = document.createElement('article')
    source.dataset.layoutRole = 'card'
    source.dataset.layoutKey = 'moving'
    const suffix1 = document.createElement('article')
    suffix1.dataset.layoutRole = 'card'
    const suffix2 = document.createElement('article')
    suffix2.dataset.layoutRole = 'card'
    list.append(prefix, source, suffix1, suffix2)

    mockRect(surface, () => ({ left: 0, top: 0, width: 300, height: 300 }))
    const prefixSpy = mockRect(prefix, () => ({ left: 0, top: 0, width: 250, height: 50 }))
    const suffix1Spy = mockRect(suffix1, () => ({ left: 0, top: 100, width: 250, height: 50 }))
    const suffix2Spy = mockRect(suffix2, () => ({ left: 0, top: 160, width: 250, height: 50 }))

    const snapshot = captureLayoutFlip(
      [prefix, suffix1, suffix2],
      document,
      false,
      undefined,
      {
        scopeSurfaces: [surface],
        focus: { sourceElement: source, layoutKey: 'moving', mode: 'removal' },
      },
    )

    expect(snapshot.participants?.candidateCards).toBe(3)
    expect(snapshot.participants?.capturedCards).toBe(2)
    expect(prefixSpy).not.toHaveBeenCalled()
    expect(suffix1Spy).toHaveBeenCalledTimes(1)
    expect(suffix2Spy).toHaveBeenCalledTimes(1)
  })
})
