import type { Runtime } from '../Runtime'
import { createDomRuntimeAdapter, type RuntimeDomAdapter } from './dom'

/** Vue ref / nextTick 生命周期使用的 Runtime 绑定适配器。 */
export function createVueRuntimeAdapter(runtime: Runtime): RuntimeDomAdapter {
  return createDomRuntimeAdapter(runtime)
}

