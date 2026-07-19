import { computed, ref, onUnmounted, type ComputedRef } from 'vue'
import { runtime } from '../Runtime'

/**
 * 唯一职责：告诉模板"这个 Surface 现在是不是被 Runtime 接管了"，喂给
 * `<TransitionGroup :css="!controlled">`。规则 1/2：Runtime 接管期间，
 * Vue 的 Transition/TransitionGroup 必须整体关闭，不能只是"尽量不冲突"。
 */
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
