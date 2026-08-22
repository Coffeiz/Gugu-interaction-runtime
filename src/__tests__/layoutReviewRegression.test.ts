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

    const snapshot = captureCollectionPresence(
      root,
      '[data-layout-role="card"]',
      undefined,
      undefined,
      undefined,
      undefined,
      element => element === oldCard,
    )
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

  it('presence reduction 在几何读取前过滤非 participant 卡片', () => {
    const root = document.createElement('main')
    const collection = document.createElement('section')
    collection.dataset.layoutCollection = 'active'
    const cards = Array.from({ length: 10 }, (_, index) => {
      const card = makeCollectionCard(`card-${index}`, 'active')
      collection.append(card)
      return card
    })
    root.append(collection)
    document.body.append(root)
    mockRect(collection, { left: 0, top: 0, width: 500, height: 500 })
    const cardReads = cards.map(card => vi.spyOn(card, 'getBoundingClientRect'))
    const included = new Set(cards.slice(0, 2))

    captureCollectionPresence(
      root,
      '[data-layout-role="card"]',
      undefined,
      undefined,
      undefined,
      undefined,
      element => included.has(element),
    )

    expect(cardReads.map(spy => spy.mock.calls.length)).toEqual([2, 2, 0, 0, 0, 0, 0, 0, 0, 0])
  })

  it('presence participant 支持 Runtime 卡片包在语义 wrapper 内', () => {
    const surface = document.createElement('section')
    surface.dataset.layoutSurface = 'done'
    const collection = document.createElement('div')
    collection.dataset.layoutCollection = 'recent'
    const wrapper = makeCollectionCard('project-1', 'recent')
    const runtimeCard = document.createElement('article')
    runtimeCard.dataset.layoutKey = 'project:1'
    wrapper.append(runtimeCard)
    collection.append(wrapper)
    surface.append(collection)
    document.body.append(surface)
    mockRect(surface, { left: 0, top: 0, width: 500, height: 300 })
    mockRect(collection, { left: 0, top: 0, width: 500, height: 100 })
    mockRect(wrapper, { left: 0, top: 0, width: 200, height: 40 })
    mockRect(runtimeCard, { left: 0, top: 0, width: 200, height: 40 })

    const snapshot = captureLayoutFlip(
      [runtimeCard],
      document,
      true,
      undefined,
      {
        scopeSurfaces: [surface],
        focus: { sourceElement: runtimeCard, layoutKey: 'project:1', mode: 'move' },
      },
    )

    expect(snapshot.presence?.entries.map(entry => entry.key)).toEqual(['project-1'])
  })

  it('capture 时不可见但 play 时变可见的 participant 仍按 semantic key 入场', () => {
    const root = document.createElement('main')
    const collapsed = document.createElement('section')
    collapsed.dataset.layoutOpen = 'false'
    const hiddenCollection = document.createElement('div')
    hiddenCollection.dataset.layoutCollection = 'hidden'
    const oldCard = makeCollectionCard('card-hidden', 'hidden')
    hiddenCollection.append(oldCard)
    collapsed.append(hiddenCollection)
    root.append(collapsed)
    document.body.append(root)
    mockRect(hiddenCollection, { left: 0, top: 0, width: 300, height: 100 })
    mockRect(oldCard, { left: 0, top: 0, width: 200, height: 40 })

    const snapshot = captureCollectionPresence(
      root,
      '[data-layout-role="card"]',
      undefined,
      undefined,
      undefined,
      undefined,
      element => element === oldCard,
    )

    const visibleCollection = document.createElement('div')
    visibleCollection.dataset.layoutCollection = 'visible'
    const newCard = makeCollectionCard('card-hidden', 'visible')
    visibleCollection.append(newCard)
    collapsed.replaceWith(visibleCollection)
    mockRect(visibleCollection, { left: 0, top: 0, width: 300, height: 100 })
    mockRect(newCard, { left: 0, top: 0, width: 200, height: 40 })
    const animate = vi.fn().mockReturnValue({ finished: Promise.resolve() } as unknown as Animation)
    Object.defineProperty(newCard, 'animate', { value: animate, configurable: true })

    playCollectionPresence(snapshot)

    expect(snapshot.includeKeys?.has('card-hidden')).toBe(true)
    expect(snapshot.entries).toHaveLength(0)
    expect(animate).toHaveBeenCalledTimes(1)
  })

  it('reduction 开启时允许真正新 key 入场，但继续跳过旧 non-participant', () => {
    const root = document.createElement('main')
    const collection = document.createElement('section')
    collection.dataset.layoutCollection = 'active'
    const oldParticipant = makeCollectionCard('participant', 'active')
    const oldNonParticipant = makeCollectionCard('non-participant', 'active')
    collection.append(oldParticipant, oldNonParticipant)
    root.append(collection)
    document.body.append(root)
    mockRect(collection, { left: 0, top: 0, width: 500, height: 200 })
    mockRect(oldParticipant, { left: 0, top: 0, width: 200, height: 40 })
    mockRect(oldNonParticipant, { left: 0, top: 50, width: 200, height: 40 })

    const snapshot = captureCollectionPresence(
      root,
      '[data-layout-role="card"]',
      undefined,
      undefined,
      undefined,
      undefined,
      element => element === oldParticipant,
    )
    const newCard = makeCollectionCard('new-entry', 'active')
    collection.append(newCard)
    mockRect(newCard, { left: 0, top: 100, width: 200, height: 40 })
    const newAnimate = vi.fn().mockReturnValue({ finished: Promise.resolve() } as unknown as Animation)
    const oldAnimate = vi.fn().mockReturnValue({ finished: Promise.resolve() } as unknown as Animation)
    Object.defineProperty(newCard, 'animate', { value: newAnimate, configurable: true })
    Object.defineProperty(oldNonParticipant, 'animate', { value: oldAnimate, configurable: true })

    playCollectionPresence(snapshot)

    expect(newAnimate).toHaveBeenCalledTimes(1)
    expect(oldAnimate).not.toHaveBeenCalled()
  })

  it('Top-N collection 溢出时，旧卡片换 collection 仍执行入场动画', () => {
    const root = document.createElement('main')
    const recent = document.createElement('section')
    recent.dataset.layoutCollection = 'recent'
    const month = document.createElement('section')
    month.dataset.layoutCollection = 'month-2026-08'
    const cards = new Map<string, HTMLElement>()
    for (const [key, collection] of [['a', recent], ['b', recent], ['c', recent], ['d', month]] as const) {
      const card = makeCollectionCard(`project-${key}`, collection.dataset.layoutCollection!)
      delete card.dataset.layoutCollection
      collection.append(card)
      cards.set(key, card)
      mockRect(card, { left: 0, top: cards.size * 45, width: 200, height: 40 })
    }
    root.append(recent, month)
    document.body.append(root)
    mockRect(recent, { left: 0, top: 0, width: 300, height: 160 })
    mockRect(month, { left: 0, top: 180, width: 300, height: 80 })

    const snapshot = captureCollectionPresence(
      root,
      '[data-layout-role="card"]',
      undefined,
      element => element === cards.get('a'),
    )
    const d = cards.get('d')!
    recent.append(d)
    month.replaceChildren()
    mockRect(d, { left: 0, top: 135, width: 200, height: 40 })
    const animate = vi.fn().mockReturnValue({ finished: Promise.resolve() } as unknown as Animation)
    Object.defineProperty(d, 'animate', { value: animate, configurable: true })

    playCollectionPresence(snapshot)

    expect(animate).toHaveBeenCalledTimes(1)
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
