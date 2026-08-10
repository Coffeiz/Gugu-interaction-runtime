import { onUnmounted, ref, type Ref } from 'vue'
import { useRuntime } from './context'

export function useRuntimeTransition(id: string): { controlled: Readonly<Ref<boolean>> } {
  const runtime = useRuntime()
  const controlled = ref(runtime.isControlled(id))
  const stop = runtime.onOwnershipChange(changedId => {
    if (changedId === id) controlled.value = runtime.isControlled(id)
  })
  onUnmounted(stop)
  return { controlled }
}
