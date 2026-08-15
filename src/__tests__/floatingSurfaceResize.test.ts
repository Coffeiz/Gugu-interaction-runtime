import { createApp, defineComponent, h, nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { Runtime } from '../Runtime'
import { provideRuntime } from '../vue/context'
import { useSurface } from '../vue/useSurface'

function mountFloating(runtime: Runtime, maxHeight: () => number) {
  const child = defineComponent({
    setup() {
      const surface = useSurface({
        id: 'surface:viewport-resize',
        type: 'drawer',
        layout: 'grid',
        accepts: ['card'],
        floating: { open: true, scrollKey: 'items', maxHeight },
      })
      return () => h('section', { ref: surface.elementRef }, [
        h('div', { 'data-layout-role': 'viewport' }, [
          h('div', { 'data-drawer-scroll': 'items' }),
        ]),
      ])
    },
  })
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp({
    setup() {
      provideRuntime(runtime)
      return () => h(child)
    },
  })
  app.mount(host)
  return { app, host }
}

describe('useSurface floating viewport resize', () => {
  it('窗口尺寸变化时重新应用动态 maxHeight，即使自然内容高度没有变化', async () => {
    const runtime = new Runtime()
    let maxHeight = 320
    const mounted = mountFloating(runtime, () => maxHeight)
    await nextTick()

    const viewport = mounted.host.querySelector('[data-layout-role="viewport"]') as HTMLElement
    Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 800 })
    await nextTick()

    const beginLayout = vi.spyOn(runtime.layout, 'begin')
    maxHeight = 180
    window.dispatchEvent(new Event('resize'))
    await nextTick()
    await new Promise(resolve => window.setTimeout(resolve, 20))

    expect(beginLayout).toHaveBeenCalledWith(document, 'surface-observer', 'observer')
    mounted.app.unmount()
    mounted.host.remove()
  })
})
