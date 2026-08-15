import { describe, expect, it, vi } from 'vitest'
import { Runtime } from '../Runtime'
import type { MoveBehaviorDriver, MoveVisualLifecycle } from '../behavior/MoveBehavior'
import { shapeReleaseVelocity } from '../motion/ReleaseMotion'

function createRuntime() {
  const runtime = new Runtime()
  runtime.objects.register({
    id: 'card-1',
    type: 'project-card',
    surfaceId: 'column:todo',
    element: null,
    abilities: ['move'],
  })
  runtime.registerVisualAdapter('project-card', { resolveSource: () => null })
  runtime.surfaces.register({ id: 'column:todo', type: 'list', layout: 'grid', element: null, accepts: ['project-card'] })
  runtime.surfaces.register({ id: 'column:done', type: 'list', layout: 'grid', element: null, accepts: ['project-card'] })
  return runtime
}

function createDriver(commit: () => void | Promise<void>): MoveBehaviorDriver {
  return {
    resolveDestination: () => ({
      accepted: true,
      destination: {
        fromSurfaceId: 'column:todo',
        toSurfaceId: 'column:done',
        toIndex: 0,
      },
    }),
    commit,
  }
}

function createRequest() {
  return {
    type: 'move',
    objectId: 'card-1',
    input: { kind: 'pointerdown', event: new PointerEvent('pointerdown') },
  } as const
}

