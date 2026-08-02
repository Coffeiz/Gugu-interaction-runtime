import { describe, expect, it } from 'vitest'
import { ObjectStore } from '../object/ObjectStore'
import { SurfaceStore } from '../surface/SurfaceStore'
import { createRegisteredHitResolver } from '../dom/RegisteredHit'

function setRect(element: HTMLElement, left: number, top: number, width: number, height: number): void {
  element.getBoundingClientRect = () => ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON() {},
  })
}

describe('注册表默认命中', () => {
  it('只依赖 ObjectStore 和 SurfaceStore，能识别跨 Surface 落点与索引', () => {
    const objects = new ObjectStore()
    const surfaces = new SurfaceStore()
    const todo = document.createElement('section')
    const done = document.createElement('section')
    const doneFirst = document.createElement('article')
    const doneSecond = document.createElement('article')
    document.body.append(todo, done)
    done.append(doneFirst, doneSecond)
    setRect(todo, 0, 0, 200, 500)
    setRect(done, 240, 0, 200, 500)
    setRect(doneFirst, 250, 30, 180, 50)
    setRect(doneSecond, 250, 100, 180, 50)

    surfaces.register({ id: 'todo', type: 'list', element: todo, accepts: ['project-card'] })
    surfaces.register({ id: 'done', type: 'list', element: done, accepts: ['project-card'] })
    objects.register({ id: 'moving', type: 'project-card', surfaceId: 'todo', element: document.createElement('article'), abilities: ['move'] })
    objects.register({ id: 'first', type: 'project-card', surfaceId: 'done', element: doneFirst, abilities: ['move'] })
    objects.register({ id: 'second', type: 'project-card', surfaceId: 'done', element: doneSecond, abilities: ['move'] })

    const resolver = createRegisteredHitResolver(objects, surfaces, 'moving')
    const surface = resolver.findSurface({ x: 300, y: 95 })

    expect(surface?.id).toBe('done')
    expect(resolver.findTarget(surface!, { x: 300, y: 95 }, 'moving')).toBeNull()
    expect(resolver.findIndex(surface!, { x: 300, y: 95 }, 'moving')).toBe(1)

    todo.remove()
    done.remove()
  })
})
