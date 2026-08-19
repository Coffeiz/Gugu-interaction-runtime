import { afterEach, describe, expect, it, vi } from 'vitest'
import { captureLayoutFlip, getLastLayoutFlipTelemetry, playLayoutFlip } from '../dom/GroupLayout'
import { captureSourceAffectedCards } from '../dom/LayoutParticipantPolicy'

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

function makeCarrier(key: string): { carrier: HTMLElement; runtime: HTMLElement } {
  const carrier = document.createElement('article')
  carrier.dataset.layoutRole = 'card'
  carrier.dataset.layoutKey = `carrier:${key}`
  const runtime = document.createElement('div')
  runtime.dataset.layoutKey = `runtime:${key}`
  carrier.append(runtime)
  return { carrier, runtime }
}

function mockRect(
  element: HTMLElement,
  read: () => { left: number; top: number; width: number; height: number },
) {
  return vi.spyOn(element, 'getBoundingClientRect').mockImplementation(() => {
    const rect = read()
    return new DOMRect(rect.left, rect.top, rect.width, rect.height)
  })
}

describe('grouped card pickup participant identity', () => {
  it('按 data-layout-role=card carrier 判断 source suffix，而不是要求 Runtime inner node 直接同父', () => {
    const list = document.createElement('div')
    const prefix = makeCarrier('prefix')
    const source = makeCarrier('source')
    const suffix1 = makeCarrier('suffix-1')
    const suffix2 = makeCarrier('suffix-2')
    list.append(prefix.carrier, source.carrier, suffix1.carrier, suffix2.carrier)
    document.body.append(list)

    const affected = captureSourceAffectedCards(
      [prefix.runtime, suffix1.runtime, suffix2.runtime],
      source.runtime,
    )

    expect([...affected]).toEqual([suffix1.runtime, suffix2.runtime])
  })

  it('已完成列式 group/content + card wrapper 在 pickup removal 时保留兄弟 card FLIP', () => {
    const surface = document.createElement('section')
    surface.dataset.layoutSurface = 'done'

    const group = document.createElement('section')
    group.dataset.layoutGroup = 'done-month'

    const content = document.createElement('div')
    content.dataset.layoutContent = 'done-month'

    const list = document.createElement('div')
    list.dataset.layoutCollection = 'done-month'

    const prefix = makeCarrier('prefix')
    const source = makeCarrier('source')
    const suffix1 = makeCarrier('suffix-1')
    const suffix2 = makeCarrier('suffix-2')
    list.append(prefix.carrier, source.carrier, suffix1.carrier, suffix2.carrier)
    content.append(list)
    group.append(content)
    surface.append(group)
    document.body.append(surface)

    let phase: 'before' | 'after' = 'before'
    mockRect(surface, () => ({
      left: 0,
      top: 0,
      width: 300,
      height: phase === 'before' ? 280 : 220,
    }))
    mockRect(group, () => ({
      left: 0,
      top: 0,
      width: 300,
      height: phase === 'before' ? 260 : 200,
    }))
    mockRect(content, () => ({
      left: 0,
      top: 20,
      width: 300,
      height: phase === 'before' ? 240 : 180,
    }))
    const suffix1Spy = mockRect(suffix1.runtime, () => ({
      left: 0,
      top: phase === 'before' ? 100 : 40,
      width: 250,
      height: 50,
    }))
    const suffix2Spy = mockRect(suffix2.runtime, () => ({
      left: 0,
      top: phase === 'before' ? 160 : 100,
      width: 250,
      height: 50,
    }))

    const snapshot = captureLayoutFlip(
      [prefix.runtime, suffix1.runtime, suffix2.runtime],
      document,
      false,
      undefined,
      {
        scopeSurfaces: [surface],
        focus: {
          sourceElement: source.runtime,
          layoutKey: 'runtime:source',
          mode: 'removal',
        },
      },
    )

    expect(snapshot.participants?.candidateCards).toBe(3)
    expect(snapshot.participants?.capturedCards).toBe(2)

    phase = 'after'
    source.carrier.style.display = 'none'
    playLayoutFlip(snapshot)

    const telemetry = getLastLayoutFlipTelemetry()
    expect(telemetry?.eligibleCards).toBe(2)
    expect(telemetry?.measuredCards).toBe(2)
    expect(telemetry?.animatedCards).toBe(2)
    expect(suffix1Spy).toHaveBeenCalledTimes(2)
    expect(suffix2Spy).toHaveBeenCalledTimes(2)
  })
})
