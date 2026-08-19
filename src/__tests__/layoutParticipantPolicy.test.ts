import { afterEach, describe, expect, it } from 'vitest'
import {
  buildLayoutParticipantPlan,
  captureSourceAffectedCards,
  isRectWithinViewportOverscan,
  resolveLayoutFocusTarget,
} from '../dom/LayoutParticipantPolicy'

afterEach(() => {
  document.body.innerHTML = ''
})

function card(key: string): HTMLElement {
  const element = document.createElement('article')
  element.dataset.layoutRole = 'card'
  element.dataset.layoutKey = key
  return element
}

describe('LayoutParticipantPolicy', () => {
  it('pickup/removal 只捕获 source 的直接后缀，不把前缀或其它父节点纳入', () => {
    const surface = document.createElement('section')
    const list = document.createElement('div')
    const other = document.createElement('div')
    const a = card('a')
    const source = card('source')
    const c = card('c')
    const d = card('d')
    const unrelated = card('x')
    list.append(a, source, c, d)
    other.append(unrelated)
    surface.append(list, other)
    document.body.append(surface)

    const affected = captureSourceAffectedCards([a, c, d, unrelated], source)

    expect([...affected]).toEqual([c, d])
  })

  it('跨 Surface 时按 data-layout-key 找到新挂载的语义 target，优先于旧 source DOM', () => {
    const sourceSurface = document.createElement('section')
    const targetSurface = document.createElement('section')
    const source = card('project:1')
    const replacement = card('project:1')
    sourceSurface.append(source)
    targetSurface.append(replacement)
    document.body.append(sourceSurface, targetSurface)

    const target = resolveLayoutFocusTarget(document, {
      sourceElement: source,
      layoutKey: 'project:1',
      mode: 'move',
    }, [sourceSurface, targetSurface])

    expect(target).toBe(replacement)
  })

  it('同一列表插入只保留 target 后缀，target 前面的卡片不进入 play measurement', () => {
    const surface = document.createElement('section')
    const list = document.createElement('div')
    const before = card('before')
    const target = card('moving')
    const after1 = card('after-1')
    const after2 = card('after-2')
    list.append(before, target, after1, after2)
    surface.append(list)
    document.body.append(surface)

    const plan = buildLayoutParticipantPlan({
      cards: [before, after1, after2],
      root: document,
      focus: { sourceElement: target, layoutKey: 'moving', mode: 'move' },
      scopeSurfaces: [surface],
    })

    expect(plan.eligible.has(before)).toBe(false)
    expect(plan.eligible.has(after1)).toBe(true)
    expect(plan.eligible.has(after2)).toBe(true)
    expect(plan.rangeSkipped).toBe(1)
  })

  it('同 collection 的后续 sibling group 由 Relative Group FLIP 接管，跳过其 card leaves', () => {
    const surface = document.createElement('section')
    const collection = document.createElement('div')
    collection.dataset.layoutCollection = 'projects'

    const firstGroup = document.createElement('section')
    firstGroup.dataset.layoutGroup = 'projects'
    const firstContent = document.createElement('div')
    firstContent.dataset.layoutContent = 'projects'
    const target = card('moving')
    const sameGroupAfter = card('same-after')
    firstContent.append(target, sameGroupAfter)
    firstGroup.append(firstContent)

    const secondGroup = document.createElement('section')
    secondGroup.dataset.layoutGroup = 'projects'
    const secondContent = document.createElement('div')
    secondContent.dataset.layoutContent = 'projects'
    const inherited1 = card('later-1')
    const inherited2 = card('later-2')
    secondContent.append(inherited1, inherited2)
    secondGroup.append(secondContent)

    collection.append(firstGroup, secondGroup)
    surface.append(collection)
    document.body.append(surface)

    const plan = buildLayoutParticipantPlan({
      cards: [sameGroupAfter, inherited1, inherited2],
      root: document,
      focus: { sourceElement: target, layoutKey: 'moving', mode: 'move' },
      scopeSurfaces: [surface],
    })

    expect(plan.eligible.has(sameGroupAfter)).toBe(true)
    expect(plan.eligible.has(inherited1)).toBe(false)
    expect(plan.eligible.has(inherited2)).toBe(false)
    expect(plan.inheritedSkipped).toBe(2)
  })

  it('sourceAffected 与 destination range 取并集，跨 Surface 不会漏掉源列表真正移动的后缀', () => {
    const sourceSurface = document.createElement('section')
    const sourceList = document.createElement('div')
    const source = card('moving')
    const sourceAfter = card('source-after')
    sourceList.append(source, sourceAfter)
    sourceSurface.append(sourceList)

    const targetSurface = document.createElement('section')
    const targetList = document.createElement('div')
    const before = card('target-before')
    const replacement = card('moving')
    const after = card('target-after')
    targetList.append(before, replacement, after)
    targetSurface.append(targetList)
    document.body.append(sourceSurface, targetSurface)

    const plan = buildLayoutParticipantPlan({
      cards: [sourceAfter, before, after],
      root: document,
      focus: { sourceElement: source, layoutKey: 'moving', mode: 'move' },
      scopeSurfaces: [sourceSurface, targetSurface],
      sourceAffected: new Set([sourceAfter]),
    })

    expect(plan.focusTarget).toBe(replacement)
    expect(plan.eligible.has(sourceAfter)).toBe(true)
    expect(plan.eligible.has(before)).toBe(false)
    expect(plan.eligible.has(after)).toBe(true)
  })

  it('viewport eligibility 在 affected range 后生效，远离 viewport 的卡片直接跳 final layout', () => {
    const surface = document.createElement('section')
    const list = document.createElement('div')
    const target = card('moving')
    const near = card('near')
    const far = card('far')
    list.append(target, near, far)
    surface.append(list)
    document.body.append(surface)

    const plan = buildLayoutParticipantPlan({
      cards: [near, far],
      root: document,
      focus: { sourceElement: target, layoutKey: 'moving', mode: 'move' },
      scopeSurfaces: [surface],
      viewportEligible: new Set([near]),
    })

    expect(plan.eligible.has(near)).toBe(true)
    expect(plan.eligible.has(far)).toBe(false)
    expect(plan.offscreenSkipped).toBe(1)
  })

  it('viewport overscan 默认保留一屏范围，避免刚从视口外移入的卡片闪跳', () => {
    const viewport = { left: 0, top: 0, width: 300, height: 400 }

    expect(isRectWithinViewportOverscan(
      { left: 0, top: 750, width: 100, height: 50 },
      viewport,
    )).toBe(true)
    expect(isRectWithinViewportOverscan(
      { left: 0, top: 900, width: 100, height: 50 },
      viewport,
    )).toBe(false)
  })
})
