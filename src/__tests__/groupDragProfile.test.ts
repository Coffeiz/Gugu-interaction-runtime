import { describe, expect, it } from 'vitest'
import { DEFAULT_GROUP_DRAG_CONFIG, resolveGroupDragConfig } from '../dom/GroupDragProfile'

describe('group drag profile', () => {
  it('未配置时使用默认叠牌参数', () => {
    expect(resolveGroupDragConfig()).toEqual(DEFAULT_GROUP_DRAG_CONFIG)
  })

  it('只覆盖传入字段并归一化非负时长和数量', () => {
    const resolved = resolveGroupDragConfig({
      maxModifiers: -2,
      foldDuration: -1,
      modifierFadeDuration: 120,
      tight: [{ x: 1, y: 2, rotate: 3, scale: 0.9 }],
    })

    expect(resolved.maxModifiers).toBe(0)
    expect(resolved.foldDuration).toBe(0)
    expect(resolved.modifierFadeDuration).toBe(120)
    expect(resolved.spread).toEqual(DEFAULT_GROUP_DRAG_CONFIG.spread)
    expect(resolved.tight).toEqual([{ x: 1, y: 2, rotate: 3, scale: 0.9 }])
  })
})
