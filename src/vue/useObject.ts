import { onUnmounted, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'
import type { ObjectItem, ObjectUpdate } from '../object/ObjectItem'
import type { TargetItem } from '../target/Target'
import { useRuntime } from './context'

export type ObjectTargetOptions = Omit<TargetItem, 'id' | 'element' | 'generation'> & {
  id?: string
  element?: HTMLElement | null
}

export interface UseObjectOptions {
  id: string
  type: MaybeRefOrGetter<string>
  surface: MaybeRefOrGetter<string>
  abilities: MaybeRefOrGetter<readonly string[]>
  selected?: MaybeRefOrGetter<boolean>
  visual?: MaybeRefOrGetter<string | undefined>
  visualMode?: MaybeRefOrGetter<string | undefined>
  target?: MaybeRefOrGetter<ObjectTargetOptions | undefined>
}

export interface UseObjectResult {
  elementRef: Ref<HTMLElement | null>
  generation: number
}

function readObject(options: UseObjectOptions): ObjectUpdate & Pick<ObjectItem, 'type' | 'surfaceId' | 'abilities'> {
  return {
    type: toValue(options.type),
    surfaceId: toValue(options.surface),
    abilities: [...toValue(options.abilities)],
    selected: options.selected === undefined ? false : toValue(options.selected),
    visual: options.visual === undefined ? undefined : toValue(options.visual),
    visualMode: options.visualMode === undefined ? undefined : toValue(options.visualMode),
    target: options.target === undefined ? undefined : toValue(options.target),
  }
}

export function useObject(options: UseObjectOptions): UseObjectResult {
  const runtime = useRuntime()
  const elementRef = ref<HTMLElement | null>(null)
  const descriptor = readObject(options)
  const generation = runtime.objects.register({
    id: options.id,
    ...descriptor,
    element: null,
  })

  watch(
    () => readObject(options),
    next => runtime.objects.update(options.id, next),
    { deep: true },
  )

  watch(elementRef, (element, previous) => {
    const current = runtime.objects.get(options.id)
    if (current?.generation !== generation) return
    if (element === null && current.element && current.element !== previous) return
    runtime.objects.setElement(options.id, element)
  })

  onUnmounted(() => {
    runtime.unregisterObjectWhenIdle(options.id, generation)
  })

  return { elementRef, generation }
}
