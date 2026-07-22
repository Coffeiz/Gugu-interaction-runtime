import { DEFAULT_MOTION_PROFILE } from '../dom/MotionProfile'
import { runtime } from '../Runtime'
import {
  concealElement,
  createDragProxy,
  destroyDragProxy,
  landDragProxy,
  revealElement,
} from '../dom/Visual'
import { preserveProxyVisualContext } from '../dom/ProxyVisualContext'
import type { VisualAdapter, VisualLifecycleContext, VisualProxy } from '../dom/VisualAdapter'

interface DetachProxyState {
  target: HTMLElement | null
  stopTracking: () => void
  disposed: boolean
}

/**
 * detach 的 VisualAdapter 实现。它复用现有 Visual.ts 的运动数学，只把代理的
 * 创建、落地、揭示和销毁拆成 Runtime 可调用的四个阶段。
 */
export function createDetachVisualAdapter(): VisualAdapter {
  const states = new WeakMap<HTMLElement, DetachProxyState>()
  return {
    createProxy: (context: VisualLifecycleContext): VisualProxy => {
      if (!context.sourceElement || !context.sourceRect || !context.beforeContent) {
        throw new Error('detach visual proxy requires source snapshot')
      }
      const proxy = createDragProxy(context.beforeContent, context.sourceRect)
      preserveProxyVisualContext(context.sourceElement, proxy)
      const snapshot = context.visualSnapshot
      if (snapshot) {
        proxy.style.boxShadow = snapshot.boxShadow
        proxy.style.borderRadius = snapshot.borderRadius
        proxy.style.backgroundColor = snapshot.background
        proxy.style.opacity = snapshot.opacity
        proxy.style.transform = snapshot.transform || 'scale(1.03)'
      }
      states.set(proxy, { target: null, stopTracking: () => undefined, disposed: false })
      return { element: proxy }
    },
    land: (visualProxy, target, context) => {
      const proxy = visualProxy.element
      const state = states.get(proxy)
      if (!state || state.disposed) return Promise.resolve({ completed: false, reason: 'visual-proxy-disposed' })
      const targetRect = target.getBoundingClientRect()
      state.target = target
      concealElement(target, context.sessionId)
      proxy.style.transition = 'none'
      proxy.style.width = `${targetRect.width}px`
      proxy.style.height = `${targetRect.height}px`
      const { finished, retarget } = landDragProxy(proxy, targetRect, {
        duration: context.motion?.landing?.duration ?? DEFAULT_MOTION_PROFILE.landing.duration,
        targetShadow: context.targetSnapshot?.boxShadow,
        targetRadius: context.targetSnapshot?.borderRadius,
        targetBackground: context.targetSnapshot?.background,
        targetOpacity: context.targetSnapshot?.opacity,
        targetContent: target,
      })
      state.stopTracking = runtime.trackLandingTarget(context.sessionId, target, retarget)
      return finished.then(() => ({ completed: true }))
    },
    reveal: (_visualProxy, target, context) => {
      revealElement(target, context.sessionId)
    },
    dispose: (visualProxy, context) => {
      const proxy = visualProxy.element
      const state = states.get(proxy)
      if (!state || state.disposed) return
      state.disposed = true
      state.stopTracking()
      if (state.target) revealElement(state.target, context.sessionId)
      destroyDragProxy(proxy)
      states.delete(proxy)
    },
  }
}
