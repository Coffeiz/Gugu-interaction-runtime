import { describe, expect, it } from 'vitest'
import { ObjectStore } from '../object/ObjectStore'
import { SurfaceStore } from '../surface/SurfaceStore'
import { TargetStore } from '../target/TargetStore'
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

    surfaces.register({ id: 'todo', type: 'list', layout: 'grid', element: todo, accepts: ['project-card'] })
    surfaces.register({ id: 'done', type: 'list', layout: 'grid', element: done, accepts: ['project-card'] })
    objects.register({ id: 'moving', type: 'project-card', surfaceId: 'todo', element: document.createElement('article'), abilities: ['move'] })
    objects.register({ id: 'first', type: 'project-card', surfaceId: 'done', element: doneFirst, abilities: ['move'] })
    objects.register({ id: 'second', type: 'project-card', surfaceId: 'done', element: doneSecond, abilities: ['move'] })

    const resolver = createRegisteredHitResolver(objects, surfaces, new TargetStore(), 'moving')
    const surface = resolver.findSurface({ x: 300, y: 95 })

    expect(surface?.id).toBe('done')
    expect(resolver.findTarget(surface!, { x: 300, y: 95 }, 'moving')).toBeNull()
    expect(resolver.findIndex(surface!, { x: 300, y: 95 }, 'moving')).toBe(1)

    todo.remove()
    done.remove()
  })

  it('语义 Target 的元素可以作为命中 Surface，即使 Surface 元素在另一处', () => {
    const objects = new ObjectStore()
    const surfaces = new SurfaceStore()
    const targets = new TargetStore()
    const browser = document.createElement('section')
    const folderCard = document.createElement('article')
    document.body.append(browser, folderCard)
    setRect(browser, 0, 0, 200, 500)
    setRect(folderCard, 240, 30, 180, 80)

    surfaces.register({ id: 'file:surface:folder:references', type: 'folder', layout: 'grid', element: browser, accepts: ['file-item'] })
    objects.register({ id: 'file:readme', type: 'file-item', surfaceId: 'file:surface:browser', element: document.createElement('article'), abilities: ['move'] })
    targets.register({ id: 'folder-target', surfaceId: 'file:surface:folder:references', element: folderCard, accepts: ['file-item'], priority: 2 })

    const resolver = createRegisteredHitResolver(objects, surfaces, targets, 'file:readme')
    expect(resolver.findSurface({ x: 300, y: 50 })?.id).toBe('file:surface:folder:references')

    browser.remove()
    folderCard.remove()
  })
})
