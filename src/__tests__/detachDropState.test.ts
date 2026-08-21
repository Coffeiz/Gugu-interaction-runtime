import { describe, expect, it } from 'vitest'
import { createDetachDropState } from '../runtime/DetachMoveDriver'

describe('detach 落点状态', () => {
  it('指针离开所有 Surface 后清除上一次有效落点', () => {
    let active = true
    const state = createDetachDropState(
      () => active ? { columnId: 'doing', index: 1 } : null,
      (next, previous) => next.columnId === previous?.columnId && next.index === previous?.index,
    )
    const event = new PointerEvent('pointermove')

    expect(state.update(event)).toEqual({ columnId: 'doing', index: 1 })
    active = false
    expect(state.update(event)).toBeNull()
    expect(state.release()).toBeNull()
  })
})
