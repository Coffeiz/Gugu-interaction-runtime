import { DefaultVisualAdapter, type VisualAdapter, type VisualLifecycleContext, type VisualProxy } from './VisualAdapter'
import { getProxyContent } from './Visual'
import { resolveGroupDragConfig } from './GroupDragProfile'
import type { Runtime } from '../Runtime'
import type { DragProxyLayoutConfig } from './Visual'

/** 将主代理的 compact 布局契约复用到多选 modifier。 */
export function applyGroupModifierLayout(
  element: HTMLElement,
  compact: DragProxyLayoutConfig['compact'] | undefined,
): void {
  if (!compact) return
  element.dataset.runtimeProxyContent = 'true'
  element.dataset.runtimeCompact = 'true'
  element.style.boxSizing = 'border-box'
  element.style.left = compact.left ?? '50%'
  element.style.width = compact.width
  if (compact.gridTemplateColumns) element.style.gridTemplateColumns = compact.gridTemplateColumns
}

/**
 * Runtime 默认的多对象叠卡视觉。
 *
 * 这层只处理 DOM 代理、修饰卡和源节点的视觉交接，不读取业务字段，
 * 因此可以被文件、看板或其他对象类型复用。业务若需要特殊卡片内容，
 * 可以传入自己的 GroupVisualAdapter 替换默认实现。
 */
