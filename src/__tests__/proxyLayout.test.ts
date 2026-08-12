import { describe, expect, it, vi } from 'vitest'
import {
  createDragProxy,
  destroyDragProxy,
  applyFloatingStyle,
  clearFloatingStyle,
  landDragProxyWithMotion,
  getFloatingProxy,
  getProxyContent,
  updateDragProxyContentScale,
  updateDragProxyScaleShell,
} from '../dom/Visual'

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
  it('抓取代理继承字体渲染上下文但不覆盖卡片内容布局', () => {
    const source = document.createElement('article')
    source.style.fontFamily = 'system-ui, sans-serif'
    source.style.fontSize = '13px'
    source.style.lineHeight = '16px'
    const badge = document.createElement('span')
    badge.style.fontSize = '10px'
    badge.style.lineHeight = '12px'
    source.append(badge)
    document.body.append(source)

    applyFloatingStyle(source, rect(180, 40))
    const proxy = getFloatingProxy(source)
    expect(proxy).toBeDefined()
    const content = getProxyContent(proxy!)
    const proxyBadge = content.querySelector('span')!

    expect(content.style.fontFamily).toBe('system-ui, sans-serif')
    expect(proxyBadge.style.fontSize).toBe('10px')
    expect(proxyBadge.style.lineHeight).toBe('12px')

    clearFloatingStyle(source)
    source.remove()
  })

  it('抓取代理的阴影从零开始，由下一帧进入浮起阴影', () => {
    const source = document.createElement('article')
    source.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.2)'
    document.body.append(source)

    applyFloatingStyle(source, rect(180, 40))
    const proxy = getFloatingProxy(source)!
    const content = getProxyContent(proxy)

    expect(content.style.boxShadow).toBe('none')
    expect(content.style.getPropertyPriority('box-shadow')).toBe('important')

    clearFloatingStyle(source)
    source.remove()
  })

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

  it('普通代理创建时保持本体尺寸，由抓取启动阶段负责浮起缩放', () => {
    const source = document.createElement('article')
    document.body.append(source)

    const proxy = createDragProxy(source, rect())

    expect(proxy.style.transform).toContain('scale(1)')

    destroyDragProxy(proxy)
    source.remove()
  })

  it('相机缩放只更新内容缩放，不改写代理的定位壳尺寸', () => {
    const source = document.createElement('article')
    document.body.append(source)

    const proxy = createDragProxy(source, rect(200, 100), { contentScale: 0.5 })
    const shell = proxy.querySelector<HTMLElement>('[data-runtime-proxy-scale-shell]')!

    expect(proxy.style.width).toBe('200px')
    expect(proxy.style.height).toBe('100px')
    expect(shell.style.transform).toBe('scale(0.5)')

    updateDragProxyContentScale(proxy, 0.75)

    // 相机变化不能让 MotionController 的屏幕坐标基准重新贴回鼠标。
    expect(proxy.style.width).toBe('200px')
    expect(proxy.style.height).toBe('100px')
    expect(shell.style.transform).toBe('scale(0.75)')
    expect(shell.style.left).toBe('-50px')
    expect(shell.style.top).toBe('-25px')

    destroyDragProxy(proxy)
    source.remove()
  })

  it('landing 缩放壳会清除 grabbing 阶段的居中偏移', () => {
    const source = document.createElement('article')
    document.body.append(source)

    const proxy = createDragProxy(source, rect(200, 100), { contentScale: 0.5 })
    const shell = proxy.querySelector<HTMLElement>('[data-runtime-proxy-scale-shell]')!
    expect(shell.style.left).toBe('0px')
    expect(shell.style.top).toBe('0px')

    proxy.style.width = '120px'
    proxy.style.height = '60px'
    updateDragProxyScaleShell(proxy, 0.5)

    expect(shell.style.left).toBe('0px')
    expect(shell.style.top).toBe('0px')
    expect(shell.style.width).toBe('240px')
    expect(shell.style.height).toBe('120px')
    expect(shell.style.transform).toBe('scale(0.5)')

    destroyDragProxy(proxy)
    source.remove()
  })

  it('相机缩放后没有新的 pointermove，landing 沿用 motionState 起点', async () => {
    const source = document.createElement('article')
    document.body.append(source)

    const proxy = createDragProxy(source, rect(200, 100), { contentScale: 0.5 })
    proxy.getBoundingClientRect = () => {
      const left = parseFloat(proxy.style.left) || 0
      const top = parseFloat(proxy.style.top) || 0
      const width = parseFloat(proxy.style.width) || 0
      const height = parseFloat(proxy.style.height) || 0
      return new DOMRect(left, top, width, height)
    }
    vi.useFakeTimers()
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      return window.setTimeout(() => callback(performance.now()), 16)
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)

    const landing = landDragProxyWithMotion(proxy, {
      left: 500,
      top: 300,
      width: 200,
      height: 100,
    }, {
      motionState: {
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        scaleX: 1.03,
        scaleY: 1.03,
        rotateX: 5,
        rotateZ: 0,
      },
      contentScale: 0.5,
    })

    // landing 不在启动前重写代理几何，起点继续由 motionState 提供。
    expect(proxy.style.left).toBe('0px')
    expect(proxy.style.top).toBe('0px')

    // 清理 MotionController 的超时和测试替身，避免未完成的 landing 泄漏到其他用例。
    vi.advanceTimersByTime(6000)
    await landing.finished
    vi.useRealTimers()
    vi.restoreAllMocks()
    destroyDragProxy(proxy)
    source.remove()
  })

  it('相机缩放后 landing 从松手时的视觉尺寸开始且不从侧面飞入', async () => {
    const source = document.createElement('article')
    document.body.append(source)

    const proxy = createDragProxy(source, rect(200, 100), { contentScale: 1 })
    updateDragProxyContentScale(proxy, 1.5)

    vi.useFakeTimers()
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      return window.setTimeout(() => callback(performance.now()), 16)
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)

    const landing = landDragProxyWithMotion(proxy, {
      left: 300,
      top: 200,
      width: 300,
      height: 150,
    }, {
      landingMode: 'free',
      contentScale: 1.5,
      motionState: {
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        scaleX: 1.03,
        scaleY: 1.03,
        rotateX: 5,
        rotateZ: 0,
      },
    })

    const shell = proxy.querySelector<HTMLElement>('[data-runtime-proxy-scale-shell]')!
    // 世界尺寸仍为 200x100，当前相机把它显示为 300x150；抓取态的 1.03
    // 只负责浮起，不应再叠加一段从 200x100 到 300x150 的首帧放大。
    expect(shell.style.width).toBe('200px')
    expect(shell.style.height).toBe('100px')
    // scaleShell 必须围绕 holder 中心承载当前 150% 的视觉尺寸，不能回到左上角，
    // 否则 landing 会表现为从右下/左上方向飞入。
    expect(parseFloat(shell.style.left)).toBeCloseTo(-54.5, 1)
    expect(parseFloat(shell.style.top)).toBeCloseTo(-27.25, 1)
    expect(shell.style.transform).toBe('scale(1.545)')

    vi.advanceTimersByTime(6000)
    await landing.finished
    vi.useRealTimers()
    vi.restoreAllMocks()
    destroyDragProxy(proxy)
    source.remove()
  })

  it('landing 尺寸起点不使用带旋转的外接矩形', async () => {
    const source = document.createElement('article')
    document.body.append(source)
    const proxy = createDragProxy(source, rect(200, 100))
    proxy.getBoundingClientRect = () => {
      const left = parseFloat(proxy.style.left) || 0
      const top = parseFloat(proxy.style.top) || 0
      const width = (parseFloat(proxy.style.width) || 0) * 1.2
      const height = (parseFloat(proxy.style.height) || 0) * 1.2
      return new DOMRect(left, top, width, height)
    }

    vi.useFakeTimers()
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      return window.setTimeout(() => callback(performance.now()), 16)
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)

    const landing = landDragProxyWithMotion(proxy, {
      left: 300,
      top: 200,
      width: 200,
      height: 100,
    }, {
      motionState: {
        x: 0, y: 0, vx: 0, vy: 0,
        scaleX: 1, scaleY: 1, rotateX: 5, rotateZ: 3,
      },
    })

    // mock 的外接矩形比布局盒大 20%，首帧仍应从布局盒 200x100 起算。
    expect(parseFloat(proxy.style.width)).toBeCloseTo(200, 0)
    expect(parseFloat(proxy.style.height)).toBeCloseTo(100, 0)

    vi.advanceTimersByTime(6000)
    await landing.finished
    vi.useRealTimers()
    vi.restoreAllMocks()
    destroyDragProxy(proxy)
    source.remove()
  })

  it('landing 中相机变化由 camGlue 更新，不重复写入代理自身 scale', async () => {
    const source = document.createElement('article')
    document.body.append(source)

    const proxy = createDragProxy(source, rect(200, 100), { contentScale: 1 })
    proxy.getBoundingClientRect = () => {
      const left = parseFloat(proxy.style.left) || 0
      const top = parseFloat(proxy.style.top) || 0
      const width = parseFloat(proxy.style.width) || 0
      const height = parseFloat(proxy.style.height) || 0
      return new DOMRect(left, top, width, height)
    }
    let cameraScale = 1

    vi.useFakeTimers()
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      return window.setTimeout(() => callback(performance.now()), 16)
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)

    const landing = landDragProxyWithMotion(proxy, {
      left: 300,
      top: 200,
      width: 200,
      height: 100,
    }, {
      landingMode: 'free',
      cameraOrigin: () => ({ left: 0, top: 0 }),
      contentScale: () => cameraScale,
      motionState: {
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        scaleX: 1,
        scaleY: 1,
        rotateX: 0,
        rotateZ: 0,
      },
    })

    cameraScale = 2
    vi.advanceTimersByTime(16)

    // camera 放大一倍后，代理布局尺寸和自身 landing scale 保持稳定，视觉比例由
    // 独立的 camGlue 外壳承担，避免和 landing transform 叠加。
    expect(parseFloat(proxy.style.width)).toBeCloseTo(200, 0)
    const scaleShell = proxy.querySelector<HTMLElement>('[data-runtime-proxy-scale-shell]')
    expect(scaleShell?.style.transform).toBe('scale(1)')
    const camGlue = proxy.parentElement
    expect(camGlue?.dataset.runtimeCameraGlue).toBe('true')
    expect(camGlue?.style.transform).toContain('scale(2.0000)')

    vi.advanceTimersByTime(6000)
    await landing.finished
    vi.useRealTimers()
    vi.restoreAllMocks()
    destroyDragProxy(proxy)
    source.remove()
  })

  it('free landing retarget 按抓取后的视觉尺寸计算，不重复叠加相机倍率', async () => {
    const source = document.createElement('article')
    document.body.append(source)

    const proxy = createDragProxy(source, rect(200, 100), { contentScale: 0.5 })
    proxy.getBoundingClientRect = () => {
      const left = parseFloat(proxy.style.left) || 0
      const top = parseFloat(proxy.style.top) || 0
      const width = parseFloat(proxy.style.width) || 0
      const height = parseFloat(proxy.style.height) || 0
      return new DOMRect(left, top, width, height)
    }

    vi.useFakeTimers()
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      return window.setTimeout(() => callback(performance.now()), 16)
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)

    const landing = landDragProxyWithMotion(proxy, {
      left: 300,
      top: 200,
      width: 200,
      height: 100,
    }, {
      landingMode: 'free',
      contentScale: 0.5,
      motionState: {
        x: 0, y: 0, vx: 0, vy: 0,
        scaleX: 1, scaleY: 1, rotateX: 0, rotateZ: 0,
      },
    })

    // 目标重算时，100px 是 200px 世界尺寸在 50% 相机下的完整视觉宽度，
    // 应保持 landing motion scale 为 1；旧逻辑会错误算成 0.5。
    landing.retarget({ left: 300, top: 200, width: 200, height: 100 })
    vi.advanceTimersByTime(1200)

    const shell = proxy.querySelector<HTMLElement>('[data-runtime-proxy-scale-shell]')!
    // scaleShell 仍由相机倍率 0.5 承担；motion 自身目标倍率应为 1，
    // 旧逻辑会把两者相乘成 0.25。
    expect(parseFloat(shell.style.transform.match(/scale\(([^)]+)/)?.[1] ?? '0')).toBeCloseTo(0.5, 2)

    vi.advanceTimersByTime(6000)
    await landing.finished
    vi.useRealTimers()
    vi.restoreAllMocks()
    destroyDragProxy(proxy)
    source.remove()
  })

  it('普通 grid landing 回抽屉时内容倍率平滑回到目标尺寸', async () => {
    const source = document.createElement('article')
    document.body.append(source)

    // 代理创建时仍是抽屉的 1x 尺寸；抓取后相机把内容缩到 50%。
    const proxy = createDragProxy(source, rect(200, 100), { contentScale: 1 })
    proxy.getBoundingClientRect = () => {
      const left = parseFloat(proxy.style.left) || 0
      const top = parseFloat(proxy.style.top) || 0
      const width = parseFloat(proxy.style.width) || 0
      const height = parseFloat(proxy.style.height) || 0
      return new DOMRect(left, top, width, height)
    }

    vi.useFakeTimers()
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      return window.setTimeout(() => callback(performance.now()), 16)
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)

    const landing = landDragProxyWithMotion(proxy, {
      left: 300,
      top: 200,
      width: 200,
      height: 100,
    }, {
      landingMode: 'default',
      contentScale: 0.5,
      motionState: {
        x: 0, y: 0, vx: 0, vy: 0,
        scaleX: 1, scaleY: 1, rotateX: 0, rotateZ: 0,
      },
    })

    vi.advanceTimersByTime(1200)
    const shell = proxy.querySelector<HTMLElement>('[data-runtime-proxy-scale-shell]')
    expect(shell?.style.transform).toBe('scale(1)')
    expect(parseFloat(proxy.style.width)).toBeCloseTo(200, 0)

    vi.advanceTimersByTime(6000)
    await landing.finished
    vi.useRealTimers()
    vi.restoreAllMocks()
    destroyDragProxy(proxy)
    source.remove()
  })
})
