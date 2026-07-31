import { describe, expect, it } from 'vitest'
import { acquireSourceVisualLease } from '../dom/SourceVisualLease'

describe('SourceVisualLease', () => {
  it('在抓取、交接和恢复之间只控制本体的受控样式', () => {
    const element = document.createElement('article')
    element.style.cssText = 'color: red; display: block'
    const lease = acquireSourceVisualLease(element, 'session-1')

    expect(lease.detachFromLayout()).toBe(true)
    expect(element.style.display).toBe('none')

    expect(lease.restoreLayoutHidden()).toBe(true)
    expect(element.style.display).toBe('')
    expect(element.style.visibility).toBe('hidden')

    expect(lease.restore()).toBe(true)
    expect(element.style.cssText).toContain('color: red')
    expect(element.style.display).toBe('block')
  })

  it('旧 session 不能恢复已被新 session 接管的元素', () => {
    const element = document.createElement('article')
    element.style.cssText = 'color: red'
    const oldLease = acquireSourceVisualLease(element, 'session-1')
    oldLease.detachFromLayout()
    const currentLease = acquireSourceVisualLease(element, 'session-2')
    currentLease.detachFromLayout()

    expect(oldLease.restore()).toBe(false)
    expect(element.style.display).toBe('none')
    expect(currentLease.restore()).toBe(true)
    expect(element.style.color).toBe('red')
  })
})
