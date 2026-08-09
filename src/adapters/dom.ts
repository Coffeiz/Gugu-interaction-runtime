import type { TargetItem } from '../target/Target'
import type { Runtime } from '../Runtime'

export interface RuntimeDomAdapter {
  bindObject(id: string, element: HTMLElement | null): void
  bindSurface(id: string, element: HTMLElement | null): void
  bindTarget(
    key: string,
    target: Omit<TargetItem, 'id' | 'element'> & { id?: string; element?: HTMLElement | null },
    element: HTMLElement | null,
  ): void
  getSurfaceElement(id: string): HTMLElement | null
  runLayoutMutation(options: {
    elements: readonly HTMLElement[]
    root: ParentNode
    mutate: () => void | Promise<void>
    waitForPatch?: () => void | Promise<void>
  }): Promise<void>
  dispose(): void
}

/**
 * 共享 DOM 生命周期实现。Vue/React 适配器只负责暴露各自框架习惯的入口，
 * 不重复实现 Runtime 注册表、拖拽或布局算法。
 */
export function createDomRuntimeAdapter(runtime: Runtime): RuntimeDomAdapter {
  const objectElements = new Map<string, HTMLElement>()
  const surfaceElements = new Map<string, HTMLElement>()
  const targetIds = new Map<string, string>()
  const targetElements = new Map<string, HTMLElement>()

  return {
    bindObject(id, element) {
      const current = runtime.objects.get(id)
      if (!current) return
      if (element === null) {
        const previous = objectElements.get(id)
        if (previous && current.element !== previous) return
        objectElements.delete(id)
      } else {
        objectElements.set(id, element)
      }
      runtime.objects.setElement(id, element)
    },

    bindSurface(id, element) {
      const current = runtime.surfaces.get(id)
      if (!current) return
      if (element === null) {
        const previous = surfaceElements.get(id)
        if (previous && current.element !== previous) return
        surfaceElements.delete(id)
      } else {
        surfaceElements.set(id, element)
      }
      runtime.surfaces.setElement(id, element)
    },

    bindTarget(key, target, element) {
      const targetId = targetIds.get(key) ?? target.id ?? `runtime-target:${key}`
      targetIds.set(key, targetId)
      if (!element) {
        const previous = targetElements.get(key)
        const current = runtime.targets.get(targetId)
        if (previous && current?.element !== previous) return
        targetElements.delete(key)
        runtime.targets.unregister(targetId)
        targetIds.delete(key)
        return
      }
      targetElements.set(key, element)
      runtime.targets.register({ ...target, id: targetId, element })
    },

    getSurfaceElement(id) {
      return runtime.surfaces.get(id)?.element ?? null
    },

    async runLayoutMutation(options) {
      const snapshot = options.elements.length > 0
        ? runtime.captureLayout(options.elements, options.root, true)
        : null
      await options.mutate()
      await options.waitForPatch?.()
      if (snapshot) runtime.scheduleLayout(snapshot)
    },

    dispose() {
      for (const targetId of targetIds.values()) runtime.targets.unregister(targetId)
      objectElements.clear()
      surfaceElements.clear()
      targetIds.clear()
      targetElements.clear()
    },
  }
}
