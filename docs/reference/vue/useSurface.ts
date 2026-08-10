import { onUnmounted, ref, watch, type Ref } from 'vue'
import { runtime } from '../Runtime'

export interface UseSurfaceOptions {
  id: string
  type: string
  accepts: string[]
  /** 可选滚动视口；不传时 Surface 根节点同时承担命中与滚动。 */
  viewport?: () => HTMLElement | null
  motion?: { resize?: { duration: number; easing: string } }
}

export interface UseSurfaceResult {
  elementRef: Ref<HTMLElement | null>
}

/** 历史参考实现（提交 f4ea296 的父提交）。不要直接复制到当前 src/vue。 */
export function useSurface(options: UseSurfaceOptions): UseSurfaceResult {
  const elementRef = ref<HTMLElement | null>(null)

  runtime.registerSurface({
    id: options.id,
    type: options.type,
    element: null,
    accepts: options.accepts,
    viewport: options.viewport,
    motion: options.motion,
  })

  watch(elementRef, element => runtime.surfaces.setElement(options.id, element))

  onUnmounted(() => {
    runtime.surfaces.unregister(options.id)
  })

  return { elementRef }
}
