import { describe, expect, it } from 'vitest'
import { Runtime, type ObjectVisualAdapter } from '../Runtime'

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
  it('根据 visual mode 在 Runtime 内选择 clone move，而不是调用业务侧 start', () => {
    const runtime = new Runtime()
    const source = document.createElement('article')
    document.body.append(source)
    setRect(source)
    runtime.objects.register({
      id: 'clone-card',
      type: 'kanban-card',
      visual: 'kanban-clone',
      visualMode: 'clone',
      surfaceId: 'column:todo',
      element: source,
      abilities: ['move'],
    })

    const adapter = runtime.getVisualAdapter('kanban-clone')
    const move = (adapter as ObjectVisualAdapter).createMove?.({
      objectId: 'clone-card',
      element: source,
      event: new PointerEvent('pointerdown'),
      mode: 'clone',
    })

    expect(move?.driver).toBeDefined()
    expect(move?.lifecycle).toBeDefined()
    source.remove()
  })

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
