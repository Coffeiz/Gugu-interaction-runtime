import { describe, expect, it, vi } from 'vitest'
import { Runtime } from '../Runtime'
import { createDetachMoveFromAdapter } from '../runtime/move/MoveAdapter'
import { DefaultVisualAdapter } from '../dom/VisualAdapter'
import { createDragProxy, destroyDragProxy } from '../dom/Visual'
import * as VisualModule from '../dom/Visual'
import * as CardMotionControllerModule from '../motion/CardMotionController'
import * as DirectFollowControllerModule from '../motion/DirectFollowController'

function rect(left = 100, top = 100, width = 60, height = 40): DOMRect {
  return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() {} }
}

/** 搭一个可以手动驱动 grabbing/follow/release 阶段的最小 Runtime + Session。 */
function setup(objectId: string, motion?: { enabled?: boolean }) {
  const runtime = new Runtime()
  const element = document.createElement('div')
  element.className = 'card'
  document.body.append(element)
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(rect())

  const surfaceEl = document.createElement('div')
  document.body.append(surfaceEl)
  vi.spyOn(surfaceEl, 'getBoundingClientRect').mockReturnValue(rect(0, 0, 800, 600))

  runtime.registerObjectType('card', { defaultVisualMode: 'detach', motion })
  runtime.surfaces.register({ id: 'surface:a', type: 'list', layout: 'grid', element: surfaceEl, accepts: ['card'] })
  runtime.objects.register({ id: objectId, type: 'card', surfaceId: 'surface:a', element, abilities: ['move'] })

  const session = runtime.startSession('move', objectId)
  const pointerdown = new PointerEvent('pointerdown', { clientX: 120, clientY: 110 })
  const { driver } = createDetachMoveFromAdapter({ runtime, objectId, element, event: pointerdown })

  driver.prepare?.({ session } as never, undefined as never)
  session.transition('active')

  return { runtime, element, session, driver }
}

describe('motion.enabled 契约：grabbing/follow 阶段', () => {
  it('A. 未配置/enabled=true：仍然创建并驱动 CardMotionController', () => {
    const spy = vi.spyOn(CardMotionControllerModule, 'createCardMotionController')
    const directSpy = vi.spyOn(DirectFollowControllerModule, 'createDirectFollowController')
    const { driver, session } = setup('card:default')

    expect(spy).toHaveBeenCalledTimes(1)
    expect(directSpy).not.toHaveBeenCalled()

    // release 阶段能正常拿到状态、不抛错，走完 resolveDestination。
    const up = new PointerEvent('pointerup', { clientX: 130, clientY: 120 })
    const result = driver.resolveDestination?.({ session } as never, { kind: 'pointerup', event: up } as never) as { accepted: boolean } | undefined
    expect(result?.accepted).toBe(true)

    spy.mockRestore()
    directSpy.mockRestore()
  })

  it('B. enabled=false：grabbing 不创建 CardMotionController，改用 direct follow，pointermove 直接写 transform', () => {
    const cardSpy = vi.spyOn(CardMotionControllerModule, 'createCardMotionController')
    const directSpy = vi.spyOn(DirectFollowControllerModule, 'createDirectFollowController')
    const { driver, session, runtime } = setup('card:direct', { enabled: false })

    expect(cardSpy).not.toHaveBeenCalled()
    expect(directSpy).toHaveBeenCalledTimes(1)
    expect(runtime.getObjectMotionEnabled('card:direct')).toBe(false)

    const proxy = runtime.getVisualProxy(session.id)?.element as HTMLElement | undefined
    expect(proxy).toBeTruthy()

    const move1 = new PointerEvent('pointermove', { clientX: 300, clientY: 260 })
    driver.update?.({ session } as never, { kind: 'pointermove', event: move1 } as never)
    const parseTranslate = (transform: string) => {
      const match = transform.match(/translate3d\(([-\d.]+)px, ([-\d.]+)px, 0\)/)
      return { x: Number(match?.[1]), y: Number(match?.[2]) }
    }
    const afterFirst = parseTranslate(proxy!.style.transform)

    // direct follow 没有弹簧插值/惯性：第二次 pointermove 应立即把 transform 精确
    // 平移了两次指针坐标之间的差值（40, 60），不带任何 tilt/sway/scale 姿态。
    const move2 = new PointerEvent('pointermove', { clientX: 340, clientY: 320 })
    driver.update?.({ session } as never, { kind: 'pointermove', event: move2 } as never)
    const afterSecond = parseTranslate(proxy!.style.transform)
    expect(afterSecond.x - afterFirst.x).toBeCloseTo(40, 5)
    expect(afterSecond.y - afterFirst.y).toBeCloseTo(60, 5)
    expect(proxy!.style.transform).toContain('rotateX(0.00deg)')
    expect(proxy!.style.transform).toContain('rotateZ(0.00deg)')
    expect(proxy!.style.transform).toContain('scale(1.0000, 1.0000)')

    const up = new PointerEvent('pointerup', { clientX: 300, clientY: 260 })
    const result = driver.resolveDestination?.({ session } as never, { kind: 'pointerup', event: up } as never) as { accepted: boolean } | undefined
    expect(result?.accepted).toBe(true)

    cardSpy.mockRestore()
    directSpy.mockRestore()
  })

  it('C. createDirectFollowController 自身契约：release 不携带速度（vx/vy 恒为 0）', () => {
    const direct = DirectFollowControllerModule.createDirectFollowController({ onFrame: () => undefined })
    direct.setTarget({ x: 10, y: 20 })
    direct.setTarget({ x: 40, y: 90 })
    const state = direct.getState()
    expect(state.x).toBe(40)
    expect(state.y).toBe(90)
    expect(state.vx).toBe(0)
    expect(state.vy).toBe(0)
    expect(state.rotateX).toBe(0)
    expect(state.rotateZ).toBe(0)
    expect(state.scaleX).toBe(1)
    expect(state.scaleY).toBe(1)
    expect(() => direct.stop()).not.toThrow()
  })
})

