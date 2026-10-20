import { afterEach, describe, expect, it } from 'vitest'
import { buildLayoutParticipantPlan, captureSourceAffectedCards, captureViewportRemovalRange } from '../dom/LayoutParticipantPolicy'

afterEach(() => { document.body.innerHTML = '' })

function makeCard(key: string): HTMLElement {
  const element = document.createElement('article')
  element.dataset.layoutRole = 'card'
  element.dataset.layoutKey = key
  return element
}

describe('same-container detach release range', () => {
  it('binary-searches visible removal suffix in a vertical list and falls back for other layouts', () => {
    const list = document.createElement('div')
    list.style.display = 'flex'
    list.style.flexDirection = 'column'
    const cards = Array.from({ length: 1000 }, (_, index) => {
      const card = makeCard(String(index))
      list.append(card)
      return card
    })
    document.body.append(list)
    const rectCalls = new Map<HTMLElement, number>()
    const measure = (element: HTMLElement) => {
      rectCalls.set(element, (rectCalls.get(element) ?? 0) + 1)
      const index = Number(element.dataset.layoutKey)
      return { top: index * 40, left: 0, width: 100, height: 30 }
    }

    const visible = captureViewportRemovalRange(cards.slice(1), cards[0], {
      top: 10_000,
      left: 0,
      width: 200,
      height: 400,
    }, measure)

    expect(visible).not.toBeNull()
    expect([...visible!].map(card => card.dataset.layoutKey)).toEqual(
      Array.from({ length: 31 }, (_, index) => String(index + 240)),
    )
    expect([...rectCalls.values()].reduce((sum, count) => sum + count, 0)).toBeLessThan(30)

    list.style.flexDirection = 'row'
    expect(captureViewportRemovalRange(cards.slice(1), cards[0], {
      top: 0, left: 0, width: 200, height: 400,
    }, measure)).toBeNull()
  })

  it('向下重排从“source 已离开布局”的 release baseline 只保留 destination suffix', () => {
    const surface = document.createElement('section')
    const list = document.createElement('div')
    const a = makeCard('a')
    const source = makeCard('moving')
    const b = makeCard('b')
    const c = makeCard('c')
    const d = makeCard('d')
    const e = makeCard('e')
    list.append(a, source, b, c, d, e)
    surface.append(list)
    document.body.append(surface)

    // Runtime detach keeps the business node in DOM order but removes it from layout with
    // display:none. sourceAffected therefore still records the original semantic suffix.
    source.style.display = 'none'
    const cards = [a, b, c, d, e]
    const oldSuffix = captureSourceAffectedCards(cards, source)

    // Final order A B C D source E. Relative to the release baseline A B C D E, only E moves.
    list.insertBefore(source, e)
    source.style.display = ''
    const plan = buildLayoutParticipantPlan({
      cards,
      root: document,
      focus: { sourceElement: source, layoutKey: 'moving', mode: 'move' },
      scopeSurfaces: [surface],
      sourceAffected: oldSuffix,
    })

    expect([...plan.eligible]).toEqual([e])
    expect(plan.rangeSkipped).toBe(4)
  })

  it('向上重排保留最终插入点后的全部 destination suffix', () => {
    const surface = document.createElement('section')
    const list = document.createElement('div')
    const a = makeCard('a')
    const b = makeCard('b')
    const c = makeCard('c')
    const d = makeCard('d')
    const source = makeCard('moving')
    const e = makeCard('e')
    list.append(a, b, c, d, source, e)
    surface.append(list)
    document.body.append(surface)

    source.style.display = 'none'
    const cards = [a, b, c, d, e]
    const oldSuffix = captureSourceAffectedCards(cards, source)

    // Release baseline is A B C D E; final A source B C D E means B/C/D/E all move down.
    list.insertBefore(source, b)
    source.style.display = ''
    const plan = buildLayoutParticipantPlan({
      cards,
      root: document,
      focus: { sourceElement: source, layoutKey: 'moving', mode: 'move' },
      scopeSurfaces: [surface],
      sourceAffected: oldSuffix,
    })

    expect([...plan.eligible]).toEqual([b, c, d, e])
    expect(plan.eligible.has(a)).toBe(false)
  })

  it('回到原 index 仍保留 source 后缀，不能因为 old/new DOM order 相同而清空 participant', () => {
    const surface = document.createElement('section')
    const list = document.createElement('div')
    const a = makeCard('a')
    const source = makeCard('moving')
    const b = makeCard('b')
    const c = makeCard('c')
    const d = makeCard('d')
    list.append(a, source, b, c, d)
    surface.append(list)
    document.body.append(surface)

    source.style.display = 'none'
    const cards = [a, b, c, d]
    const oldSuffix = captureSourceAffectedCards(cards, source)

    // DOM order is intentionally unchanged. Restoring source to layout still moves B/C/D down
    // from the release snapshot, which is exactly the regression that previously snapped.
    source.style.display = ''
    const plan = buildLayoutParticipantPlan({
      cards,
      root: document,
      focus: { sourceElement: source, layoutKey: 'moving', mode: 'move' },
      scopeSurfaces: [surface],
      sourceAffected: oldSuffix,
    })

    expect([...plan.eligible]).toEqual([b, c, d])
    expect(plan.rangeSkipped).toBe(1)
  })
})
