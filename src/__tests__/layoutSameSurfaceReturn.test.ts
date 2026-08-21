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

describe('same-Surface detach return FLIP', () => {
  it('source 恢复到原 index 时兄弟卡仍执行 release FLIP，而不是瞬间跳 final layout', () => {
    const surface = document.createElement('section')
    surface.dataset.layoutSurface = 'same'
    const list = document.createElement('div')
    const prefix = document.createElement('article')
    prefix.dataset.layoutRole = 'card'
    prefix.dataset.layoutKey = 'prefix'
    const source = document.createElement('article')
    source.dataset.layoutRole = 'card'
    source.dataset.layoutKey = 'moving'
    const sibling1 = document.createElement('article')
    sibling1.dataset.layoutRole = 'card'
    sibling1.dataset.layoutKey = 'sibling-1'
    const sibling2 = document.createElement('article')
    sibling2.dataset.layoutRole = 'card'
    sibling2.dataset.layoutKey = 'sibling-2'
    list.append(prefix, source, sibling1, sibling2)
    surface.append(list)
    document.body.append(surface)

    let phase: 'vacated' | 'restored' = 'vacated'
    source.style.display = 'none'
    mockRect(surface, () => ({ left: 0, top: 0, width: 300, height: 260 }))
    const prefixSpy = mockRect(prefix, () => ({ left: 0, top: 10, width: 260, height: 50 }))
    const sibling1Spy = mockRect(sibling1, () => ({
      left: 0,
      top: phase === 'vacated' ? 70 : 130,
      width: 260,
      height: 50,
    }))
    const sibling2Spy = mockRect(sibling2, () => ({
      left: 0,
      top: phase === 'vacated' ? 130 : 190,
      width: 260,
      height: 50,
    }))

    const snapshot = captureLayoutFlip(
      [prefix, sibling1, sibling2],
      document,
      false,
      undefined,
      {
        scopeSurfaces: [surface],
        focus: { sourceElement: source, layoutKey: 'moving', mode: 'move' },
      },
    )

    phase = 'restored'
    source.style.display = ''
    playLayoutFlip(snapshot)

    const telemetry = getLastLayoutFlipTelemetry()
    expect(telemetry?.candidateCards).toBe(3)
    expect(telemetry?.eligibleCards).toBe(2)
    expect(telemetry?.measuredCards).toBe(2)
    expect(telemetry?.animatedCards).toBe(2)
    expect(prefixSpy).toHaveBeenCalledTimes(1)
    expect(sibling1Spy).toHaveBeenCalledTimes(2)
    expect(sibling2Spy).toHaveBeenCalledTimes(2)
  })
})