export function createGroupVisualAdapter(
  runtime: Runtime,
  base: VisualAdapter = new DefaultVisualAdapter(runtime),
): VisualAdapter {
  const states = new WeakMap<HTMLElement, {
    modifiers: HTMLElement[]
    dismissModifiers: () => void
    restoreGhosts: (duration: number) => void
    cleanup: () => void
  }>()

  function decorateProxy(proxy: VisualProxy, context: VisualLifecycleContext): void {
    const group = context.group
    if (!group || group.primaryObjectId !== context.objectId || states.has(proxy.element)) return

    const content = getProxyContent(proxy.element)
    const shell = proxy.element.querySelector<HTMLElement>('[data-runtime-proxy-scale-shell="true"]')
      ?? proxy.element
    shell.style.overflow = 'visible'
    content.style.zIndex = '2'
    const primaryRect = context.sourceRect ?? context.sourceElement?.getBoundingClientRect()
    if (!primaryRect) return
    const groupDrag = resolveGroupDragConfig(context.groupDrag)
    const compactLayout = context.proxyLayout?.compact

    const sources: Array<{
      element: HTMLElement
      cssText: string
      marker: string | undefined
      opacity: string
    }> = []
    const stackAnimations: Array<{
      element: HTMLElement
      spread: typeof groupDrag.spread[number]
      tight: typeof groupDrag.tight[number]
    }> = []
    const modifiers: HTMLElement[] = []
    const ghostSources = group.objectIds
      .map(objectId => runtime.objects.get(objectId)?.element)
      .filter((element): element is HTMLElement => Boolean(element?.isConnected))

    for (const source of ghostSources) {
      sources.push({
        element: source,
        cssText: source.style.cssText,
        marker: source.dataset.runtimeGroupGhost,
        opacity: getComputedStyle(source).opacity,
      })
      source.dataset.runtimeGroupGhost = 'true'
      source.style.visibility = 'visible'
      source.style.opacity = '0.35'
      source.style.pointerEvents = 'none'
      source.style.transition = 'none'
    }

    const stackConfigs = groupDrag.spread.map((spread, index) => ({ spread, tight: groupDrag.tight[index] }))
      .filter((config): config is typeof config & { tight: NonNullable<typeof config.tight> } => Boolean(config.tight))
    const extraIds = group.objectIds
      .filter(objectId => objectId !== group.primaryObjectId)
      .slice(0, Math.min(groupDrag.maxModifiers, stackConfigs.length))
    for (const [index, objectId] of extraIds.entries()) {
      const source = runtime.objects.get(objectId)?.element
      if (!source || !source.isConnected) continue
      const rect = source.getBoundingClientRect()
      const config = stackConfigs[index]
      if (!config) continue
      const extra = source.cloneNode(true) as HTMLElement
      Object.assign(extra.style, {
        position: 'absolute',
        left: '0px',
        top: '0px',
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        margin: '0',
        boxSizing: 'border-box',
        pointerEvents: 'none',
        zIndex: String(1 - index),
        opacity: '1',
        willChange: 'transform, opacity',
        backdropFilter: index === 0 ? 'blur(6px) saturate(1.15)' : 'none',
        WebkitBackdropFilter: index === 0 ? 'blur(6px) saturate(1.15)' : 'none',
        transform: `${compactLayout?.transform ?? (compactLayout ? 'translateX(-50%)' : '')}${compactLayout ? ' ' : ''}translate3d(${config.spread.x}px, ${config.spread.y}px, 0) rotateZ(${config.spread.rotate}deg) scale(${config.spread.scale})`,
        transformOrigin: 'center center',
      })
      // modifier 与主代理必须共享同一份紧凑布局。主代理通过 createDragProxy
      // 应用了 proxyLayout，但 modifier 是从源卡直接 clone 出来的；如果这里不
      // 复制 compact 标记/列定义，列表视图的装饰卡会恢复成完整表格行宽度。
      applyGroupModifierLayout(extra, compactLayout)
      extra.dataset.runtimeGroupModifier = 'true'
      delete extra.dataset.runtimeGroupGhost
      shell.insertBefore(extra, content)
      modifiers.push(extra)
      stackAnimations.push({ element: extra, spread: config.spread, tight: config.tight })
    }

    let stackRaf: number | null = null
    const stackStart = performance.now()
    const animateStack = (now: number) => {
      const progress = Math.min(1, (now - stackStart) / groupDrag.foldDuration)
      const eased = 1 - Math.pow(1 - progress, 2)
      for (const animation of stackAnimations) {
        const x = animation.spread.x + (animation.tight.x - animation.spread.x) * eased
        const y = animation.spread.y + (animation.tight.y - animation.spread.y) * eased
        const rotate = animation.spread.rotate + (animation.tight.rotate - animation.spread.rotate) * eased
        const scale = animation.spread.scale + (animation.tight.scale - animation.spread.scale) * eased
        const compactTransform = compactLayout
          ? compactLayout.transform ?? 'translateX(-50%)'
          : ''
        animation.element.style.transform = `${compactTransform} translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotateZ(${rotate.toFixed(2)}deg) scale(${scale.toFixed(4)})`
      }
      if (progress < 1) stackRaf = requestAnimationFrame(animateStack)
      else stackRaf = null
    }
    if (stackAnimations.length) stackRaf = requestAnimationFrame(animateStack)

    let modifiersDismissed = false
    let modifierTimer: number | null = null
    const dismissModifiers = () => {
      if (modifiersDismissed) return
      modifiersDismissed = true
      if (stackRaf !== null) {
        cancelAnimationFrame(stackRaf)
        stackRaf = null
      }
      for (const modifier of modifiers) {
        modifier.style.transition = `opacity ${groupDrag.modifierFadeDuration}ms ease`
        modifier.style.opacity = '0'
      }
      modifierTimer = window.setTimeout(() => {
        for (const modifier of modifiers) modifier.remove()
        modifierTimer = null
      }, groupDrag.modifierFadeDuration + 20)
    }

    const restoreGhosts = (duration: number) => {
      for (const source of sources) {
        if (!source.element.isConnected) continue
        source.element.style.transition = `opacity ${duration}ms cubic-bezier(.22,1,.36,1)`
        source.element.style.opacity = source.opacity
      }
    }

    const cleanup = () => {
      if (stackRaf !== null) cancelAnimationFrame(stackRaf)
      if (modifierTimer !== null) window.clearTimeout(modifierTimer)
      for (const modifier of modifiers) modifier.remove()
      for (const source of sources) {
        if (!source.element.isConnected) continue
        source.element.style.cssText = source.cssText
        if (source.marker === undefined) delete source.element.dataset.runtimeGroupGhost
        else source.element.dataset.runtimeGroupGhost = source.marker
      }
    }
    states.set(proxy.element, { modifiers, dismissModifiers, restoreGhosts, cleanup })
  }

  return {
    resolveSource: base.resolveSource?.bind(base),
    resolveTarget: base.resolveTarget?.bind(base),
    captureVisualState: base.captureVisualState?.bind(base),
    applyState: base.applyState?.bind(base),
    createProxy(context): VisualProxy {
      const proxy = base.createProxy?.(context)
      if (!proxy) throw new Error('group visual requires a base proxy')
      decorateProxy(proxy, context)
      return proxy
    },
    updateProxy(proxy, context) {
      base.updateProxy?.(proxy, context)
      decorateProxy(proxy, context)
    },
    land: (proxy, target, context) => {
      const state = states.get(proxy.element)
      if (!context.group || !state) return base.land?.(proxy, target, context)
      state.dismissModifiers()
      if (context.landingMode !== 'target') {
        const duration = context.motion?.landing?.duration ?? 420
        state.restoreGhosts(duration)
        // 多卡回位时主代理负责展开和淡出，源卡幽灵同步恢复；两者交叉过渡，
        // 避免落地瞬间同时出现两张完整卡片。
        // 同一 Surface 内多卡回位时，主代理负责淡出并交接给本体；
        // 跨 Surface 时目标卡本来就是另一张已挂载的本体，必须保留它的
        // 可见样式，否则代理会沿着 opacity:0 淡出，最后只剩目标本体瞬切。
        const isCrossSurfaceLanding = Boolean(
          context.sourceSurfaceId
          && context.destinationSurfaceId
          && context.sourceSurfaceId !== context.destinationSurfaceId,
        )
        const targetSnapshot = context.targetSnapshot
          ? isCrossSurfaceLanding
            ? context.targetSnapshot
            : { ...context.targetSnapshot, opacity: '0' }
          : undefined
        return base.land?.(proxy, target, { ...context, targetSnapshot })
      }
      return base.land?.(proxy, target, context)
    },
    reveal: (proxy, target, context) => base.reveal?.(proxy, target, context),
    dispose: (proxy, context) => {
      states.get(proxy.element)?.cleanup()
      states.delete(proxy.element)
      base.dispose?.(proxy, context)
    },
  }
}
