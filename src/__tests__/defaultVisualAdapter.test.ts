import { describe, expect, it } from 'vitest'
import { Runtime } from '../Runtime'

function setRect(element: HTMLElement, width = 100, height = 40): void {
  element.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width,
    height,
    right: width,
    bottom: height,
    x: 0,
    y: 0,
    toJSON() {},
  })
}

describe('默认视觉适配器', () => {
  it('从 ObjectStore 解析重挂载后的 source/target，不依赖 data-card', () => {
    const runtime = new Runtime()
    const original = document.createElement('article')
    const remounted = document.createElement('article')
    document.body.append(original, remounted)
    setRect(original)
    setRect(remounted)
    runtime.objects.register({
      id: 'project-1',
      type: 'project-card',
      surfaceId: 'todo',
      element: original,
      abilities: ['move'],
    })

    const adapter = runtime.getVisualAdapter('project-card')
    expect(adapter.resolveSource?.('project-1')).toBe(original)

    runtime.objects.setElement('project-1', remounted)
    expect(adapter.resolveSource?.('project-1')).toBe(remounted)
    expect(adapter.resolveTarget?.('project-1', { columnId: 'done' })).toBe(remounted)

    original.remove()
    remounted.remove()
  })
})
