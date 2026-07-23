import { executeDetachDrag } from '../runtime/DetachMoveDriver'
import { createDetachMoveFromAdapter } from '../runtime/detach/DetachAdapter'
import { type ObjectVisualAdapter } from '../Runtime'
import { DefaultVisualAdapter } from '../dom/VisualAdapter'
import { createDetachVisualAdapter } from './kanbanDetachVisual'
import { runtime } from '../Runtime'

export function createKanbanVisualAdapter(context: {
  surfaceIds: string[]
  findColumnIdOf: (objectId: string) => string | undefined
}): ObjectVisualAdapter {
  const defaults = new DefaultVisualAdapter()
  const detach = createDetachVisualAdapter()
  return {
    resolveSource: objectId => defaults.resolveSource(objectId),
    resolveTarget: objectId => defaults.resolveTarget(objectId),
    captureVisualState: element => defaults.captureVisualState(element),
    applyState: (element, state) => defaults.applyState(element, state),
    createProxy: detach.createProxy,
    updateProxy: detach.updateProxy,
    land: detach.land,
    reveal: detach.reveal,
    dispose: detach.dispose,
    createMove: ({ objectId, element, event }) => {
      if (!runtime.objects.hasAbility(objectId, 'move')) return {}
      event.preventDefault()
      return createDetachMoveFromAdapter({
        runtime,
        objectId,
        element,
        event,
        surfaceIds: context.surfaceIds,
        findColumnIdOf: context.findColumnIdOf,
      })
    },
    legacyStart: ({ objectId, element, event }) => {
      executeDetachDrag({
        runtime,
        objectId,
        element,
        event,
        surfaceIds: context.surfaceIds,
        findColumnIdOf: context.findColumnIdOf,
      })
    },
  }
}
