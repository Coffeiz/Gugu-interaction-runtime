import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  captureCollectionPresence,
  playCollectionPresence,
} from '../dom/CollectionPresence'
import { captureLayoutFlip, scheduleLayoutFlip } from '../dom/GroupLayout'
import { findLayoutScopeSurface } from '../dom/LayoutParticipantPolicy'

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

function mockRect(element: HTMLElement, rect: { left: number; top: number; width: number; height: number }) {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(new DOMRect(
    rect.left,
    rect.top,
    rect.width,
    rect.height,
  ))
}

function makeCollectionCard(key: string, collection: string): HTMLElement {
  const card = document.createElement('article')
  card.dataset.layoutRole = 'card'
  card.dataset.layoutKey = key
  card.dataset.layoutCollection = collection
  return card
}

describe('审查回归', () => {
  it('collection 节点重挂载但 key 不变时，不误判为离场', () => {
    const root = document.createElement('main')
    const collection = document.createElement('section')
    collection.dataset.layoutCollection = 'active'
    const oldCard = makeCollectionCard('card-1', 'active')
    collection.append(oldCard)
    root.append(collection)
    document.body.append(root)
    mockRect(collection, { left: 0, top: 0, width: 300, height: 100 })
    mockRect(oldCard, { left: 0, top: 0, width: 200, height: 40 })

    const snapshot = captureCollectionPresence(root, '[data-layout-role="card"]')
    const newCard = makeCollectionCard('card-1', 'active')
    collection.replaceChildren(newCard)
    mockRect(newCard, { left: 0, top: 0, width: 200, height: 40 })

    const animate = vi.fn().mockReturnValue({
      finished: Promise.resolve(),
    } as unknown as Animation)
    Object.defineProperty(newCard, 'animate', { value: animate, configurable: true })
    playCollectionPresence(snapshot)

    expect(animate).not.toHaveBeenCalled()
  })

  it('嵌套 Surface 选择最内层，而不依赖注册顺序', () => {
    const outer = document.createElement('section')
    const inner = document.createElement('div')
    const card = document.createElement('article')
    outer.append(inner)
    inner.append(card)
    document.body.append(outer)

    expect(findLayoutScopeSurface(card, [outer, inner])).toBe(inner)
    expect(findLayoutScopeSurface(card, [inner, outer])).toBe(inner)
  })

  it('pending FLIP 合并时保留上一笔事务的 participant 与 before 几何', () => {
    const surface = document.createElement('section')
    surface.dataset.layoutSurface = 'test'
    const list = document.createElement('div')
    const first = makeCollectionCard('first', 'active')
    const second = makeCollectionCard('second', 'active')
    const third = makeCollectionCard('third', 'active')
    list.append(first, second)
    surface.append(list)
    document.body.append(surface)
    mockRect(surface, { left: 0, top: 0, width: 500, height: 300 })
    mockRect(first, { left: 0, top: 0, width: 100, height: 40 })
    mockRect(second, { left: 110, top: 0, width: 100, height: 40 })

    const pending = captureLayoutFlip([first, second], document, false, undefined, {
      scopeSurfaces: [surface],
    })
    scheduleLayoutFlip(pending)

    list.append(third)
    mockRect(third, { left: 220, top: 0, width: 100, height: 40 })
    const merged = captureLayoutFlip([second, third], document, false, undefined, {
      scopeSurfaces: [surface],
    })

    expect(merged.flat?.elements).toEqual([first, second, third])
    expect(merged.participants?.cards).toEqual([first, second, third])
    expect(merged.participants?.focus).toBeUndefined()
  })
})
