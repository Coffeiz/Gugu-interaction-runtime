import type { MoveBehaviorDriver, MoveVisualLifecycle } from '../behavior/MoveBehavior'
import type { PointerSessionInputOptions } from '../input/PointerSessionInput'
import type { Runtime } from '../Runtime'

export interface MoveSessionOrchestrationOptions {
  sessionId: string
  driver?: MoveBehaviorDriver
  lifecycle?: MoveVisualLifecycle
  pointer?: PointerSessionInputOptions
  landing?: {
    target: HTMLElement
    retarget: (rect: DOMRect) => void
  }
}

/**
 * Coordinates the repetitive wiring needed by move interactions.
 * Runtime remains the owner of the lifecycle; this helper only composes
 * existing Runtime primitives and intentionally keeps visual/business policy
 * outside the core.
 */
export function orchestrateMoveSession(
  runtime: Runtime,
  options: MoveSessionOrchestrationOptions,
): () => void {
  const disposers: Array<() => void> = []

  if (options.driver) {
    runtime.bindMoveSession(options.sessionId, options.driver)
  }

  if (options.lifecycle) {
    runtime.bindMoveLifecycle(options.sessionId, options.lifecycle)
  }

  if (options.pointer) {
    disposers.push(runtime.bindPointerSessionInput(options.sessionId, options.pointer))
  }

  if (options.landing) {
    disposers.push(
      runtime.trackLandingTarget(
        options.sessionId,
        options.landing.target,
        options.landing.retarget,
      ),
    )
  }

  return () => {
    for (const dispose of disposers.splice(0)) {
      dispose()
    }
  }
}
