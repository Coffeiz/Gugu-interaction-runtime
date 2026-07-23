import { executeDetachDrag } from '../runtime/DetachMoveDriver'
import { createDetachMoveFromAdapter } from '../runtime/detach/DetachAdapter'
import { type ObjectVisualAdapter } from '../Runtime'
import { DefaultVisualAdapter } from '../dom/VisualAdapter'
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

function createDetachVisualAdapter(): VisualAdapter {
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
      const rawTargetRect = context.targetSnapshot?.rect ?? target.getBoundingClientRect()
      const targetRect = {
        left: rawTargetRect.left ?? rawTargetRect.x,
        top: rawTargetRect.top ?? rawTargetRect.y,
        width: rawTargetRect.width,
        height: rawTargetRect.height,
      }
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
      state.stopTracking = runtime.trackLandingTarget(context.sessionId, target, () => {
        if (context.targetSnapshot?.rect && !target.closest('[data-layout-surface]')) {
          retarget({
            left: context.targetSnapshot.rect.x,
            top: context.targetSnapshot.rect.y,
            width: context.targetSnapshot.rect.width,
            height: context.targetSnapshot.rect.height,
          })
        } else {
          retarget(target.getBoundingClientRect())
        }
      })
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

export function createKanbanVisualAdapter(context: {
  surfaceIds: string[]
  findColumnIdOf: (objectId: string) => string | undefined
}): ObjectVisualAdapter {
  const defaults = new DefaultVisualAdapter()
  const detach = createDetachVisualAdapter()
  return {
    resolveSource: objectId => defaults.resolveSource(objectId),
    resolveTarget: objectId => defaults.resolveTarget(objectId),
    captureVisualState: element => defaults.captureVisualState(element),
    applyState: (element, state) => defaults.applyState(element, state),
    createProxy: detach.createProxy,
    updateProxy: detach.updateProxy,
    land: detach.land,
    reveal: detach.reveal,
    dispose: detach.dispose,
    createMove: ({ objectId, element, event }) => {
      if (!runtime.objects.hasAbility(objectId, 'move')) return {}
      event.preventDefault()
      return createDetachMoveFromAdapter({
        runtime,
        objectId,
        element,
        event,
        surfaceIds: context.surfaceIds,
        findColumnIdOf: context.findColumnIdOf,
      })
    },
    legacyStart: ({ objectId, element, event }) => {
      executeDetachDrag({
        runtime,
        objectId,
        element,
        event,
        surfaceIds: context.surfaceIds,
        findColumnIdOf: context.findColumnIdOf,
      })
    },
  }
}
