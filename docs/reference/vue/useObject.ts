import { onUnmounted, ref, watch, watchEffect, type Ref } from 'vue'
import { runtime } from '../Runtime'

export interface UseObjectOptions {
  id: string
  type: string
  surface: () => string
  abilities: string[]
  visual?: string
  visualMode?: string
}

export interface UseObjectResult {
  elementRef: Ref<HTMLElement | null>
}

/** 历史参考实现（提交 f4ea296 的父提交）。不要直接复制到当前 src/vue。 */
export function useObject(options: UseObjectOptions): UseObjectResult {
  const elementRef = ref<HTMLElement | null>(null)

  const generation = runtime.objects.register({
    id: options.id,
    type: options.type,
    surfaceId: options.surface(),
    element: null,
    abilities: options.abilities,
    visual: options.visual,
    visualMode: options.visualMode ?? 'detach',
  })

  watchEffect(() => {
    runtime.objects.setSurface(options.id, options.surface())
  })

  watch(elementRef, (element, prev) => {
    // 卸载时 elementRef 变 null。跨列场景下新实例可能已经接管了节点，
    // 不能让旧实例的解绑覆盖新实例。
    if (element === null) {
      const current = runtime.objects.get(options.id)
      if (current?.element && current.element !== prev) return
    }
    runtime.objects.setElement(options.id, element)
  })

  onUnmounted(() => {
    const current = runtime.objects.get(options.id)
    if (current?.generation !== generation) return
    runtime.objects.unregister(options.id)
  })

  return { elementRef }
}
