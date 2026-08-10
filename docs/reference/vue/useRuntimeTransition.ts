import { computed, ref, onUnmounted, type ComputedRef } from 'vue'
import { runtime } from '../Runtime'

/** 历史参考实现（提交 f4ea296 的父提交）。不要直接复制到当前 src/vue。 */
export function useRuntimeTransition(surfaceId: string): { controlled: ComputedRef<boolean> } {
  const version = ref(0)
  const stop = runtime.owner.subscribe(id => {
    if (id === surfaceId) version.value += 1
  })
  onUnmounted(stop)
  const controlled = computed(() => {
    version.value
    return runtime.owner.isControlled(surfaceId)
  })
  return { controlled }
}
