import { onUnmounted, ref, watch, watchEffect, type Ref } from 'vue'
import { runtime } from '../Runtime'

export interface UseObjectOptions {
  id: string
  type: string
  /** 用 getter 而不是静态值——对象所在的 Surface 会随业务数据变化。 */
  surface: () => string
  abilities: string[]
  /** 可选视觉适配器名；业务对象注册时一次性声明。 */
  visual?: string
  /** 可选视觉模式，默认 detach。 */
  visualMode?: string
}

export interface UseObjectResult {
  /** 绑定到模板里 `ref="elementRef"`，组件挂载后自动同步进 ObjectStore。 */
  elementRef: Ref<HTMLElement | null>
}

/**
 * 在拥有该对象 DOM 的组件里调用一次。注册发生在 setup 阶段（同步），
 * 不等 onMounted——ObjectStore 只是一份数据登记表，不需要真实 DOM 就能
 * 登记 id/type/abilities，`element` 字段等 elementRef 绑定到真实节点后
 * 再补上。
 */
export function useObject(options: UseObjectOptions): UseObjectResult {
  const elementRef = ref<HTMLElement | null>(null)

  runtime.objects.register({
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

  watch(elementRef, element => {
    runtime.objects.setElement(options.id, element)
  })

  onUnmounted(() => {
    runtime.objects.unregister(options.id)
  })

  return { elementRef }
}
