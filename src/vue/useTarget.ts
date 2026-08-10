import { onUnmounted, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'
import type { TargetItem, TargetUpdate } from '../target/Target'
import { useRuntime } from './context'

export interface UseTargetOptions {
  id: string
  surfaceId: MaybeRefOrGetter<string>
  accepts: MaybeRefOrGetter<readonly string[]>
  priority?: MaybeRefOrGetter<number | undefined>
  resolve?: MaybeRefOrGetter<(() => unknown) | undefined>
}

export interface UseTargetResult {
  elementRef: Ref<HTMLElement | null>
  generation: number
}

function readTarget(options: UseTargetOptions): TargetUpdate & Pick<TargetItem, 'surfaceId' | 'accepts'> {
  return {
    surfaceId: toValue(options.surfaceId),
    accepts: [...toValue(options.accepts)],
    priority: options.priority === undefined ? undefined : toValue(options.priority),
    resolve: options.resolve === undefined ? undefined : toValue(options.resolve),
  }
}

export function useTarget(options: UseTargetOptions): UseTargetResult {
  const runtime = useRuntime()
  const elementRef = ref<HTMLElement | null>(null)
  const descriptor = readTarget(options)
  const generation = runtime.targets.register({
    id: options.id,
    ...descriptor,
    element: null,
  })

  watch(
    () => readTarget(options),
    next => runtime.targets.update(options.id, next),
    { deep: true },
  )

  watch(elementRef, (element, previous) => {
    const current = runtime.targets.get(options.id)
    if (current?.generation !== generation) return
    if (element === null && current.element && current.element !== previous) return
    runtime.targets.setElement(options.id, element)
  })

  onUnmounted(() => {
    runtime.targets.unregister(options.id, generation)
  })

  return { elementRef, generation }
}
