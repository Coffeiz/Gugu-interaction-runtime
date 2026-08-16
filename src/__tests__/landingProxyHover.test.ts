import { describe, expect, it } from 'vitest'
import { createDragProxy, setProxyInteractive } from '../dom/Visual'

describe('landing proxy hover ownership', () => {
  it('regrab 命中层可用时，视觉代理本身仍不参与 hover 命中', () => {
    const source = document.createElement('article')
    source.className = 'hover-card-fx'
    Object.defineProperty(source, 'getBoundingClientRect', {
      value: () => ({ left: 10, top: 20, width: 120, height: 48, right: 130, bottom: 68 }),
    })

    const proxy = createDragProxy(source)
    const content = proxy.querySelector<HTMLElement>('[data-runtime-proxy-content]')

    expect(proxy.style.pointerEvents).toBe('none')
    expect(content?.style.pointerEvents).toBe('none')

    content?.classList.add('is-hovered')

    setProxyInteractive(proxy, true)

    expect(proxy.style.pointerEvents).toBe('none')
    expect(content?.classList.contains('is-hovered')).toBe(false)

    setProxyInteractive(proxy, false)
    proxy.remove()
  })
})
