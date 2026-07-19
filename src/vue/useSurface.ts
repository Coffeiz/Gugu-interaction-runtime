import { onUnmounted, ref, watch, type Ref } from 'vue'
import { runtime } from '../Runtime'

export interface UseSurfaceOptions {
  id: string
  type: string
  /** 接受哪些 object type；空数组表示不限制。 */
  accepts: string[]
}

export interface UseSurfaceResult {
  elementRef: Ref<HTMLElement | null>
}

export function useSurface(options: UseSurfaceOptions): UseSurfaceResult {
  const elementRef = ref<HTMLElement | null>(null)

  runtime.surfaces.register({
    id: options.id,
    type: options.type,
    element: null,
    accepts: options.accepts,
  })

  watch(elementRef, element => runtime.surfaces.setElement(options.id, element))

  onUnmounted(() => {
    runtime.surfaces.unregister(options.id)
  })

  return { elementRef }
}
