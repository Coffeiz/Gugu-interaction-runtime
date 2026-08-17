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
        motion: { resize: { duration: 10, easing: 'linear' } },
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

  it('高度动画期间删除内容时，动画结束后会补一次自然高度测量', async () => {
    const runtime = new Runtime()
    const mounted = mountFloating(runtime, () => 600)
    await nextTick()

    const layout = mounted.host.querySelector('[data-layout-role="viewport"]') as HTMLElement
    const scroll = mounted.host.querySelector('[data-drawer-scroll="items"]') as HTMLElement
    let naturalHeight = 280
    Object.defineProperty(layout, 'scrollHeight', {
      configurable: true,
      get: () => naturalHeight,
    })
    vi.spyOn(layout, 'getBoundingClientRect').mockImplementation(() => ({
      x: 0,
      y: 0,
      top: 0,
      right: 200,
      bottom: Number.parseFloat(layout.style.height) || 0,
      left: 0,
      width: 200,
      height: Number.parseFloat(layout.style.height) || 0,
      toJSON: () => ({}),
    } as DOMRect))

    const beginLayout = vi.spyOn(runtime.layout, 'begin')
    window.dispatchEvent(new Event('resize'))
    await new Promise(resolve => window.setTimeout(resolve, 20))
    const callsAfterAnimationStarted = beginLayout.mock.calls.length
    expect(callsAfterAnimationStarted).toBeGreaterThan(0)

    naturalHeight = 120
    scroll.appendChild(document.createElement('span'))
    await nextTick()
    await new Promise(resolve => window.setTimeout(resolve, 25))
    const callsWhileAnimationActive = beginLayout.mock.calls.length

    // resize motion 是 10ms，但 useSurface 会保留 80ms 尾窗；旧实现会在这段时间
    // 吞掉 mutation observer 的 resize，之后再也不补测。
    await new Promise(resolve => window.setTimeout(resolve, 120))
    expect(beginLayout.mock.calls.length).toBeGreaterThan(callsWhileAnimationActive)

    mounted.app.unmount()
    mounted.host.remove()
  })
})