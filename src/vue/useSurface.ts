import { onUnmounted, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'
import type { Surface, SurfaceUpdate } from '../surface/Surface'
import { useRuntime } from './context'

export interface UseSurfaceOptions {
  id: string
  type: MaybeRefOrGetter<string>
  accepts: MaybeRefOrGetter<readonly string[]>
  viewport?: MaybeRefOrGetter<(() => HTMLElement | null) | undefined>
  motion?: MaybeRefOrGetter<Surface['motion'] | undefined>
}

export interface UseSurfaceResult {
  elementRef: Ref<HTMLElement | null>
  generation: number
}

function readSurface(options: UseSurfaceOptions): SurfaceUpdate & Pick<Surface, 'type' | 'accepts'> {
  return {
    type: toValue(options.type),
    accepts: [...toValue(options.accepts)],
    viewport: options.viewport === undefined ? undefined : toValue(options.viewport),
    motion: options.motion === undefined ? undefined : toValue(options.motion),
  }
}

export function useSurface(options: UseSurfaceOptions): UseSurfaceResult {
  const runtime = useRuntime()
  const elementRef = ref<HTMLElement | null>(null)
  const descriptor = readSurface(options)
  const generation = runtime.surfaces.register({
    id: options.id,
    ...descriptor,
    element: null,
  })

  watch(
    () => readSurface(options),
    next => runtime.surfaces.update(options.id, next),
    { deep: true },
  )

  watch(elementRef, (element, previous) => {
    const current = runtime.surfaces.get(options.id)
    if (current?.generation !== generation) return
    if (element === null && current.element && current.element !== previous) return
    runtime.surfaces.setElement(options.id, element)
  })

  onUnmounted(() => {
    runtime.surfaces.unregister(options.id, generation)
  })

  return { elementRef, generation }
}
