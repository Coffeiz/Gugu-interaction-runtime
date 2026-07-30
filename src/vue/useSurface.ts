import { onUnmounted, ref, watch, type Ref } from 'vue'
import { runtime } from '../Runtime'

export interface UseSurfaceOptions {
  id: string
  type: string
  /** 接受哪些 object type；空数组表示不限制。 */
  accepts: string[]
  /** Surface resize 运动参数。未设置时使用 DEFAULT_MOTION_PROFILE。 */
  motion?: { resize?: { duration: number; easing: string } }
}

export interface UseSurfaceResult {
  elementRef: Ref<HTMLElement | null>
}

export function useSurface(options: UseSurfaceOptions): UseSurfaceResult {
  const elementRef = ref<HTMLElement | null>(null)

  runtime.registerSurface({
    id: options.id,
    type: options.type,
    element: null,
    accepts: options.accepts,
    motion: options.motion,
  })

  watch(elementRef, element => runtime.surfaces.setElement(options.id, element))

  onUnmounted(() => {
    runtime.surfaces.unregister(options.id)
  })

  return { elementRef }
}
