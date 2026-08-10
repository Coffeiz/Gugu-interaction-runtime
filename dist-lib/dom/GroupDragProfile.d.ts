/** 多选拖拽中修饰卡的单张变换参数。坐标相对主卡左上角，单位为 px。 */
export interface GroupDragStackTransform {
    readonly x: number;
    readonly y: number;
    readonly rotate: number;
    readonly scale: number;
}
/** 对象类型可覆盖的多选拖拽视觉参数。未填写字段使用 Runtime 默认值。 */
export interface GroupDragConfig {
    readonly maxModifiers?: number;
    readonly foldDuration?: number;
    readonly modifierFadeDuration?: number;
    readonly spread?: readonly GroupDragStackTransform[];
    readonly tight?: readonly GroupDragStackTransform[];
}
export interface ResolvedGroupDragConfig {
    readonly maxModifiers: number;
    readonly foldDuration: number;
    readonly modifierFadeDuration: number;
    readonly spread: readonly GroupDragStackTransform[];
    readonly tight: readonly GroupDragStackTransform[];
}
export declare const DEFAULT_GROUP_DRAG_CONFIG: ResolvedGroupDragConfig;
export declare function resolveGroupDragConfig(config?: GroupDragConfig): ResolvedGroupDragConfig;
