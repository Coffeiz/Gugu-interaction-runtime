import { DefaultVisualAdapter, type VisualLifecycleContext, type VisualProxy } from '../dom/VisualAdapter'
import { getProxyContent } from '../dom/Visual'
import { resolveGroupDragConfig } from '../dom/GroupDragProfile'
import type { ObjectVisualAdapter, Runtime } from '../Runtime'

/**
 * 文件 Demo 的多选视觉：主卡仍由 Runtime 的单卡 MotionController 驱动，
 * 修饰卡挂在同一个 proxy 内容壳里，跟随同一套 transform / landing 时间线。
 */
export function createGroupFileVisualAdapter(
  runtime: Runtime,
  clearGroup: (objectId: string) => void = () => undefined,
): ObjectVisualAdapter {
  const base = new DefaultVisualAdapter(runtime)
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

    // 源节点保留布局占位，和咕咕文件库一样呈现为半透明幽灵；主卡在
    // Runtime proxy 中跟手，源节点只承担原位置的空间锚点。
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

    // 保持和咕咕文件库一致：主卡之外最多叠两张修饰卡，避免选中数量很大时
    // 代理变成一摞不可读的完整列表。
    // 修饰卡不沿用源卡之间的布局距离。它们和主卡共享一个视觉中心，按
    // 咕咕文件库的 spread -> tight 参数叠成一摞，避免多选项在原列表中
    // 相距较远时，抓起后仍然散落在各自原位置。
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
        // 多层 backdrop-filter 会重复采样同一片背景；只保留最靠近主卡
        // 的一层轻模糊，其余修饰卡被遮挡大半，不再承担全尺寸模糊。
        backdropFilter: index === 0 ? 'blur(6px) saturate(1.15)' : 'none',
        WebkitBackdropFilter: index === 0 ? 'blur(6px) saturate(1.15)' : 'none',
        transform: `translate3d(${config.spread.x}px, ${config.spread.y}px, 0) rotateZ(${config.spread.rotate}deg) scale(${config.spread.scale})`,
        transformOrigin: 'center center',
      })
      extra.dataset.runtimeGroupModifier = 'true'
      delete extra.dataset.runtimeGroupGhost
      // 修饰卡与主卡同属缩放壳，但位于主内容层下方；不能放进 content，
      // 否则它会继承主卡的布局规则，也不能用负 z-index，否则会被卡片背景压住。
      shell.insertBefore(extra, content)
      modifiers.push(extra)
      stackAnimations.push({ element: extra, spread: config.spread, tight: config.tight })
    }

    // 所有修饰卡共享一条 RAF；多选数量增加时不再为每张卡各自调度动画循环。
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
        animation.element.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotateZ(${rotate.toFixed(2)}deg) scale(${scale.toFixed(4)})`
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

    const restoreSources = () => {
      if (stackRaf !== null) cancelAnimationFrame(stackRaf)
      if (modifierTimer !== null) window.clearTimeout(modifierTimer)
      for (const modifier of modifiers) modifier.remove()
      for (const source of sources) {
        if (!source.element.isConnected) continue
        source.element.style.cssText = source.cssText
        if (source.marker === undefined) delete source.element.dataset.runtimeGroupGhost
        else source.element.dataset.runtimeGroupGhost = source.marker
      }
      clearGroup(group.primaryObjectId)
    }
    states.set(proxy.element, { modifiers, dismissModifiers, restoreGhosts, cleanup: restoreSources })
  }

  return {
    createMove: context => base.createMove?.(context),
    createProxy(context): VisualProxy {
      const proxy = base.createProxy?.(context)
      if (!proxy) throw new Error('group file visual requires a base proxy')
      decorateProxy(proxy, context)
      return { element: proxy.element }
    },
    updateProxy(proxy, context) { decorateProxy(proxy, context) },
    land: (proxy, target, context) => {
      const state = states.get(proxy.element)
      // 该适配器现在也注册给普通单卡。没有 group 时必须完全走基础
      // landing，否则多选专用的透明度处理会让单卡代理提前淡出。
      if (!context.group || !state) return base.land?.(proxy, target, context)
      state?.dismissModifiers()
      if (context.landingMode !== 'target') {
        const duration = context.motion?.landing?.duration ?? 420
        state?.restoreGhosts(duration)
        // DefaultVisualAdapter 通过 targetSnapshot.opacity 驱动内容层淡出；
        // 普通多选回位不能把半透明幽灵的 opacity 当成代理终态。
        const targetSnapshot = context.targetSnapshot
          ? { ...context.targetSnapshot, opacity: '0' }
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
