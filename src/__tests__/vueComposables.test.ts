import { createApp, defineComponent, h, nextTick, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { Runtime } from '../Runtime'
import type { Action } from '../action/Action'
import { provideRuntime } from '../vue/context'
import { useObject } from '../vue/useObject'
import { useRuntimeAction } from '../vue/useRuntimeAction'
import { useRuntimeTransition } from '../vue/useRuntimeTransition'
import { useSurface } from '../vue/useSurface'
import { useTarget } from '../vue/useTarget'

function createHost(runtime: Runtime, child: ReturnType<typeof defineComponent>) {
  return defineComponent({
    setup() {
      provideRuntime(runtime)
      return () => h(child)
    },
  })
}

function mount(runtime: Runtime, child: ReturnType<typeof defineComponent>) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp(createHost(runtime, child))
  app.mount(host)
  return { app, host }
}

describe('Vue Runtime composables', () => {
  it('useObject/useSurface/useTarget 负责注册、绑定 DOM 和卸载', async () => {
    const runtime = new Runtime()
    const child = defineComponent({
      setup() {
        const object = useObject({
          id: 'object:1',
          type: 'card',
          surface: () => 'surface:1',
          abilities: ['move'],
          target: { surfaceId: 'surface:1', accepts: ['card'], priority: 1 },
        })
        const surface = useSurface({ id: 'surface:1', type: 'list', accepts: ['card'] })
        const target = useTarget({ id: 'target:1', surfaceId: 'surface:1', accepts: ['card'] })
        return () => h('section', { ref: surface.elementRef }, [
          h('article', { ref: object.elementRef }),
          h('button', { ref: target.elementRef }),
        ])
      },
    })
    const mounted = mount(runtime, child)
    await nextTick()

    expect(runtime.objects.get('object:1')?.element).toBeInstanceOf(HTMLElement)
    expect(runtime.surfaces.get('surface:1')?.element).toBeInstanceOf(HTMLElement)
    expect(runtime.targets.get('target:1')?.element).toBeInstanceOf(HTMLElement)
    expect(runtime.targets.get('object-target:object:1')).toBeDefined()

    mounted.app.unmount()
    await nextTick()
    expect(runtime.objects.get('object:1')).toBeUndefined()
    expect(runtime.surfaces.get('surface:1')).toBeUndefined()
    expect(runtime.targets.get('target:1')).toBeUndefined()
    expect(runtime.targets.get('object-target:object:1')).toBeUndefined()
    mounted.host.remove()
  })

  it('旧组件卸载不会清理同 ID 的新 Object', async () => {
    const runtime = new Runtime()
    const createObjectChild = () => defineComponent({
      setup() {
        const object = useObject({ id: 'object:shared', type: 'card', surface: 'surface:1', abilities: ['move'] })
        return () => h('article', { ref: object.elementRef })
      },
    })
    const first = mount(runtime, createObjectChild())
    await nextTick()
    const firstGeneration = runtime.objects.get('object:shared')?.generation
    const second = mount(runtime, createObjectChild())
    await nextTick()
    const secondElement = runtime.objects.get('object:shared')?.element
    const secondGeneration = runtime.objects.get('object:shared')?.generation

    first.app.unmount()
    await nextTick()
    expect(secondGeneration).toBeGreaterThan(firstGeneration ?? 0)
    expect(runtime.objects.get('object:shared')?.element).toBe(secondElement)

    second.app.unmount()
    first.host.remove()
    second.host.remove()
  })

  it('响应式 Surface/Target 字段使用 update 而不改变 generation', async () => {
    const runtime = new Runtime()
    const targetSurfaceId = ref('surface:a')
    const child = defineComponent({
      setup() {
        const surface = useSurface({ id: 'surface:dynamic', type: 'list', accepts: () => ['card'] })
        const target = useTarget({ id: 'target:dynamic', surfaceId: targetSurfaceId, accepts: ['card'] })
        return () => h('section', { ref: surface.elementRef }, [h('button', { ref: target.elementRef })])
      },
    })
    const mounted = mount(runtime, child)
    await nextTick()
    const targetGeneration = runtime.targets.get('target:dynamic')?.generation
    targetSurfaceId.value = 'surface:b'
    await nextTick()

    expect(runtime.targets.get('target:dynamic')).toMatchObject({ surfaceId: 'surface:b', generation: targetGeneration })
    mounted.app.unmount()
    mounted.host.remove()
  })

  it('useObject 的 node 声明由 Runtime 按实时 DOMRect 计算端口并完成连接生命周期', async () => {
    const runtime = new Runtime()
    const actions: Action[] = []
    runtime.onAction(action => { actions.push(action) })
    const child = defineComponent({
      setup() {
        const left = useObject({
          id: 'node:left', type: 'card', surface: 'surface:canvas', abilities: ['move', 'link'],
          node: { ports: [{ id: 'out', side: 'right', position: 0.5 }] },
        })
        const right = useObject({
          id: 'node:right', type: 'card', surface: 'surface:canvas', abilities: ['move', 'link'],
          node: { ports: [{ id: 'in', side: 'left', position: 0.25, accepts: ['card'] }] },
        })
        return () => h('section', [
          h('article', { ref: left.elementRef, style: { width: '100px', height: '80px' } }),
          h('article', { ref: right.elementRef, style: { width: '100px', height: '80px' } }),
        ])
      },
    })
    const mounted = mount(runtime, child)
    await nextTick()

    const source = runtime.getNodePorts('node:left')[0]
    const target = runtime.getNodePorts('node:right')[0]
    expect(source?.point).toBeDefined()
    expect(target?.position).toBe(0.25)
    expect(runtime.beginNodeConnection('node:left', 'out')).not.toBeNull()
    runtime.updateNodeConnection(target!.point)
    expect(runtime.finishNodeConnection('node:right', 'in')).toBe(true)
    expect(actions.some(action => action.type === 'connection-create')).toBe(true)

    mounted.app.unmount()
    mounted.host.remove()
  })

  it('可以预注册持久连接，并在删除后允许重新创建', () => {
    const runtime = new Runtime()
    const connection = {
      sourceObjectId: 'node:left', sourcePortId: 'out',
      targetObjectId: 'node:right', targetPortId: 'in',
    }

    const id = runtime.registerNodeConnection(connection)
    expect(runtime.hasNodeConnection(connection)).toBe(true)
    expect(runtime.unregisterNodeConnection(id)).toBe(true)
    expect(runtime.hasNodeConnection(connection)).toBe(false)
  })

  it('端点读取实时 DOMRect，移动、缩放和尺寸变化不会复用旧坐标', async () => {
    const runtime = new Runtime()
    let rect = { x: 20, y: 30, width: 100, height: 80 }
    const child = defineComponent({
      setup() {
        const object = useObject({
          id: 'node:live', type: 'card', surface: 'surface:canvas', abilities: ['link'],
          node: { ports: [{ id: 'right', side: 'right', position: 0.5, hitRadius: 12 }] },
        })
        return () => h('article', { ref: object.elementRef })
      },
    })
    const mounted = mount(runtime, child)
    await nextTick()
    const element = runtime.objects.get('node:live')?.element
    expect(element).toBeInstanceOf(HTMLElement)
    Object.defineProperty(element, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ ...rect, left: rect.x, top: rect.y, right: rect.x + rect.width, bottom: rect.y + rect.height }),
    })

    expect(runtime.getNodePorts('node:live')[0]?.point).toEqual({ x: 120, y: 70 })
    rect = { x: 200, y: 100, width: 160, height: 120 }
    expect(runtime.getNodePorts('node:live')[0]?.point).toEqual({ x: 360, y: 160 })
    expect(runtime.hitNodePort({ x: 360, y: 160 }, { objectType: 'card' })?.objectId).toBe('node:live')

    mounted.app.unmount()
    mounted.host.remove()
  })

  it('useSurface 保留 viewport 回调，不把回调提前执行成 DOM 节点', async () => {
    const runtime = new Runtime()
    const viewport = document.createElement('div')
    const child = defineComponent({
      setup() {
        const surface = useSurface({
          id: 'surface:viewport',
          type: 'list',
          accepts: ['card'],
          viewport: () => viewport,
        })
        return () => h('section', { ref: surface.elementRef })
      },
    })
    const mounted = mount(runtime, child)
    await nextTick()

    expect(runtime.surfaces.get('surface:viewport')?.viewport?.()).toBe(viewport)
    mounted.app.unmount()
    mounted.host.remove()
  })

  it('useRuntimeAction 和 useRuntimeTransition 在组件卸载时解除订阅', async () => {
    const runtime = new Runtime()
    const received: Action[] = []
    const child = defineComponent({
      setup() {
        useRuntimeAction(action => { received.push(action) })
        const { controlled } = useRuntimeTransition('surface:owned')
        return () => h('output', { 'data-controlled': String(controlled.value) })
      },
    })
    const mounted = mount(runtime, child)
    await nextTick()
    runtime.emitAction({ type: 'move', objectId: 'object:1', fromSurfaceId: 'a', toSurfaceId: 'b', timestamp: 1 })
    expect(received).toHaveLength(1)

    mounted.app.unmount()
    runtime.emitAction({ type: 'move', objectId: 'object:2', fromSurfaceId: 'a', toSurfaceId: 'b', timestamp: 2 })
    expect(received).toHaveLength(1)
    mounted.host.remove()
  })
})
