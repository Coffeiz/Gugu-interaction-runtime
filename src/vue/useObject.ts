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
    // 卸载时 elementRef 变 null。跨列场景下新实例可能已 setElement(id,
    // 新节点)——若当前注册的 element 不是本实例的 prev 节点，说明已被
    // 新实例接管，不能清空（否则 waitForMoveTarget 拿不到目标元素 →
    // landing 失败瞬移）。
    if (element === null) {
      const current = runtime.objects.get(options.id)
      if (current?.element && current.element !== prev) return
    }
    runtime.objects.setElement(options.id, element)
  })

  onUnmounted(() => {
    // 跨列时 Vue 可能先创建新实例（register 同 id）再销毁旧实例。
    // 新实例 register 后 generation 已递增，若当前 item 的 generation
    // 不是本实例注册的，说明注册已被新实例接管——保留（unregister
    // 会删掉新实例的登记，导致 waitForMoveTarget 拿不到目标元素 →
    // landing 失败瞬移）。
    const current = runtime.objects.get(options.id)
    if (current?.generation !== generation) return
    runtime.objects.unregister(options.id)
  })

  return { elementRef }
}
