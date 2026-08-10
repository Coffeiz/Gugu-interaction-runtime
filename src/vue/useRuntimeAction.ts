import { onUnmounted } from 'vue'
import type { Action } from '../action/Action'
import { useRuntime } from './context'

export function useRuntimeAction(handler: (action: Action) => void | Promise<void>): void {
  const stop = useRuntime().onAction(handler)
  onUnmounted(stop)
}
