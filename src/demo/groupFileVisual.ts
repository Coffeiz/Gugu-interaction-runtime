import { DefaultVisualAdapter, type VisualLifecycleContext, type VisualProxy } from '../dom/VisualAdapter'
import { getProxyContent } from '../dom/Visual'
import type { ObjectVisualAdapter, Runtime } from '../Runtime'

/**
 * 文件 Demo 的多选视觉：主卡仍由 Runtime 的单卡 MotionController 驱动，
 * 修饰卡挂在同一个 proxy 内容壳里，跟随同一套 transform / landing 时间线。
 */
export function createGroupFileVisualAdapter(
  runtime: Runtime,
  clearGroup: (objectId: string) => void,
): ObjectVisualAdapter {
  const base = new DefaultVisualAdapter(runtime)

  return {
    createMove: context => base.createMove?.(context),
    createProxy(context): VisualProxy {
      const proxy = base.createProxy?.(context)
      if (!proxy) throw new Error('group file visual requires a base proxy')
      const group = context.group
      if (!group || group.primaryObjectId !== context.objectId) return proxy

      const content = getProxyContent(proxy.element)
      content.style.overflow = 'visible'
      const primaryRect = context.sourceRect ?? context.sourceElement?.getBoundingClientRect()
      if (!primaryRect) return proxy

      const sources: Array<{ element: HTMLElement; visibility: string }> = []
      // 保持和咕咕文件库一致：主卡之外最多叠两张修饰卡，避免选中数量很大时
      // 代理变成一摞不可读的完整列表。
      for (const objectId of group.objectIds.slice(1, 3)) {
        if (objectId === group.primaryObjectId) continue
        const source = runtime.objects.get(objectId)?.element
        if (!source || !source.isConnected) continue
        const offset = group.offsets.get(objectId)
        const rect = source.getBoundingClientRect()
        const extra = source.cloneNode(true) as HTMLElement
        Object.assign(extra.style, {
          position: 'absolute',
          left: `${offset?.x ?? rect.left - primaryRect.left}px`,
          top: `${offset?.y ?? rect.top - primaryRect.top}px`,
          width: `${rect.width}px`,
          height: `${rect.height}px`,
          margin: '0',
          boxSizing: 'border-box',
          pointerEvents: 'none',
          zIndex: '-1',
          opacity: '0.92',
          transform: `translate3d(10px, 10px, 0) scale(0.96)`,
          transformOrigin: 'center center',
        })
        extra.dataset.runtimeGroupModifier = 'true'
        content.appendChild(extra)
        sources.push({ element: source, visibility: source.style.visibility })
        source.style.visibility = 'hidden'
      }

      const restoreSources = () => {
        for (const source of sources) {
          if (source.element.isConnected) source.element.style.visibility = source.visibility
        }
        clearGroup(group.primaryObjectId)
      }

      return {
        element: proxy.element,
        dispose: restoreSources,
      }
    },
    land: (proxy, target, context) => base.land?.(proxy, target, context),
    reveal: (proxy, target, context) => base.reveal?.(proxy, target, context),
    dispose: (proxy, context) => base.dispose?.(proxy, context),
  }
}