describe('motion.enabled 契约：landing 阶段（DefaultVisualAdapter.land）', () => {
  function landingFixture() {
    const source = document.createElement('article')
    document.body.append(source)
    const target = document.createElement('article')
    document.body.append(target)
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(rect(200, 200, 60, 40))
    const proxy = createDragProxy(source, rect())
    return { source, target, proxy }
  }

  it('motionEnabled 未配置/true：使用 landDragProxyWithMotion 物理落地', async () => {
    const legacySpy = vi.spyOn(VisualModule, 'landDragProxyLegacy')
    const { target, proxy } = landingFixture()
    const adapter = new DefaultVisualAdapter()

    await adapter.land({ element: proxy }, target, {
      objectId: 'o', sessionId: 's', mode: 'detach',
    } as never)

    expect(legacySpy).not.toHaveBeenCalled()
    legacySpy.mockRestore()
    destroyDragProxy(proxy)
  })

  it('motionEnabled=false：切换到 landDragProxyLegacy 的 CSS 过渡落地，不经过 MotionController', async () => {
    const legacySpy = vi.spyOn(VisualModule, 'landDragProxyLegacy')
    const { target, proxy } = landingFixture()
    const adapter = new DefaultVisualAdapter()

    await adapter.land({ element: proxy }, target, {
      objectId: 'o', sessionId: 's', mode: 'detach', motionEnabled: false,
    } as never)

    expect(legacySpy).toHaveBeenCalledTimes(1)
    legacySpy.mockRestore()
    destroyDragProxy(proxy)
  })

  it('transform 过渡未完成时松手：landing 以当前呈现位置接管，避免首帧跳回 motion 终值', async () => {
    const { target, proxy } = landingFixture()
    const adapter = new DefaultVisualAdapter()
    proxy.style.left = '100px'
    proxy.style.top = '100px'
    proxy.style.width = '60px'
    proxy.style.height = '40px'
    proxy.style.transform = 'matrix(1, 0, 0, 1, 0, 0)'
    proxy.style.transition = 'transform 150ms ease'
    vi.spyOn(proxy, 'getBoundingClientRect').mockReturnValue(rect(110, 100, 60, 40))
    const landSpy = vi.spyOn(VisualModule, 'landDragProxyWithMotion').mockImplementation(() => ({
      finished: Promise.resolve(),
      retarget: vi.fn(),
    }) as never)

    await adapter.land({ element: proxy }, target, {
      objectId: 'o',
      sessionId: 's',
      mode: 'detach',
      motionState: { x: 120, y: 100, vx: 300, vy: 0, scaleX: 1, scaleY: 1, rotateX: 5, rotateZ: 1 },
    } as never)

    const motionOptions = landSpy.mock.calls[0]?.[2] as { motionState?: { x: number; y: number; vx: number } }
    expect(motionOptions.motionState).toMatchObject({ x: 110, y: 100, vx: 300 })
    landSpy.mockRestore()
    destroyDragProxy(proxy)
  })

  it('releaseMode=normal：只切换落地策略，不继承释放运动状态', async () => {
    const legacySpy = vi.spyOn(VisualModule, 'landDragProxyLegacy')
    const { target, proxy } = landingFixture()
    const adapter = new DefaultVisualAdapter()

    await adapter.land({ element: proxy }, target, {
      objectId: 'o', sessionId: 's', mode: 'detach', releaseMode: 'normal',
      motionState: { x: 0, y: 0, vx: 800, vy: -300, scaleX: 1.03, scaleY: 1.03, rotateX: 5, rotateZ: 2 },
    } as never)

    expect(legacySpy).toHaveBeenCalledOnce()
    legacySpy.mockRestore()
    destroyDragProxy(proxy)
  })

  it('free landing：接受没有 DOM 目标的纯矩形', async () => {
    const { source, proxy } = landingFixture()
    const adapter = new DefaultVisualAdapter()

    const result = await adapter.land({ element: proxy }, {
      left: 420, top: 260, width: 60, height: 40,
    }, {
      objectId: 'o', sessionId: 's', mode: 'detach', landingMode: 'free',
      targetRect: { left: 420, top: 260, width: 60, height: 40 },
    } as never)

    expect(result.completed).toBe(true)
    expect(source.isConnected).toBe(true)
    destroyDragProxy(proxy)
  })

  it('free landing：屏幕外落点不被 viewport clamp 到浏览器边缘', async () => {
    const { proxy } = landingFixture()
    const adapter = new DefaultVisualAdapter()
    const motionSpy = vi.spyOn(VisualModule, 'landDragProxyWithMotion').mockReturnValue({
      finished: Promise.resolve(),
      retarget: () => undefined,
    })

    await adapter.land({ element: proxy }, {
      left: -420,
      top: 760,
      width: 60,
      height: 40,
    }, {
      objectId: 'o', sessionId: 's', mode: 'detach', landingMode: 'free',
      landingBounds: () => rect(0, 0, 800, 600),
      targetRect: { left: -420, top: 760, width: 60, height: 40 },
    } as never)

    expect(motionSpy).toHaveBeenCalledWith(
      proxy,
      expect.objectContaining({ left: -420, top: 760, width: 60, height: 40 }),
      expect.anything(),
    )
    motionSpy.mockRestore()
    destroyDragProxy(proxy)
  })

  it('default landing：画布无效回位仍传递当前 contentScale', async () => {
    const { proxy, target } = landingFixture()
    const adapter = new DefaultVisualAdapter()
    const motionSpy = vi.spyOn(VisualModule, 'landDragProxyWithMotion').mockReturnValue({
      finished: Promise.resolve(),
      retarget: () => undefined,
    })

    await adapter.land({ element: proxy }, target, {
      objectId: 'o', sessionId: 's', mode: 'detach', landingMode: 'default',
      contentScale: 1.5,
      targetRect: { left: 200, top: 200, width: 60, height: 40 },
    } as never)

    expect(motionSpy).toHaveBeenCalledWith(
      proxy,
      expect.anything(),
      expect.objectContaining({ contentScale: 1.5 }),
    )
    motionSpy.mockRestore()
    destroyDragProxy(proxy)
  })

  it('文件拖入文件夹：代理保留文件内容并执行 target 缩小淡出，不复制文件夹结构', async () => {
    const { target, proxy } = landingFixture()
    const adapter = new DefaultVisualAdapter()
    const motionSpy = vi.spyOn(VisualModule, 'landDragProxyWithMotion').mockReturnValue({
      finished: Promise.resolve(),
      retarget: () => undefined,
    })

    await adapter.land({ element: proxy }, target, {
      objectId: 'file:1', sessionId: 's', mode: 'detach', landingMode: 'target',
      disableTargetVisualMorph: true,
      targetRect: { left: 200, top: 200, width: 60, height: 40 },
      motion: {
        target: {
          dismiss: { duration: 300, easing: 'ease-out', scale: 0.72 },
        },
      },
    } as never)

    expect(motionSpy).toHaveBeenCalledWith(
      proxy,
      expect.objectContaining({ left: 200, top: 200, width: 60, height: 40 }),
      expect.objectContaining({
        landingMode: 'target',
        targetContent: undefined,
        dismiss: { duration: 300, easing: 'ease-out', scale: 0.72 },
      }),
    )
    motionSpy.mockRestore()
    destroyDragProxy(proxy)
  })

  it('跨 Surface 落入抽屉：保留画布项目代理内容，不执行目标卡结构 morph', async () => {
    const { target, proxy } = landingFixture()
    const adapter = new DefaultVisualAdapter()
    const motionSpy = vi.spyOn(VisualModule, 'landDragProxyWithMotion').mockReturnValue({
      finished: Promise.resolve(),
      retarget: () => undefined,
    })

    await adapter.land({ element: proxy }, target, {
      objectId: 'mind:109', sessionId: 's', mode: 'detach', landingMode: 'default',
      sourceSurfaceId: 'mind:canvas', destinationSurfaceId: 'mind:drawer',
      disableTargetVisualMorph: true,
      targetRect: { left: 200, top: 200, width: 240, height: 96 },
      targetSnapshot: {
        rect: rect(200, 200, 240, 96),
        borderRadius: '16px', boxShadow: 'rgba(0,0,0,.12) 0 8px 20px',
        border: '1px solid white', backdropFilter: 'blur(12px)',
        background: 'rgba(255,255,255,.8)', opacity: '1', transform: 'none',
      },
    } as never)

    expect(motionSpy).toHaveBeenCalledWith(
      proxy,
      expect.objectContaining({ left: 200, top: 200, width: 240, height: 96 }),
      expect.objectContaining({
        landingMode: 'default',
        targetContent: undefined,
        targetShadow: 'rgba(0,0,0,.12) 0 8px 20px',
        targetRadius: undefined,
        targetBorder: undefined,
        targetBackdropFilter: undefined,
        targetBackground: undefined,
        targetOpacity: undefined,
      }),
    )
    motionSpy.mockRestore()
    destroyDragProxy(proxy)
  })

  it('项目卡跨 Surface landing 允许目标卡交叉淡化', async () => {
    const { target, proxy } = landingFixture()
    const adapter = new DefaultVisualAdapter()
    const motionSpy = vi.spyOn(VisualModule, 'landDragProxyWithMotion').mockReturnValue({
      finished: Promise.resolve(),
      retarget: () => undefined,
    })

    await adapter.land({ element: proxy }, target, {
      objectId: 'project:cross', sessionId: 's', mode: 'detach', landingMode: 'default',
      sourceSurfaceId: 'column:todo', destinationSurfaceId: 'column:done',
      targetRect: { left: 200, top: 200, width: 240, height: 96 },
      targetSnapshot: {
        rect: rect(200, 200, 240, 96),
        borderRadius: '16px', boxShadow: 'rgba(0,0,0,.12) 0 8px 20px',
        border: '1px solid white', backdropFilter: 'blur(12px)',
        background: 'rgba(255,255,255,.8)', opacity: '1', transform: 'none',
      },
    } as never)

    expect(motionSpy).toHaveBeenCalledWith(
      proxy,
      expect.anything(),
      expect.objectContaining({
        targetContent: target,
        targetRadius: '16px',
        targetBackground: 'rgba(255,255,255,.8)',
      }),
    )
    motionSpy.mockRestore()
    destroyDragProxy(proxy)
  })

  it('landing 不继承 perspective 前后倾，但保留平面旋转姿态', async () => {
    const { target, proxy } = landingFixture()
    const adapter = new DefaultVisualAdapter()
    const motionSpy = vi.spyOn(VisualModule, 'landDragProxyWithMotion').mockReturnValue({
      finished: Promise.resolve(),
      retarget: () => undefined,
    })

    await adapter.land({ element: proxy }, target, {
      objectId: 'mind:cross-surface', sessionId: 's', mode: 'detach', landingMode: 'default',
      sourceSurfaceId: 'mind:project-drawer', destinationSurfaceId: 'mind:canvas',
      motionState: {
        x: 100, y: 100, vx: 0, vy: 0, scaleX: 1, scaleY: 1,
        rotateX: 5, rotateZ: -3,
      },
      targetRect: { left: 200, top: 200, width: 60, height: 40 },
    } as never)

    expect(motionSpy).toHaveBeenCalledWith(
      proxy,
      expect.anything(),
      expect.objectContaining({
        motionState: expect.objectContaining({ rotateX: 0, rotateZ: -3 }),
      }),
    )
    motionSpy.mockRestore()
    destroyDragProxy(proxy)
  })

  it('同 Surface landing 也不继承抓取时的 perspective 前后倾', async () => {
    const { target, proxy } = landingFixture()
    const adapter = new DefaultVisualAdapter()
    const motionSpy = vi.spyOn(VisualModule, 'landDragProxyWithMotion').mockReturnValue({
      finished: Promise.resolve(),
      retarget: () => undefined,
    })

    await adapter.land({ element: proxy }, target, {
      objectId: 'mind:same-surface', sessionId: 's', mode: 'detach', landingMode: 'default',
      sourceSurfaceId: 'mind:canvas', destinationSurfaceId: 'mind:canvas',
      motionState: {
        x: 100, y: 100, vx: 240, vy: 40, scaleX: 1, scaleY: 1,
        rotateX: 5, rotateZ: 2,
      },
      targetRect: { left: 200, top: 200, width: 60, height: 40 },
    } as never)

    expect(motionSpy).toHaveBeenCalledWith(
      proxy,
      expect.anything(),
      expect.objectContaining({
        motionState: expect.objectContaining({ rotateX: 0, rotateZ: 2, vx: 240, vy: 40 }),
      }),
    )
    motionSpy.mockRestore()
    destroyDragProxy(proxy)
  })
})