describe('Runtime move orchestration', () => {
  it('组开合会把同一根节点内 Surface 的自然高度交给 Runtime resize', async () => {
    const runtime = new Runtime()
    const root = document.createElement('div')
    const viewport = document.createElement('div')
    const content = document.createElement('div')
    const card = document.createElement('div')
    const measureLayout = vi.fn(() => ({ height: 180 }))

    viewport.dataset.layoutSurface = 'drawer'
    content.dataset.layoutContent = 'drawer-group'
    content.dataset.layoutOpen = 'false'
    card.dataset.layoutRole = 'card'
    content.append(card)
    viewport.append(content)
    root.append(viewport)
    document.body.append(root)

    Object.defineProperty(content, 'scrollHeight', { configurable: true, value: 180 })
    viewport.getBoundingClientRect = () => ({
      top: 0, left: 0, width: 280, height: 80, right: 280, bottom: 80,
      x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect)
    content.getBoundingClientRect = () => ({
      top: 0, left: 0, width: 280, height: 0, right: 280, bottom: 0,
      x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect)
    card.getBoundingClientRect = () => ({
      top: 0, left: 0, width: 240, height: 40, right: 240, bottom: 40,
      x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect)

    runtime.surfaces.register({
      id: 'drawer',
      type: 'drawer',
      layout: 'grid',
      element: viewport,
      layoutElement: () => viewport,
      measureLayout,
      accepts: ['project-card'],
    })

    await runtime.runGroupToggle({
      root,
      content,
      opening: true,
      mutate: () => { content.dataset.layoutOpen = 'true' },
      waitForLayout: () => undefined,
    })

    expect(measureLayout).toHaveBeenCalled()
    root.remove()
  })

  it('组开合会在组目标高度提交后测量 Surface，保持展开/收起方向一致', async () => {
    const runtime = new Runtime()
    const root = document.createElement('div')
    const viewport = document.createElement('div')
    const content = document.createElement('div')
    const card = document.createElement('div')
    let naturalHeight = 40
    const measuredHeights: number[] = []
    const measureLayout = vi.fn(() => {
      measuredHeights.push(naturalHeight)
      return { height: naturalHeight }
    })
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      window.setTimeout(() => callback(performance.now()), 0)
      return 1
    })

    viewport.dataset.layoutSurface = 'drawer'
    content.dataset.layoutContent = 'drawer-group'
    card.dataset.layoutRole = 'card'
    content.append(card)
    viewport.append(content)
    root.append(viewport)
    document.body.append(root)

    Object.defineProperty(content, 'scrollHeight', { configurable: true, get: () => naturalHeight })
    content.getBoundingClientRect = () => ({
      top: 0, left: 0, width: 280, height: naturalHeight, right: 280, bottom: naturalHeight,
      x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect)
    viewport.getBoundingClientRect = () => ({
      top: 0, left: 0, width: 280, height: 80, right: 280, bottom: 80,
      x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect)
    card.getBoundingClientRect = () => ({
      top: 0, left: 0, width: 240, height: 40, right: 240, bottom: 40,
      x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect)

    runtime.surfaces.register({
      id: 'drawer-direction',
      type: 'drawer',
      layout: 'grid',
      element: viewport,
      layoutElement: () => viewport,
      measureLayout,
      accepts: ['project-card'],
    })

    try {
      naturalHeight = 160
      const opening = runtime.runGroupToggle({
        root,
        content,
        opening: true,
        mutate: () => { content.dataset.layoutOpen = 'true' },
        waitForLayout: () => undefined,
      })
      await opening
      expect(measuredHeights[measuredHeights.length - 1]).toBe(160)

      viewport.dataset.runtimeSurfaceResize = ''
      naturalHeight = 40
      const closing = runtime.runGroupToggle({
        root,
        content,
        opening: false,
        mutate: () => { content.dataset.layoutOpen = 'false' },
        waitForLayout: () => undefined,
      })
      await closing
      expect(measuredHeights[measuredHeights.length - 1]).toBe(40)
      expect(raf).toHaveBeenCalled()
    } finally {
      raf.mockRestore()
      root.remove()
    }
  })

  it('同一布局版本的组开合复用 Surface 自然尺寸缓存', async () => {
    const runtime = new Runtime()
    const root = document.createElement('div')
    const viewport = document.createElement('div')
    const content = document.createElement('div')
    const card = document.createElement('div')
    const measureLayout = vi.fn(() => ({ height: 180 }))

    viewport.dataset.layoutSurface = 'cached-drawer'
    content.dataset.layoutContent = 'cached-group'
    card.dataset.layoutRole = 'card'
    content.append(card)
    viewport.append(content)
    root.append(viewport)
    document.body.append(root)
    Object.defineProperty(content, 'scrollHeight', { configurable: true, value: 180 })
    content.getBoundingClientRect = () => ({
      top: 0, left: 0, width: 280, height: 0, right: 280, bottom: 0,
      x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect)
    viewport.getBoundingClientRect = () => ({
      top: 0, left: 0, width: 280, height: 80, right: 280, bottom: 80,
      x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect)
    card.getBoundingClientRect = () => ({
      top: 0, left: 0, width: 240, height: 40, right: 240, bottom: 40,
      x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect)
    runtime.surfaces.register({
      id: 'cached-drawer', type: 'drawer', layout: 'grid', element: viewport,
      layoutElement: () => viewport, measureLayout, accepts: ['project-card'],
    })

    await runtime.runGroupToggle({
      root, content, opening: true,
      mutate: () => { content.dataset.layoutOpen = 'true' },
      waitForLayout: () => undefined,
    })
    const firstCallCount = measureLayout.mock.calls.length
    await runtime.runGroupToggle({
      root, content, opening: true,
      mutate: () => { content.dataset.layoutOpen = 'true' },
      waitForLayout: () => undefined,
    })

    expect(firstCallCount).toBeGreaterThan(0)
    expect(measureLayout).toHaveBeenCalledTimes(firstCallCount)
    root.remove()
  })

  it('布局缓存显式失效后会重新测量 Surface', async () => {
    const runtime = new Runtime()
    const root = document.createElement('div')
    const viewport = document.createElement('div')
    const content = document.createElement('div')
    const measureLayout = vi.fn(() => ({ height: 120 }))
    viewport.dataset.layoutSurface = 'invalidated-drawer'
    content.dataset.layoutContent = 'invalidated-group'
    viewport.append(content)
    root.append(viewport)
    document.body.append(root)
    Object.defineProperty(content, 'scrollHeight', { configurable: true, value: 120 })
    content.getBoundingClientRect = () => ({ top: 0, left: 0, width: 280, height: 0, right: 280, bottom: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect)
    viewport.getBoundingClientRect = () => ({ top: 0, left: 0, width: 280, height: 80, right: 280, bottom: 80, x: 0, y: 0, toJSON: () => ({}) } as DOMRect)
    runtime.surfaces.register({ id: 'invalidated-drawer', type: 'drawer', layout: 'grid', element: viewport, layoutElement: () => viewport, measureLayout, accepts: [] })

    const options = {
      root, content, opening: true,
      mutate: () => { content.dataset.layoutOpen = 'true' },
      waitForLayout: () => undefined,
    } as const
    await runtime.runGroupToggle(options)
    const firstCallCount = measureLayout.mock.calls.length
    runtime.invalidateLayoutCache()
    await runtime.runGroupToggle(options)

    expect(measureLayout).toHaveBeenCalledTimes(firstCallCount * 2)
    root.remove()
  })

  it('只对 free landing 使用对象级释放速度上限', () => {
    const runtime = new Runtime()
    runtime.registerObjectType('canvas-card', {
      defaultVisualMode: 'detach',
      motion: {
        profile: {
          freeLanding: {
            duration: 550,
            easing: 'ease-out',
            coastSeconds: 0.12,
            maxCoast: 260,
            minVelocity: 30,
            release: { velocityScale: 1, maxVelocity: 2500 },
          },
        },
      },
    })
    runtime.registerObjectType('grid-card', {
      defaultVisualMode: 'detach',
      motion: {
        profile: {
          freeLanding: {
            duration: 550,
            easing: 'ease-out',
            coastSeconds: 0.12,
            maxCoast: 260,
            minVelocity: 30,
            release: { velocityScale: 0.2, maxVelocity: 100 },
          },
        },
      },
    })

    runtime.objects.register({ id: 'canvas:1', type: 'canvas-card', surfaceId: 'canvas', element: null, abilities: ['move'] })
    runtime.objects.register({ id: 'grid:1', type: 'grid-card', surfaceId: 'grid', element: null, abilities: ['move'] })
    runtime.surfaces.register({ id: 'canvas', type: 'canvas', layout: 'free', element: null, accepts: ['canvas-card'] })
    runtime.surfaces.register({ id: 'grid', type: 'list', layout: 'grid', element: null, accepts: ['grid-card'] })

    expect(runtime.getObjectReleaseMotionProfile('canvas:1')).toMatchObject({ velocityScale: 1, maxVelocity: 2500 })
    expect(runtime.getObjectReleaseMotionProfile('grid:1')).toMatchObject({ velocityScale: 1, maxVelocity: 5000 })
    expect(runtime.getObjectReleaseMotionProfile('grid:1', { columnId: 'canvas' })).toMatchObject({ velocityScale: 0.2, maxVelocity: 100 })
    expect(runtime.getObjectReleaseMotionProfile('canvas:1', { columnId: 'grid' })).toMatchObject({ velocityScale: 1, maxVelocity: 5000 })
    expect(shapeReleaseVelocity({ x: 5000, y: 0 }, runtime.getObjectReleaseMotionProfile('canvas:1'))).toEqual({ x: 2500, y: 0 })
    expect(shapeReleaseVelocity({ x: 5000, y: 0 }, runtime.getObjectReleaseMotionProfile('grid:1'))).toEqual({ x: 5000, y: 0 })
  })

  it('从对象所在 Surface 读取相机缩放，不从 Object 配置读取', () => {
    const runtime = new Runtime()
    const scale = { value: 1 }
    runtime.surfaces.register({
      id: 'canvas', type: 'canvas', layout: 'free', element: null, accepts: ['canvas-card'],
      camera: { scale: () => scale.value, origin: () => ({ left: 10, top: 20 }) },
    })
    runtime.registerObjectType('canvas-card', { defaultVisualMode: 'detach', camera: { enabled: true } })
    const source = document.createElement('article')
    document.body.append(source)
    runtime.objects.register({ id: 'canvas:1', type: 'canvas-card', surfaceId: 'canvas', element: source, abilities: ['move'] })
    const session = runtime.startSession('move', 'canvas:1')
    const context = runtime.createVisualLifecycleContext(session.id, { toSurfaceId: 'canvas' }, source)
    expect(typeof context.contentScale === 'function' ? context.contentScale() : context.contentScale).toBe(1)
    expect(context.cameraOrigin?.()).toEqual({ left: 10, top: 20 })
    scale.value = 1.5
    expect(typeof context.contentScale === 'function' ? context.contentScale() : context.contentScale).toBe(1.5)
    source.remove()
  })

  it('Phase 1B：对象 camera 配置隔离未声明对象', () => {
    const runtime = new Runtime()
    runtime.surfaces.register({
      id: 'canvas', type: 'canvas', layout: 'free', element: null, accepts: ['plain-card', 'camera-card'],
      camera: { scale: 1.5, origin: () => ({ left: 10, top: 20 }) },
    })
    runtime.registerObjectType('plain-card', { defaultVisualMode: 'detach' })
    runtime.registerObjectType('camera-card', { defaultVisualMode: 'detach', camera: { enabled: true } })
    runtime.objects.register({ id: 'plain:1', type: 'plain-card', surfaceId: 'canvas', element: null, abilities: ['move'] })
    runtime.objects.register({ id: 'camera:1', type: 'camera-card', surfaceId: 'canvas', element: null, abilities: ['move'] })

    expect(runtime.getObjectCameraConfig('plain:1')).toEqual({ enabled: false, pickup: true, scale: true, origin: true, landing: true })
    expect(runtime.getObjectCameraConfig('camera:1')).toEqual({ enabled: true, pickup: true, scale: true, origin: true, landing: true })
    expect(runtime.getObjectCameraConfig('missing')).toEqual({ enabled: false, pickup: true, scale: true, origin: true, landing: true })

    const plainSession = runtime.startSession('move', 'plain:1')
    const cameraSession = runtime.startSession('move', 'camera:1')
    const plainContext = runtime.createVisualLifecycleContext(plainSession.id, { toSurfaceId: 'canvas' })
    const cameraContext = runtime.createVisualLifecycleContext(cameraSession.id, { toSurfaceId: 'canvas' })
    expect(plainContext.contentScale).toBeUndefined()
    expect(plainContext.cameraOrigin).toBeUndefined()
    expect(plainContext.landingCameraOrigin?.()).toEqual({ left: 10, top: 20 })
    expect(cameraContext.contentScale).toBe(1.5)
    expect(cameraContext.cameraOrigin?.()).toEqual({ left: 10, top: 20 })
  })

  it('普通对象跨 grid landing 不锁定源内容倍率，camera 对象才恢复到 grid 的 1x', () => {
    const runtime = new Runtime()
    const grid = document.createElement('div')
    runtime.surfaces.register({
      id: 'grid', type: 'list', layout: 'grid', element: grid,
      accepts: ['plain-card', 'camera-card'],
    })
    runtime.registerObjectType('plain-card', { defaultVisualMode: 'detach' })
    runtime.registerObjectType('camera-card', { defaultVisualMode: 'detach', camera: { enabled: true } })
    runtime.objects.register({ id: 'plain:1', type: 'plain-card', surfaceId: 'grid', element: null, abilities: ['move'] })
    runtime.objects.register({ id: 'camera:1', type: 'camera-card', surfaceId: 'grid', element: null, abilities: ['move'] })

    const plain = runtime.createVisualLifecycleContext(
      runtime.startSession('move', 'plain:1').id,
      { toSurfaceId: 'grid' },
    )
    const camera = runtime.createVisualLifecycleContext(
      runtime.startSession('move', 'camera:1').id,
      { toSurfaceId: 'grid' },
    )
    expect(plain.landingContentScale).toBeUndefined()
    expect(camera.landingContentScale).toBe(1)
    grid.remove()
  })

  it('camera: false 与未声明对象都关闭对象级摄像机适配', () => {
    const runtime = new Runtime()
    runtime.registerObjectType('plain-card', { defaultVisualMode: 'detach', camera: false })
    runtime.objects.register({ id: 'plain:1', type: 'plain-card', surfaceId: 'grid', element: null, abilities: ['move'] })
    expect(runtime.getObjectCameraConfig('plain:1')).toEqual({ enabled: false, pickup: true, scale: true, origin: true, landing: true })
  })

  it('camera 子开关会分别门控抓取倍率、内容 shell、origin 和 landing', () => {
    const runtime = new Runtime()
    const source = document.createElement('article')
    document.body.append(source)
    runtime.surfaces.register({
      id: 'canvas', type: 'canvas', layout: 'free', element: null, accepts: ['partial-camera'],
      camera: { scale: 1.7, origin: () => ({ left: 12, top: 24 }) },
    })
    runtime.registerObjectType('partial-camera', {
      defaultVisualMode: 'detach',
      camera: { enabled: true, pickup: false, scale: false, origin: false, landing: false },
    })
    runtime.objects.register({ id: 'partial:1', type: 'partial-camera', surfaceId: 'canvas', element: source, abilities: ['move'] })

    expect(runtime.getObjectCameraConfig('partial:1')).toEqual({
      enabled: true, pickup: false, scale: false, origin: false, landing: false,
    })
    const context = runtime.createVisualLifecycleContext(
      runtime.startSession('move', 'partial:1').id,
      { toSurfaceId: 'canvas' },
      source,
    )
    expect(context.camera).toEqual({
      enabled: true, pickup: false, scale: false, origin: false, landing: false,
    })
    expect(context.contentScale).toBeUndefined()
    expect(context.cameraOrigin).toBeUndefined()
    expect(context.landingContentScale).toBeUndefined()
    source.remove()
  })

  it('同一移动 session 复用 Surface 的抓取倍率曲线', () => {
    const runtime = new Runtime()
    let scale = 0.5
    runtime.surfaces.register({
      id: 'drawer',
      type: 'drawer',
      layout: 'grid',
      element: null,
      accepts: ['project-card'],
      camera: { scale: () => scale, pickupDuration: 160 },
    })

    const first = runtime.getSurfaceCameraPickupScale('drawer', 'session-1')
    const second = runtime.getSurfaceCameraPickupScale('drawer', 'session-1')

    expect(first).toBe(second)
    expect(first).toBeTypeOf('function')
    const readScale = () => typeof first === 'function' ? first() : first
    expect(readScale()).toBeCloseTo(1, 1)
    scale = 0.25
    expect(readScale()).toBeGreaterThanOrEqual(0.25)
    expect(readScale()).toBeLessThanOrEqual(1)
  })

  it('pointerup 冻结抓取倍率，landing 不继续消费 pickup 曲线', () => {
    const runtime = new Runtime()
    let scale = 0.5
    runtime.surfaces.register({
      id: 'drawer',
      type: 'drawer',
      layout: 'grid',
      element: null,
      accepts: ['project-card'],
      camera: { scale: () => scale, pickupDuration: 160 },
    })

    runtime.getSurfaceCameraPickupScale('drawer', 'session-1')
    const frozen = runtime.freezeSessionContentScale('session-1')
    expect(frozen).toBeGreaterThanOrEqual(0.5)
    expect(frozen).toBeLessThanOrEqual(1)

    scale = 0.25
    const afterFreeze = runtime.getSurfaceCameraPickupScale('drawer', 'session-1')
    expect(afterFreeze).toBe(frozen)
  })

  it('free landing 通过纯矩形解析，不要求目标 DOM', () => {
    const runtime = new Runtime()
    const element = document.createElement('article')
    runtime.registerObjectType('canvas-card', {
      defaultVisualMode: 'detach',
      resolveFreeLandingRect: () => ({ left: 320, top: 180, width: 120, height: 80 }),
    })
    runtime.objects.register({
      id: 'canvas:card:1',
      type: 'canvas-card',
      surfaceId: 'canvas:main',
      element,
      abilities: ['move'],
    })
    runtime.surfaces.register({ id: 'canvas:main', type: 'canvas', layout: 'free', element: null, accepts: ['canvas-card'] })

    const session = runtime.startSession('move', 'canvas:card:1')
    expect(runtime.resolveMoveLandingResolution(session.id, { toSurfaceId: 'canvas:main' })).toEqual({
      kind: 'rect',
      rect: { left: 320, top: 180, width: 120, height: 80 },
    })
  })

  it('free Surface 优先使用对象的连续落点，不被默认视觉目标覆盖', () => {
    const runtime = new Runtime()
    const source = document.createElement('article')
    document.body.append(source)
    runtime.registerObjectType('canvas-card', {
      defaultVisualMode: 'detach',
      resolveFreeLandingRect: () => ({ left: 320, top: 180, width: 120, height: 80 }),
    })
    runtime.objects.register({
      id: 'canvas:card:3',
      type: 'canvas-card',
      surfaceId: 'canvas:main',
      element: source,
      abilities: ['move'],
    })
    runtime.surfaces.register({
      id: 'canvas:main',
      type: 'canvas',
      layout: 'free',
      element: null,
      accepts: ['canvas-card'],
    })

    const session = runtime.startSession('move', 'canvas:card:3')
    expect(runtime.resolveMoveLandingResolution(session.id, { toSurfaceId: 'canvas:main' })).toEqual({
      kind: 'rect',
      rect: { left: 320, top: 180, width: 120, height: 80 },
    })
    source.remove()
  })

  it('Surface 外壳不作为语义 landing 目标，grid 落点保持普通 landing', () => {
    const runtime = new Runtime()
    const source = document.createElement('article')
    const surface = document.createElement('section')
    document.body.append(source, surface)
    runtime.objects.register({ id: 'project:1', type: 'project-card', surfaceId: 'column:todo', element: source, abilities: ['move'] })
    runtime.surfaces.register({ id: 'column:done', type: 'list', layout: 'grid', element: surface, accepts: ['project-card'] })
    const handle = runtime.start({
      type: 'move',
      objectId: 'project:1',
      input: { kind: 'programmatic' },
    })

    expect(runtime.resolveMoveLandingTarget(handle.id, { toSurfaceId: 'column:done' })).toBe(source)
    runtime.registerObjectType('canvas-card', { defaultVisualMode: 'detach' })
    runtime.surfaces.register({
      id: 'canvas:drawer',
      type: 'grid',
      element: surface,
      accepts: ['canvas-card'],
      layout: 'grid',
    })
    runtime.objects.register({ id: 'canvas:1', type: 'canvas-card', surfaceId: 'canvas', element: source, abilities: ['move'] })
    const canvasHandle = runtime.start({
      type: 'move',
      objectId: 'canvas:1',
      input: { kind: 'programmatic' },
    })
    expect(runtime.resolveMoveLandingTarget(canvasHandle.id, { toSurfaceId: 'canvas:drawer' })).toBe(source)
    expect(runtime.createVisualLifecycleContext(
      canvasHandle.id,
      { toSurfaceId: 'canvas:drawer' },
      surface,
    ).landingMode).toBe('default')
    runtime.cancel(handle.id)
    runtime.cancel(canvasHandle.id)
    source.remove()
    surface.remove()
  })

  it('free landing 的 invalidReturn 不调用自由落点解析器', () => {
    const runtime = new Runtime()
    const resolveFreeLandingRect = vi.fn(() => ({ left: 320, top: 180, width: 120, height: 80 }))
    runtime.registerObjectType('canvas-card', {
      defaultVisualMode: 'detach',
      resolveFreeLandingRect,
    })
    runtime.objects.register({ id: 'canvas:card:2', type: 'canvas-card', surfaceId: 'canvas:main', element: null, abilities: ['move'] })
    const session = runtime.startSession('move', 'canvas:card:2')

    expect(runtime.resolveMoveLandingResolution(session.id, { invalidReturn: true })).toBeNull()
    expect(resolveFreeLandingRect).not.toHaveBeenCalled()
  })

  it('Object 的嵌套 Target 会随对象登记、换绑和注销同步', () => {
    const runtime = new Runtime()
    const folder = document.createElement('article')

    runtime.objects.register({
      id: 'folder:references',
      type: 'folder-item',
      surfaceId: 'file:surface:browser',
      element: null,
      abilities: ['move'],
      target: {
        surfaceId: 'file:surface:folder:references',
        accepts: ['file-item'],
        priority: 2,
      },
    })

    const target = runtime.targets.snapshot()[0]
    expect(target?.surfaceId).toBe('file:surface:folder:references')
    expect(target?.element).toBeNull()

    runtime.objects.setElement('folder:references', folder)
    expect(target && runtime.targets.get(target.id)?.element).toBe(folder)

    runtime.objects.unregister('folder:references')
    expect(target && runtime.targets.get(target.id)).toBeUndefined()
  })

  it('通过 Runtime 统一转发 regrab handler', () => {
    const runtime = createRuntime()
    const handler = vi.fn()
    runtime.registerRegrab('card-1', handler)
    const event = new PointerEvent('pointerdown')

    expect(runtime.regrab('card-1', event)).toBe(true)
    expect(runtime.regrab('missing', event)).toBe(false)
    expect(handler).toHaveBeenCalledWith(event)
  })

  it('regrab 接管由 Runtime 统一中断旧 Session 并失效代理', () => {
    const runtime = createRuntime()
    const handle = runtime.start(createRequest())
    const session = runtime.getSession(handle.id)
    session?.transition('active')
    session?.transition('landing')
    const proxyDispose = vi.fn()
    runtime.registerVisualProxy(handle.id, { element: document.createElement('div'), dispose: proxyDispose })

    expect(runtime.takeoverRegrab(handle.id)).toBe(true)
    expect(runtime.getSession(handle.id)).toBeUndefined()
    expect(runtime.getVisualProxy(handle.id)).toBeUndefined()
    expect(proxyDispose).toHaveBeenCalledOnce()
  })

  it('Surface 目标滚动由 Runtime 统一保持在视口内', () => {
    const runtime = createRuntime()
    const viewport = document.createElement('div')
    const target = document.createElement('div')
    const rafCallbacks: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      rafCallbacks.push(callback)
      return rafCallbacks.length
    })
    vi.stubGlobal('cancelAnimationFrame', () => undefined)
    let targetTop = 40
    let scrollTop = 100
    Object.defineProperty(viewport, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => { scrollTop = value },
    })
    Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 1000 })
    Object.defineProperty(viewport, 'clientHeight', { configurable: true, value: 300 })
    vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 100, 200, 300))
    vi.spyOn(target, 'getBoundingClientRect').mockImplementation(() => new DOMRect(0, targetTop, 100, 40))
    Object.defineProperty(viewport, 'scrollTo', {
      value: ({ top }: ScrollToOptions) => { viewport.scrollTop = top ?? viewport.scrollTop },
    })
    viewport.append(target)
    document.body.append(viewport)
    runtime.surfaces.register({ id: 'surface:scroll', type: 'list', layout: 'grid', element: viewport, viewport: () => viewport, accepts: ['project-card'] })

    runtime.keepSurfaceTargetVisible('surface:scroll', target)
    expect(viewport.scrollTop).toBe(100)
    const firstFrame = rafCallbacks.shift()
    firstFrame?.(performance.now() + 250)
    expect(viewport.scrollTop).toBe(40)

    targetTop = 380
    runtime.keepSurfaceTargetVisible('surface:scroll', target)
    expect(viewport.scrollTop).toBe(40)
    const secondFrame = rafCallbacks.shift()
    secondFrame?.(performance.now() + 250)
    expect(viewport.scrollTop).toBe(60)
  })

  it('浮动 Surface 使用内部滚动视口，而不是外壳作为自动滚动容器', () => {
    const runtime = createRuntime()
    const shell = document.createElement('div')
    const viewport = document.createElement('div')
    const target = document.createElement('div')
    const rafCallbacks: FrameRequestCallback[] = []
    let shellScrollTop = 17
    let viewportScrollTop = 120

    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      rafCallbacks.push(callback)
      return rafCallbacks.length
    })
    vi.stubGlobal('cancelAnimationFrame', () => undefined)
    Object.defineProperty(shell, 'scrollTop', {
      configurable: true,
      get: () => shellScrollTop,
      set: (value: number) => { shellScrollTop = value },
    })
    Object.defineProperty(viewport, 'scrollTop', {
      configurable: true,
      get: () => viewportScrollTop,
      set: (value: number) => { viewportScrollTop = value },
    })
    Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 1200 })
    Object.defineProperty(viewport, 'clientHeight', { configurable: true, value: 320 })
    vi.spyOn(shell, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 40, 300, 580))
    vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 100, 300, 320))
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 430, 280, 48))
    Object.defineProperty(viewport, 'scrollTo', {
      value: ({ top }: ScrollToOptions) => { viewport.scrollTop = top ?? viewport.scrollTop },
    })
    viewport.append(target)
    shell.append(viewport)
    document.body.append(shell)

    runtime.surfaces.register({
      id: 'surface:floating-scroll',
      type: 'drawer',
      layout: 'grid',
      element: shell,
      layoutElement: () => shell,
      viewport: () => viewport,
      accepts: ['project-card'],
    })

    runtime.keepSurfaceTargetVisible('surface:floating-scroll', target)
    expect(shellScrollTop).toBe(17)
    expect(viewportScrollTop).toBe(120)
    rafCallbacks.shift()?.(performance.now() + 250)
    expect(shellScrollTop).toBe(17)
    expect(viewportScrollTop).toBe(178)

    shell.remove()
    vi.unstubAllGlobals()
  })

  it('浮动 Surface 的布局外壳与自然尺寸元素分离时仍由 Runtime 测量布局元素', async () => {
    vi.useFakeTimers()
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      return window.setTimeout(() => callback(performance.now()), 0)
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)
    const runtime = new Runtime()
    const root = document.createElement('div')
    const shell = document.createElement('div')
    const layoutElement = document.createElement('div')
    const content = document.createElement('div')
    const card = document.createElement('div')
    const measureLayout = vi.fn(() => ({ height: 180 }))

    layoutElement.dataset.layoutSurface = 'floating-drawer'
    content.dataset.layoutContent = 'floating-group'
    card.dataset.layoutRole = 'card'
    content.append(card)
    layoutElement.append(content)
    shell.append(layoutElement)
    root.append(shell)
    document.body.append(root)
    Object.defineProperty(content, 'scrollHeight', { configurable: true, value: 180 })
    shell.getBoundingClientRect = () => ({
      top: 0, left: 0, width: 320, height: 580, right: 320, bottom: 580,
      x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect)
    layoutElement.getBoundingClientRect = () => ({
      top: 0, left: 0, width: 320, height: 80, right: 320, bottom: 80,
      x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect)
    content.getBoundingClientRect = () => ({
      top: 0, left: 0, width: 320, height: 0, right: 320, bottom: 0,
      x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect)
    card.getBoundingClientRect = () => ({
      top: 0, left: 0, width: 280, height: 40, right: 280, bottom: 40,
      x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect)
    runtime.surfaces.register({
      id: 'floating-drawer',
      type: 'drawer',
      layout: 'grid',
      element: shell,
      layoutElement: () => layoutElement,
      measureLayout,
      accepts: ['project-card'],
    })

    try {
      const toggle = runtime.runGroupToggle({
        root,
        content,
        opening: true,
        duration: 0,
        mutate: () => { content.dataset.layoutOpen = 'true' },
        waitForLayout: () => undefined,
      })
      await vi.advanceTimersByTimeAsync(100)
      await toggle

      expect(measureLayout).toHaveBeenCalled()
      expect(shell.dataset.runtimeLayoutTransaction).not.toBe('true')
    } finally {
      root.remove()
      vi.useRealTimers()
      vi.restoreAllMocks()
    }
  })

  it('Surface Lease 不允许后续 Session 覆盖当前控制权', () => {
    const runtime = createRuntime()
    const first = runtime.start(createRequest())
    const second = runtime.start(createRequest())

    expect(runtime.takeSurface(first.id, 'column:todo')).toBe(true)
    expect(runtime.takeSurface(second.id, 'column:todo')).toBe(false)
    expect(runtime.isControlled('column:todo')).toBe(true)

    runtime.cancel(first.id)
    runtime.cancel(second.id)
  })

  it('对象类型可以由 Runtime 自动创建 Move Session', () => {
    const runtime = createRuntime()
    const driver = createDriver(() => undefined)
    const createMove = vi.fn(() => ({ driver }))
    runtime.registerObjectType('project-card', {
      defaultVisualMode: 'detach',
      createMove,
    })
    const element = document.createElement('div')

    expect(runtime.startObjectPointer('card-1', element, new PointerEvent('pointerdown'))).toBe(true)
    expect(createMove).toHaveBeenCalledOnce()
    expect(runtime.snapshot().objects.find(object => object.id === 'card-1')?.element).toBe(element)
  })

  it('视觉适配器按对象 visual 配置解析', () => {
    const runtime = createRuntime()
    const adapter = { resolveSource: () => null }
    runtime.registerVisualAdapter('kanban', adapter)
    runtime.objects.setElement('card-1', null)
    const object = runtime.objects.get('card-1')!
    object.visual = 'kanban'

    expect(runtime.getObjectVisualAdapter('card-1')).toBe(adapter)
  })

  it('默认 VisualAdapter 保持 source/target 与状态 class 逻辑', () => {
    const runtime = createRuntime()
    runtime.visuals.remove('project-card')
    const source = document.createElement('div')
    source.dataset.card = 'card-1'
    document.body.appendChild(source)

    const adapter = runtime.getObjectVisualAdapter('card-1')
    adapter.applyState?.(source, {
      phase: 'dragging',
      hovered: false,
      selected: false,
      grabbed: true,
    })
    expect(source.dataset.runtimePhase).toBe('dragging')
    expect(source.classList.contains('is-grabbed')).toBe(true)
    source.remove()
  })

  it('target landing 对无效回位降级为普通 landing', () => {
    const runtime = createRuntime()
    runtime.registerObjectType('project-card', {
      defaultVisualMode: 'detach',
    })
    const source = document.createElement('div')
    const semanticTarget = document.createElement('div')
    document.body.append(source, semanticTarget)
    runtime.targets.register({
      id: 'done-target',
      surfaceId: 'column:done',
      element: semanticTarget,
      accepts: ['project-card'],
    })
    runtime.objects.setElement('card-1', source)
    const session = runtime.start(createRequest())

    const targetContext = runtime.createVisualLifecycleContext(session.id, {
      columnId: 'column:done',
    }, semanticTarget, undefined)
    const sameNodeContext = runtime.createVisualLifecycleContext(session.id, {
      columnId: 'column:todo',
    }, source, undefined)
    const returnContext = runtime.createVisualLifecycleContext(session.id, {
      columnId: 'column:todo',
      invalidReturn: true,
    }, undefined, undefined)

    expect(targetContext.landingMode).toBe('target')
    expect(sameNodeContext.landingMode).toBe('default')
    expect(returnContext.landingMode).toBe('default')
    source.remove()
    semanticTarget.remove()
  })

  it('VisualProxy 替换与取消都经过 Runtime 的统一清理边界', () => {
    const runtime = createRuntime()
    const handle = runtime.start(createRequest())
    const firstDispose = vi.fn()
    const secondDispose = vi.fn()
    const first = { element: document.createElement('div'), dispose: firstDispose }
    const second = { element: document.createElement('div'), dispose: secondDispose }

    runtime.registerVisualProxy(handle.id, first)
    runtime.registerVisualProxy(handle.id, second)
    expect(firstDispose).toHaveBeenCalledOnce()
    expect(runtime.getVisualProxy(handle.id)).toBe(second)

    runtime.cancel(handle.id)
    expect(secondDispose).toHaveBeenCalledOnce()
    expect(runtime.getVisualProxy(handle.id)).toBeUndefined()
  })

  it('通过对象 VisualAdapter 创建并登记代理', () => {
    const runtime = new Runtime()
    const element = document.createElement('div')
    const proxyElement = document.createElement('div')
    runtime.objects.register({
      id: 'card-visual',
      type: 'visual-card',
      surfaceId: 'surface:visual',
      element,
      abilities: ['move'],
    })
    runtime.registerObjectType('visual-card', {
      defaultVisualMode: 'detach',
      visual: {
        createProxy: context => {
          expect(context.objectId).toBe('card-visual')
          expect(context.sessionId).toBe(handle.id)
          return { element: proxyElement }
        },
      },
    })
    runtime.registerVisualAdapter('visual-card', { resolveSource: () => null })
    const handle = runtime.start({
      type: 'move',
      objectId: 'card-visual',
      input: { kind: 'programmatic' },
    })
    expect(runtime.getSession(handle.id)).toBeDefined()

    const proxy = runtime.createVisualProxy(
      handle.id,
      runtime.createVisualLifecycleContext(handle.id),
    )

    expect(proxy?.element).toBe(proxyElement)
    expect(runtime.getVisualProxy(handle.id)?.element).toBe(proxyElement)
    runtime.cancel(handle.id)
    expect(runtime.getVisualProxy(handle.id)).toBeUndefined()
  })

  it('通过 Runtime 顺序调用 VisualAdapter 的 landing 和 reveal', async () => {
    const runtime = new Runtime()
    const source = document.createElement('div')
    const proxyElement = document.createElement('div')
    const target = document.createElement('div')
    const calls: string[] = []
    runtime.objects.register({
      id: 'card-lifecycle',
      type: 'lifecycle-card',
      surfaceId: 'surface:lifecycle',
      element: source,
      abilities: ['move'],
    })
    runtime.registerVisualAdapter('lifecycle-card', { resolveSource: () => source })
    runtime.registerObjectType('lifecycle-card', {
      defaultVisualMode: 'detach',
      visual: {
        createProxy: () => ({ element: proxyElement }),
        land: async (_proxy, _target, context) => {
          calls.push(`land:${context.objectId}`)
          return { completed: true }
        },
        reveal: async (_proxy, _target, context) => {
          calls.push(`reveal:${context.objectId}`)
        },
      },
    })
    const handle = runtime.start({
      type: 'move',
      objectId: 'card-lifecycle',
      input: { kind: 'programmatic' },
    })
    runtime.createVisualProxy(handle.id, runtime.createVisualLifecycleContext(handle.id))

    expect(await runtime.landVisualProxy(handle.id, target)).toEqual({ completed: true })
    await runtime.revealVisualProxy(handle.id, target)
    expect(calls).toEqual(['land:card-lifecycle', 'reveal:card-lifecycle'])
    runtime.cancel(handle.id)
  })

  it('释放代理时由适配器接管完整清理', () => {
    const runtime = new Runtime()
    const source = document.createElement('div')
    const proxyElement = document.createElement('div')
    const disposeAdapter = vi.fn()
    const disposeProxy = vi.fn()
    runtime.objects.register({
      id: 'card-dispose',
      type: 'dispose-card',
      surfaceId: 'surface:dispose',
      element: source,
      abilities: ['move'],
    })
    runtime.registerVisualAdapter('dispose-card', { resolveSource: () => source })
    runtime.registerObjectType('dispose-card', {
      defaultVisualMode: 'detach',
      visual: {
        createProxy: () => ({ element: proxyElement, dispose: disposeProxy }),
        dispose: disposeAdapter,
      },
    })
    const handle = runtime.start({
      type: 'move',
      objectId: 'card-dispose',
      input: { kind: 'programmatic' },
    })
    runtime.createVisualProxy(handle.id, runtime.createVisualLifecycleContext(handle.id))

    runtime.disposeVisualProxy(handle.id)
    expect(disposeAdapter).toHaveBeenCalledOnce()
    expect(disposeProxy).not.toHaveBeenCalled()
  })

  it('适配器接管 dispose 时 Runtime 不会重复调用 proxy.dispose', () => {
    const runtime = new Runtime()
    const source = document.createElement('div')
    const proxyElement = document.createElement('div')
    const disposeAdapter = vi.fn()
    const disposeProxy = vi.fn()
    runtime.objects.register({
      id: 'card-adapter-dispose',
      type: 'adapter-dispose-card',
      surfaceId: 'surface:adapter-dispose',
      element: source,
      abilities: ['move'],
    })
    runtime.registerObjectType('adapter-dispose-card', {
      defaultVisualMode: 'detach',
      visual: {
        createProxy: () => ({ element: proxyElement, dispose: disposeProxy }),
        dispose: disposeAdapter,
      },
    })
    const handle = runtime.start({
      type: 'move',
      objectId: 'card-adapter-dispose',
      input: { kind: 'programmatic' },
    })
    runtime.createVisualProxy(handle.id, runtime.createVisualLifecycleContext(handle.id))

    runtime.disposeVisualProxy(handle.id)

    expect(disposeAdapter).toHaveBeenCalledOnce()
    expect(disposeProxy).not.toHaveBeenCalled()
  })

  it('每次 Runtime.start 只创建一个 Session', () => {
    const runtime = createRuntime()
    const first = runtime.start({ type: 'move', objectId: 'card-1', input: { kind: 'programmatic' } })
    const second = runtime.start({ type: 'move', objectId: 'card-1', input: { kind: 'programmatic' } })

    const firstNumber = Number(first.id.replace('session-', ''))
    const secondNumber = Number(second.id.replace('session-', ''))
    expect(secondNumber - firstNumber).toBe(1)
    runtime.cancel(first.id)
    runtime.cancel(second.id)
  })

  it('结束 Session 前先销毁 VisualAdapter 代理，避免代理 DOM 残留', () => {
    const runtime = new Runtime()
    const source = document.createElement('div')
    const proxyElement = document.createElement('div')
    const disposeAdapter = vi.fn()
    const disposeProxy = vi.fn()
    runtime.objects.register({
      id: 'card-finalize',
      type: 'finalize-card',
      surfaceId: 'surface:finalize',
      element: source,
      abilities: ['move'],
    })
    runtime.registerObjectType('finalize-card', {
      defaultVisualMode: 'detach',
      visual: {
        createProxy: () => ({ element: proxyElement, dispose: disposeProxy }),
        dispose: disposeAdapter,
      },
    })
    const handle = runtime.start({ type: 'move', objectId: 'card-finalize', input: { kind: 'programmatic' } })
    runtime.createVisualProxy(handle.id, runtime.createVisualLifecycleContext(handle.id))
    const session = runtime.getSession(handle.id)!
    session.transition('release')
    session.transition('landing')
    session.handoff()

    runtime.endSession(session)

    expect(disposeAdapter).toHaveBeenCalledOnce()
    expect(disposeProxy).not.toHaveBeenCalled()
    expect(runtime.getSession(handle.id)).toBeUndefined()
  })

  it('将代理更新转发给当前对象适配器', () => {
    const runtime = new Runtime()
    const source = document.createElement('div')
    const proxyElement = document.createElement('div')
    const update = vi.fn()
    runtime.objects.register({
      id: 'card-update',
      type: 'update-card',
      surfaceId: 'surface:update',
      element: source,
      abilities: ['move'],
    })
    runtime.registerVisualAdapter('update-card', { resolveSource: () => source })
    runtime.registerObjectType('update-card', {
      defaultVisualMode: 'detach',
      visual: {
        createProxy: () => ({ element: proxyElement }),
        updateProxy: update,
      },
    })
    const handle = runtime.start({
      type: 'move',
      objectId: 'card-update',
      input: { kind: 'programmatic' },
    })
    runtime.createVisualProxy(handle.id, runtime.createVisualLifecycleContext(handle.id))

    runtime.updateVisualProxy(handle.id)
    expect(update).toHaveBeenCalledOnce()
    runtime.cancel(handle.id)
  })

  it('通过对象适配器解析并校验最终目标节点', () => {
    const runtime = new Runtime()
    const source = document.createElement('div')
    const target = document.createElement('div')
    const resolveTarget = vi.fn(() => target)
    runtime.objects.register({
      id: 'card-target',
      type: 'target-card',
      surfaceId: 'surface:target',
      element: source,
      abilities: ['move'],
    })
    runtime.registerVisualAdapter('target-card', { resolveSource: () => source })
    runtime.registerObjectType('target-card', {
      defaultVisualMode: 'detach',
      visual: { resolveTarget },
    })
    const handle = runtime.start({
      type: 'move',
      objectId: 'card-target',
      input: { kind: 'programmatic' },
    })

    expect(runtime.resolveVisualTarget(handle.id, { surfaceId: 'surface:target' })).toBeNull()
    document.body.appendChild(target)
    expect(runtime.resolveVisualTarget(handle.id, { surfaceId: 'surface:target' })).toBe(target)
    expect(resolveTarget).toHaveBeenCalledTimes(2)
    runtime.cancel(handle.id)
  })

  it('通过对象适配器应用统一视觉状态', () => {
    const runtime = new Runtime()
    const element = document.createElement('div')
    const applyState = vi.fn()
    runtime.objects.register({
      id: 'card-state',
      type: 'state-card',
      surfaceId: 'surface:state',
      element,
      abilities: ['move'],
    })
    runtime.registerObjectType('state-card', {
      defaultVisualMode: 'detach',
      visual: { applyState },
    })
    const state = { phase: 'dragging' as const, hovered: false, selected: false, grabbed: true }

    runtime.applyVisualState('card-state', element, state)
    expect(applyState).toHaveBeenCalledWith(element, state)
  })

  it('未覆盖 applyState 时使用 Runtime 默认视觉状态实现', () => {
    const runtime = new Runtime()
    const element = document.createElement('div')
    runtime.objects.register({
      id: 'card-default-state',
      type: 'default-state-card',
      surfaceId: 'surface:default-state',
      element,
      abilities: ['move'],
    })
    runtime.registerObjectType('default-state-card', { defaultVisualMode: 'detach', visual: {} })

    runtime.applyVisualState('card-default-state', element, {
      phase: 'dragging', hovered: false, selected: false, grabbed: true,
    })

    expect(element.dataset.runtimePhase).toBe('dragging')
    expect(element.classList.contains('is-grabbed')).toBe(true)
  })

  it('落地揭示结束后恢复卡片附加交互', () => {
    const runtime = new Runtime()
    const element = document.createElement('div')
    const affordances = document.createElement('div')
    affordances.className = 'card-affordances'
    affordances.dataset.cardAffordances = ''
    const action = document.createElement('button')
    affordances.append(action)
    element.append(affordances)
    runtime.objects.register({
      id: 'card-affordances-lifecycle',
      type: 'affordances-card',
      surfaceId: 'surface:affordances',
      element,
      abilities: ['move'],
    })
    runtime.registerObjectType('affordances-card', {
      defaultVisualMode: 'detach',
      visual: {},
      affordances: { selector: '[data-card-affordances]' },
    })

    runtime.applyVisualState('card-affordances-lifecycle', element, {
      phase: 'dragging', hovered: false, selected: false, grabbed: true,
    })
    expect(affordances.classList.contains('runtime-affordances-hidden')).toBe(true)
    expect(action.classList.contains('runtime-affordances-hidden')).toBe(true)

    runtime.applyVisualState('card-affordances-lifecycle', element, {
      phase: 'idle', hovered: false, selected: false, grabbed: false,
    })
    expect(affordances.classList.contains('runtime-affordances-hidden')).toBe(false)
    expect(action.classList.contains('runtime-affordances-hidden')).toBe(false)
  })

  it('通过 Runtime 获取默认视觉快照', () => {
    const runtime = new Runtime()
    const element = document.createElement('div')
    element.style.opacity = '0.7'
    runtime.objects.register({
      id: 'card-snapshot',
      type: 'snapshot-card',
      surfaceId: 'surface:snapshot',
      element,
      abilities: ['move'],
    })
    runtime.registerObjectType('snapshot-card', { defaultVisualMode: 'detach', visual: {} })

    const snapshot = runtime.captureVisualState('card-snapshot', element)
    expect(snapshot.opacity).toBe('0.7')
    expect(snapshot.rect).toHaveProperty('width')
  })

  it('对象级 pointerInput 由 Runtime 统一执行拖拽阈值，未越过阈值保留 click', () => {
    const runtime = createRuntime()
    const createMove = vi.fn(() => ({ driver: createDriver(() => undefined) }))
    runtime.registerObjectType('project-card', {
      defaultVisualMode: 'detach',
      pointerInput: { dragThreshold: 10 },
      createMove,
    })
    const element = document.createElement('div')
    runtime.objects.setElement('card-1', element)

    element.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      pointerType: 'mouse',
      clientX: 10,
      clientY: 10,
    }))
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 15, clientY: 10 }))
    expect(createMove).not.toHaveBeenCalled()
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 21, clientY: 10 }))
    expect(createMove).toHaveBeenCalledOnce()
    window.dispatchEvent(new PointerEvent('pointerup'))
  })

  it('统一输入入口会把 pointercancel 转为一次性 cancel', async () => {
    const runtime = createRuntime()
    const handle = runtime.orchestrateMoveSession(createRequest(), {
      driver: createDriver(() => undefined),
      pointerInput: { target: window },
    })

    window.dispatchEvent(new PointerEvent('pointercancel'))
    await Promise.resolve()

    expect(runtime.getSession(handle.id)).toBeUndefined()
  })

  it('完成 gate 只允许当前 Session 完成一次，Session 结束会失效', async () => {
    const runtime = createRuntime()
    const handle = runtime.start(createRequest())
    const gate = runtime.createCompletionGate(handle.id, { completed: false, reason: 'disposed' })

    gate.complete({ completed: true, reason: '' })
    gate.complete({ completed: false, reason: 'late' })
    await expect(gate.promise).resolves.toEqual({ completed: true, reason: '' })

    const second = runtime.start(createRequest())
    const cancelledGate = runtime.createCompletionGate(second.id, { completed: false, reason: 'cancelled' })
    runtime.cancel(second.id)
    await expect(cancelledGate.promise).resolves.toEqual({ completed: false, reason: 'cancelled' })
  })

  it('按对象类型自动绑定 VisualStrategy 生命周期', async () => {
    const runtime = createRuntime()
    const events: string[] = []
    runtime.registerVisualStrategy('project-card', {
      beginDrag: () => { events.push('begin') },
      landing: () => { events.push('landing'); return { completed: true } },
      reveal: () => { events.push('reveal') },
      dispose: () => { events.push('dispose') },
    })
    const handle = runtime.start(createRequest())
    runtime.bindMoveSession(handle.id, createDriver(() => undefined))

    await runtime.release(handle.id, { kind: 'pointerup', event: new PointerEvent('pointerup') })

    expect(events).toEqual(['begin', 'landing', 'reveal', 'dispose'])
  })

  it('由 Runtime 为移动目标生成一次 MoveAction', async () => {
    const runtime = createRuntime()
    const actions: unknown[] = []
    runtime.onAction(action => { actions.push(action) })
    const handle = runtime.start(createRequest())
    runtime.bindMoveSession(handle.id, createDriver(() => undefined))

    await runtime.release(handle.id, { kind: 'pointerup', event: new PointerEvent('pointerup') })

    expect(actions).toEqual([expect.objectContaining({
      type: 'move',
      objectId: 'card-1',
      fromSurfaceId: 'column:todo',
      toSurfaceId: 'column:done',
      toIndex: 0,
    })])
  })

  it('无效落点的视觉回归不输出业务 Action，仍进入一次 landing', async () => {
    const runtime = createRuntime()
    const actions: unknown[] = []
    const landing = vi.fn(() => ({ completed: true }))
    runtime.onAction(action => { actions.push(action) })
    const handle = runtime.start(createRequest())
    runtime.bindMoveSession(handle.id, {
      resolveDestination: () => ({
        accepted: true,
        emitAction: false,
        destination: { columnId: 'column:todo', index: 0 },
      }),
      commit: () => undefined,
    })
    runtime.bindMoveLifecycle(handle.id, { landing })

    await runtime.release(handle.id, { kind: 'pointerup', event: new PointerEvent('pointerup') })

    expect(actions).toEqual([])
    expect(landing).toHaveBeenCalledOnce()
  })

  it('由 Runtime 编排 Surface leave → Action → enter → dispose', async () => {
    const runtime = createRuntime()
    const events: string[] = []
    const handle = runtime.start(createRequest())
    runtime.bindMoveSession(handle.id, createDriver(() => { events.push('action') }))
    runtime.bindMoveLifecycle(handle.id, {
      surface: {
        leave: (_context, surfaceId) => { events.push(`leave:${surfaceId}`) },
        enter: (_context, surfaceId) => { events.push(`enter:${surfaceId}`) },
        dispose: () => { events.push('surface-dispose') },
      },
      landing: () => ({ completed: true }),
    })

    await runtime.release(handle.id, { kind: 'pointerup', event: new PointerEvent('pointerup') })

    expect(events).toEqual([
      'action',
      'leave:column:todo',
      'enter:column:done',
      'surface-dispose',
    ])
  })

  it('将业务侧 columnId/index 落点归一为 MoveAction', async () => {
    const runtime = createRuntime()
    const actions: unknown[] = []
    runtime.onAction(action => { actions.push(action) })
    const handle = runtime.start(createRequest())
    runtime.bindMoveSession(handle.id, {
      resolveDestination: () => ({ accepted: true, destination: { columnId: 'done', index: 0 } }),
      commit: () => undefined,
    })

    await runtime.release(handle.id, { kind: 'pointerup', event: new PointerEvent('pointerup') })

    expect(actions).toEqual([expect.objectContaining({
      fromSurfaceId: 'column:todo',
      // Surface ID 是业务注册的 opaque ID；Runtime 不追加 demo 的 column: 前缀。
      toSurfaceId: 'done',
      toIndex: 0,
    })])
  })

  it('成功路径按 landing → handoff → reveal → dispose 完成', async () => {
    const runtime = createRuntime()
    const events: string[] = []
    const lifecycle: MoveVisualLifecycle = {
      landing: () => { events.push('landing'); return { completed: true } },
      reveal: () => { events.push('reveal') },
    }
    const handle = runtime.start(createRequest())
    runtime.bindMoveSession(handle.id, createDriver(() => { events.push('commit') }))
    runtime.bindMoveLifecycle(handle.id, lifecycle)

    await runtime.release(handle.id, { kind: 'pointerup', event: new PointerEvent('pointerup') })

    expect(events).toEqual(['commit', 'landing', 'reveal'])
    expect(runtime.getSession(handle.id)).toBeUndefined()
  })

  it('由 Runtime 在 Action 与渲染门后编排布局 capture/play', async () => {
    const runtime = createRuntime()
    const events: string[] = []
    runtime.onAction(async () => {
      events.push('action')
      await Promise.resolve()
      events.push('rendered')
    })
    const handle = runtime.start(createRequest())
    runtime.bindMoveSession(handle.id, createDriver(() => { events.push('commit') }))
    runtime.bindMoveLifecycle(handle.id, {
      layout: {
        capture: () => { events.push('capture'); return { id: 'layout-1' } },
        play: (_context, snapshot) => { events.push(`play:${(snapshot as { id: string }).id}`) },
      },
      landing: () => ({ completed: true }),
    })

    await runtime.release(handle.id, { kind: 'pointerup', event: new PointerEvent('pointerup') })

    expect(events).toEqual(['capture', 'commit', 'action', 'rendered', 'play:layout-1'])
  })

  it('commit 失败时不进入 landing/reveal 且清理 session', async () => {
    const runtime = createRuntime()
    const landing = vi.fn()
    const reveal = vi.fn()
    const handle = runtime.start(createRequest())
    runtime.bindMoveSession(handle.id, createDriver(() => { throw new Error('commit failed') }))
    runtime.bindMoveLifecycle(handle.id, { landing, reveal })

    await runtime.release(handle.id, { kind: 'pointerup', event: new PointerEvent('pointerup') })

    expect(landing).not.toHaveBeenCalled()
    expect(reveal).not.toHaveBeenCalled()
    expect(runtime.getSession(handle.id)).toBeUndefined()
  })

  it('landing 失败时不触发 reveal', async () => {
    const runtime = createRuntime()
    const reveal = vi.fn()
    const handle = runtime.start(createRequest())
    runtime.bindMoveSession(handle.id, createDriver(() => undefined))
    runtime.bindMoveLifecycle(handle.id, {
      landing: () => ({ completed: false, reason: 'target-invalid' }),
      reveal,
    })

    await runtime.release(handle.id, { kind: 'pointerup', event: new PointerEvent('pointerup') })

    expect(reveal).not.toHaveBeenCalled()
    expect(runtime.getSession(handle.id)).toBeUndefined()
  })

  it('landing 被 interrupt 后，旧 Promise 完成不能触发 reveal', async () => {
    const runtime = createRuntime()
    const reveal = vi.fn()
    const cancel = vi.fn()
    let resolveLanding!: (result: { completed: boolean }) => void
    const landing = new Promise<{ completed: boolean }>(resolve => { resolveLanding = resolve })
    const handle = runtime.start(createRequest())
    runtime.bindMoveSession(handle.id, createDriver(() => undefined))
    runtime.bindMoveLifecycle(handle.id, { landing: () => landing, reveal, cancel })

    const release = runtime.release(handle.id, { kind: 'pointerup', event: new PointerEvent('pointerup') })
    await Promise.resolve()
    runtime.interrupt(handle.id, 'regrab')
    resolveLanding({ completed: true })
    await release

    expect(reveal).not.toHaveBeenCalled()
    expect(cancel).toHaveBeenCalledWith(expect.anything(), 'regrab')
    expect(runtime.getSession(handle.id)).toBeUndefined()
  })
})
