import { describe, expect, it } from 'vitest'
import { applyGroupModifierLayout } from '../dom/GroupVisual'

describe('group visual compact layout', () => {
  it('modifier 复用主代理的紧凑布局契约', () => {
    const element = document.createElement('div')

    applyGroupModifierLayout(element, {
      width: '284px',
      gridTemplateColumns: '1.4fr 36px 0.9fr 38px 0px 0px',
    })

    expect(element.dataset.runtimeProxyContent).toBe('true')
    expect(element.dataset.runtimeCompact).toBe('true')
    expect(element.style.boxSizing).toBe('border-box')
    expect(element.style.left).toBe('50%')
    expect(element.style.width).toBe('284px')
    expect(element.style.gridTemplateColumns).toBe('1.4fr 36px 0.9fr 38px 0px 0px')
  })

  it('主代理内容选择会排除 modifier', async () => {
    const { getProxyContent } = await import('../dom/Visual')
    const proxy = document.createElement('div')
    const modifier = document.createElement('div')
    const content = document.createElement('div')
    modifier.dataset.runtimeProxyContent = 'true'
    modifier.dataset.runtimeGroupModifier = 'true'
    content.dataset.runtimeProxyContent = 'true'
    proxy.append(modifier, content)

    expect(getProxyContent(proxy)).toBe(content)
  })
})
