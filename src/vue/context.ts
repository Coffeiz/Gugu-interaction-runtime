import { inject, provide, type InjectionKey } from 'vue'
import type { Runtime } from '../Runtime'

export const runtimeInjectionKey: InjectionKey<Runtime> = Symbol('gugu-interaction-runtime')

export function provideRuntime(runtime: Runtime): void {
  provide(runtimeInjectionKey, runtime)
}

export function useRuntime(): Runtime {
  const runtime = inject(runtimeInjectionKey)
  if (!runtime) {
    throw new Error('Vue Runtime provider is missing; call provideRuntime(runtime) in a parent component')
  }
  return runtime
}
