import { startCardDragDetach } from './kanbanDragDetach'
import { type ObjectVisualAdapter } from '../Runtime'
import { DefaultVisualAdapter } from '../dom/VisualAdapter'
import { createDetachVisualAdapter } from './kanbanDetachVisual'

/** 看板项目卡的类型级视觉适配器。页面只安装一次，不按对象重复创建。 */
export function createKanbanVisualAdapter(): ObjectVisualAdapter {
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
    legacyStart: ({ objectId, element, event }) => {
      startCardDragDetach(event, objectId, element)
    },
  }
}
