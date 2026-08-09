import type { Runtime } from '../Runtime'
import { createDomRuntimeAdapter, type RuntimeDomAdapter } from './dom'

/** React callback ref / effect 生命周期使用的 Runtime 绑定适配器。 */
export function createReactRuntimeAdapter(runtime: Runtime): RuntimeDomAdapter {
  return createDomRuntimeAdapter(runtime)
}

