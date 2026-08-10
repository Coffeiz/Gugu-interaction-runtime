/** 多选拖拽中修饰卡的单张变换参数。坐标相对主卡左上角，单位为 px。 */
export interface GroupDragStackTransform {
  readonly x: number
  readonly y: number
  readonly rotate: number
  readonly scale: number
}

/** 对象类型可覆盖的多选拖拽视觉参数。未填写字段使用 Runtime 默认值。 */
export interface GroupDragConfig {
  readonly maxModifiers?: number
  readonly foldDuration?: number
  readonly modifierFadeDuration?: number
  readonly spread?: readonly GroupDragStackTransform[]
  readonly tight?: readonly GroupDragStackTransform[]
}

export interface ResolvedGroupDragConfig {
  readonly maxModifiers: number
  readonly foldDuration: number
  readonly modifierFadeDuration: number
  readonly spread: readonly GroupDragStackTransform[]
  readonly tight: readonly GroupDragStackTransform[]
}

export const DEFAULT_GROUP_DRAG_CONFIG: ResolvedGroupDragConfig = {
  maxModifiers: 2,
  foldDuration: 300,
  modifierFadeDuration: 180,
  spread: [
    { x: 50, y: -20, rotate: 20, scale: 1 },
    { x: 90, y: -38, rotate: 34, scale: 1 },
  ],
  tight: [
    { x: 7, y: 6, rotate: 4, scale: 0.97 },
    { x: 13, y: 12, rotate: 8, scale: 0.94 },
  ],
}

export function resolveGroupDragConfig(config?: GroupDragConfig): ResolvedGroupDragConfig {
  return {
    maxModifiers: Math.max(0, config?.maxModifiers ?? DEFAULT_GROUP_DRAG_CONFIG.maxModifiers),
    foldDuration: Math.max(0, config?.foldDuration ?? DEFAULT_GROUP_DRAG_CONFIG.foldDuration),
    modifierFadeDuration: Math.max(0, config?.modifierFadeDuration ?? DEFAULT_GROUP_DRAG_CONFIG.modifierFadeDuration),
    spread: config?.spread ?? DEFAULT_GROUP_DRAG_CONFIG.spread,
    tight: config?.tight ?? DEFAULT_GROUP_DRAG_CONFIG.tight,
  }
}
