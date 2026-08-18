import { describe, expect, it, vi } from 'vitest'
import { LayoutTransactionCoordinator } from '../dom/LayoutTransaction'
import {
  createLayoutMeasurement,
  createLayoutMeasurementContext,
  readLatestLayoutGeometry,
  subscribeLayoutGeometry,
} from '../dom/LayoutMeasurement'

describe('LayoutMeasurementContext', () => {
  it('同一 context 的不同 pass 不复用 mutation 前的 rect cache', () => {
    const element = document.createElement('div')
    document.body.appendChild(element)
    let left = 10
    const rectSpy = vi.spyOn(element, 'getBoundingClientRect').mockImplementation(
      () => new DOMRect(left, 20, 100, 50),
    )
    const context = createLayoutMeasurementContext('test-transaction')

    const capture = createLayoutMeasurement(context)
    expect(capture.rect(element).left).toBe(10)
    left = 80
    // Same pass is cached by design.
    expect(capture.rect(element).left).toBe(10)

    // New pass after DOM mutation must perform a fresh read while keeping transaction identity.
    const play = createLayoutMeasurement(context)
    expect(play.rect(element).left).toBe(80)
    expect(capture.context).toBe(context)
    expect(play.context).toBe(context)
    expect(rectSpy).toHaveBeenCalledTimes(2)
    element.remove()
  })

  it('只向实际被测量的 element 发布 geometry revision', () => {
    const target = document.createElement('div')
    const unrelated = document.createElement('div')
    document.body.append(target, unrelated)
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(new DOMRect(30, 0, 100, 50))
    vi.spyOn(unrelated, 'getBoundingClientRect').mockReturnValue(new DOMRect(90, 0, 100, 50))
    const targetListener = vi.fn()
    const unrelatedListener = vi.fn()
    const stopTarget = subscribeLayoutGeometry(target, targetListener)
    const stopUnrelated = subscribeLayoutGeometry(unrelated, unrelatedListener)

    createLayoutMeasurement().rect(target)

    expect(targetListener).toHaveBeenCalledTimes(1)
    expect(targetListener.mock.calls[0][0].rect.left).toBe(30)
    expect(unrelatedListener).not.toHaveBeenCalled()
    expect(readLatestLayoutGeometry(target)?.rect.left).toBe(30)

    stopTarget()
    stopUnrelated()
    target.remove()
    unrelated.remove()
  })

  it('同一 root 合并参与者共享 transaction-owned measurement context', () => {
    const coordinator = new LayoutTransactionCoordinator()
    const root = document.createElement('div')
    const move = coordinator.begin(root, 'move')
    const observer = coordinator.begin(root, 'surface-observer', 'observer')

    expect(observer.measurement).toBe(move.measurement)
    expect(observer.measurement.id).toBe(move.id)

    coordinator.commit(root, observer.participantId)
    coordinator.commit(root, move.participantId)
  })

  it('新 transaction 获得新的 measurement identity，旧 context 不会被复用', () => {
    const coordinator = new LayoutTransactionCoordinator()
    const root = document.createElement('div')
    const first = coordinator.begin(root, 'move')
    coordinator.commit(root, first.participantId)
    const second = coordinator.begin(root, 'move')

    expect(second.id).not.toBe(first.id)
    expect(second.measurement).not.toBe(first.measurement)
    expect(second.measurement.id).toBe(second.id)

    coordinator.cancel(root, second.participantId)
  })
})