describe('Runtime.getObjectMotionEnabled', () => {
  it('未注册/未配置 motion 时默认视为启用', () => {
    const runtime = new Runtime()
    const element = document.createElement('div')
    runtime.registerObjectType('plain', { defaultVisualMode: 'detach' })
    runtime.objects.register({ id: 'x', type: 'plain', surfaceId: 's', element, abilities: ['move'] })
    expect(runtime.getObjectMotionEnabled('x')).toBe(true)
    expect(runtime.getObjectMotionEnabled('missing-object')).toBe(true)
  })

  it('motion.enabled 显式为 false 时返回 false，为 true 或省略时返回 true', () => {
    const runtime = new Runtime()
    const element = document.createElement('div')
    runtime.registerObjectType('off', { defaultVisualMode: 'detach', motion: { enabled: false } })
    runtime.registerObjectType('on', { defaultVisualMode: 'detach', motion: { enabled: true } })
    runtime.objects.register({ id: 'a', type: 'off', surfaceId: 's', element, abilities: ['move'] })
    runtime.objects.register({ id: 'b', type: 'on', surfaceId: 's', element, abilities: ['move'] })
    expect(runtime.getObjectMotionEnabled('a')).toBe(false)
    expect(runtime.getObjectMotionEnabled('b')).toBe(true)
  })
})
