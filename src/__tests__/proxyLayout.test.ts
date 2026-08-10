import { describe, expect, it } from 'vitest'
import { createDragProxy, destroyDragProxy } from '../dom/Visual'

function rect(width = 900, height = 64): DOMRect {
  return {
    left: 0,
    top: 0,
    width,
    height,
    right: width,
    bottom: height,
    x: 0,
    y: 0,
    toJSON() {},
  }
}

describe('代理布局', () => {
  it('compact 抓取不会叠加默认放大', async () => {
    const source = document.createElement('article')
    document.body.append(source)

    const proxy = createDragProxy(source, rect(), {
      layout: { compact: { width: '320px' } },
    })

    expect(proxy.style.transform).toContain('scale(1)')
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    expect(proxy.style.transform).toContain('scale(1)')

    destroyDragProxy(proxy)
    source.remove()
  })

  it('普通代理仍保留默认浮起缩放', () => {
    const source = document.createElement('article')
    document.body.append(source)

    const proxy = createDragProxy(source, rect())

    expect(proxy.style.transform).toContain('scale(1.03)')

    destroyDragProxy(proxy)
    source.remove()
  })
})

