import { nextTick, onUnmounted, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'
import type { Surface, SurfaceUpdate } from '../surface/Surface'
import { useRuntime } from './context'
import { resolveFloatingSurfaceDom, type FloatingSurfaceOptions } from './floatingSurface'
import { transitionGroupHeight } from '../dom/GroupLayout'

export interface UseSurfaceOptions {
  id: string
  type: MaybeRefOrGetter<string>
  accepts: MaybeRefOrGetter<readonly string[]>
  layout: MaybeRefOrGetter<Surface['layout']>
  camera?: MaybeRefOrGetter<Surface['camera']>
  /** Surface 的滚动视口回调；它本身不能再作为 getter 被 toValue 解包。 */
  viewport?: (() => HTMLElement | null) | undefined
  layoutElement?: (() => HTMLElement | null) | undefined
  measureLayout?: (() => { width?: number; height: number } | null) | undefined
  motion?: MaybeRefOrGetter<Surface['motion'] | undefined>
  /** 启用约定式浮动 Surface DOM 自动发现。 */
  floating?: MaybeRefOrGetter<boolean | FloatingSurfaceOptions>
}

export interface UseSurfaceResult {
  elementRef: Ref<HTMLElement | null>
  generation: number
  isAnimating: Readonly<Ref<boolean>>
}

interface FloatingResolvers {
  viewport: () => HTMLElement | null
  layoutElement: () => HTMLElement | null
  measureLayout: () => { height: number } | null
}

function readSurface(
  options: UseSurfaceOptions,
  root: () => HTMLElement | null,
  floatingResolvers?: FloatingResolvers,
): SurfaceUpdate & Pick<Surface, 'type' | 'accepts' | 'layout'> {
  const floating = options.floating === undefined ? false : toValue(options.floating)
  const autoLayoutElement = options.layoutElement ?? floatingResolvers?.layoutElement
  const autoViewport = options.viewport ?? floatingResolvers?.viewport
  const autoMeasureLayout = options.measureLayout ?? floatingResolvers?.measureLayout
  return {
    type: toValue(options.type),
    accepts: [...toValue(options.accepts)],
    layout: toValue(options.layout),
    camera: options.camera === undefined ? undefined : toValue(options.camera),
    viewport: floating ? autoViewport : options.viewport,
    layoutElement: floating ? autoLayoutElement : options.layoutElement,
    measureLayout: floating ? autoMeasureLayout : options.measureLayout,
    motion: options.motion === undefined ? undefined : toValue(options.motion),
  }
}

export function useSurface(options: UseSurfaceOptions): UseSurfaceResult {
  const runtime = useRuntime()
  const elementRef = ref<HTMLElement | null>(null)
  const root = () => elementRef.value
  const floatingOptions = (): FloatingSurfaceOptions => {
    const floating = options.floating === undefined ? false : toValue(options.floating)
    return floating === true ? {} : (floating || {})
  }
  const resolveFloating = () => resolveFloatingSurfaceDom(root(), floatingOptions())
  const floatingResolvers: FloatingResolvers = {
    viewport: () => resolveFloating().viewport,
    layoutElement: () => resolveFloating().layoutElement,
    measureLayout: () => resolveFloating().measureLayout(),
  }
  const descriptor = readSurface(options, root, floatingResolvers)
  const generation = runtime.surfaces.register({
    id: options.id,
    ...descriptor,
    element: null,
  })
  const isAnimating = ref(false)
  let animationTimer: number | null = null
  let resizeFrame: number | null = null

  const currentFloatingOptions = (): FloatingSurfaceOptions => floatingOptions()
  const isFloatingSurface = (): boolean => {
    const floating = options.floating === undefined ? false : toValue(options.floating)
    return Boolean(floating)
  }
  const currentFloatingOpen = (): boolean => {
    const open = currentFloatingOptions().open
    return typeof open === 'function' ? open() : open !== false
  }
  const currentFloatingScrollKey = (): string | null => {
    const key = currentFloatingOptions().scrollKey
    return typeof key === 'function' ? key() : key ?? null
  }
  const clearFloatingAnimation = (): void => {
    if (animationTimer !== null) window.clearTimeout(animationTimer)
    animationTimer = null
    isAnimating.value = false
  }
  const animateFloatingSurface = (): void => {
    const element = elementRef.value
    if (!isFloatingSurface() || !element?.isConnected) return
    const dom = resolveFloatingSurfaceDom(element, currentFloatingOptions())
    const layoutElement = dom.layoutElement
    if (!layoutElement) return
    const currentHeight = layoutElement.getBoundingClientRect().height
    const targetHeight = currentFloatingOpen() ? dom.measureLayout()?.height ?? 0 : 0
    if (Math.abs(currentHeight - targetHeight) < 0.5) {
      clearFloatingAnimation()
      if (targetHeight === 0) layoutElement.style.height = '0px'
      return
    }
    const scrollKey = currentFloatingScrollKey()
    const scrollElement = scrollKey
      ? element.querySelector<HTMLElement>(`[data-drawer-scroll="${scrollKey.replace(/"/g, '\\"')}"]`)
      : dom.viewport
    const scrollTop = scrollElement?.scrollTop ?? 0
    clearFloatingAnimation()
    isAnimating.value = true
    const started = transitionGroupHeight(layoutElement, targetHeight, undefined, undefined, undefined, true)
    if (!started) {
      isAnimating.value = false
      return
    }
    animationTimer = window.setTimeout(() => {
      animationTimer = null
      isAnimating.value = false
      if (scrollElement) scrollElement.scrollTop = scrollTop
    }, 400)
  }
  const runFloatingObserverResize = (): void => {
    if (!isFloatingSurface()) return
    const root = elementRef.value?.ownerDocument ?? document
    const transaction = runtime.layout.begin(root, 'surface-observer', 'observer')
    runtime.layout.request(root, { type: 'surface-natural-size', surfaceId: options.id })
    // 交互事务已经负责在同一轮里重新测量和播放 Surface。Observer 只作为
    // 参与者登记意图，不能再启动第二条高度动画。
    if (transaction.reasons.some(reason => reason === 'move' || reason === 'group-toggle')) {
      runtime.layout.commit(root, transaction.participantId)
      return
    }
    const animate = (plan?: { isCurrent: () => boolean }) => {
      if (plan && !plan.isCurrent()) return
      animateFloatingSurface()
    }
    const deferred = runtime.layout.defer(root, transaction.participantId, plan => animate(plan), 'surface-resize')
    if (!deferred) animate()
    runtime.layout.commit(root, transaction.participantId)
  }
  const scheduleFloatingResize = (): void => {
    if (resizeFrame !== null) cancelAnimationFrame(resizeFrame)
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = null
      runFloatingObserverResize()
    })
  }

  let resizeObserver: ResizeObserver | null = null
  let mutationObserver: MutationObserver | null = null
  const stopFloatingObservers = (): void => {
    resizeObserver?.disconnect()
    mutationObserver?.disconnect()
    resizeObserver = null
    mutationObserver = null
  }
  const syncFloatingObservers = (element: HTMLElement | null): void => {
    stopFloatingObservers()
    const floating = options.floating === undefined ? false : toValue(options.floating)
    if (!floating || !element || typeof ResizeObserver === 'undefined') return
    const sync = (): void => {
      const current = runtime.surfaces.get(options.id)
      if (current?.generation !== generation) return
      runtime.surfaces.update(options.id, readSurface(options, root, floatingResolvers))
      scheduleFloatingResize()
    }
    resizeObserver = new ResizeObserver(sync)
    resizeObserver.observe(element)
    const layoutElement = resolveFloatingSurfaceDom(element, floating === true ? {} : floating).layoutElement
    const viewport = resolveFloatingSurfaceDom(element, floating === true ? {} : floating).viewport
    if (layoutElement && layoutElement !== element) resizeObserver.observe(layoutElement)
    if (viewport && viewport !== element && viewport !== layoutElement) resizeObserver.observe(viewport)
    if (typeof MutationObserver !== 'undefined') {
      mutationObserver = new MutationObserver(sync)
      mutationObserver.observe(element, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-layout-role', 'data-drawer-scroll', 'data-scroll-viewport'] })
    }
    sync()
    scheduleFloatingResize()
  }

  watch(
    () => readSurface(options, root, floatingResolvers),
    next => runtime.surfaces.update(options.id, next),
    { deep: true },
  )

  watch(elementRef, (element, previous) => {
    const current = runtime.surfaces.get(options.id)
    if (current?.generation !== generation) return
    if (element === null && current.element && current.element !== previous) return
    runtime.surfaces.setElement(options.id, element)
    syncFloatingObservers(element)
  })

  watch(() => options.floating === undefined ? false : toValue(options.floating), () => {
    syncFloatingObservers(elementRef.value)
  }, { deep: true })

  watch(
    () => {
      const floating = currentFloatingOptions()
      return [
        currentFloatingOpen(),
        typeof floating.scrollKey === 'function' ? floating.scrollKey() : floating.scrollKey ?? null,
      ] as const
    },
    () => {
      void nextTick(() => animateFloatingSurface())
    },
    { flush: 'post', immediate: true },
  )

  onUnmounted(() => {
    clearFloatingAnimation()
    if (resizeFrame !== null) cancelAnimationFrame(resizeFrame)
    stopFloatingObservers()
    runtime.surfaces.unregister(options.id, generation)
  })

  return { elementRef, generation, isAnimating }
}
