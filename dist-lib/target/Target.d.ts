/** 可接收拖放对象的语义目标。 */
export interface TargetItem {
    id: string;
    surfaceId: string;
    element: HTMLElement | null;
    accepts: string[];
    priority?: number;
    /** 命中或落地时提供给业务 Action 的语义数据。 */
    resolve?: () => unknown;
    /** 注册代次，用于 Vue 组件卸载时保护新实例。 */
    generation?: number;
}
export type TargetUpdate = Partial<Pick<TargetItem, 'surfaceId' | 'accepts' | 'priority' | 'resolve'>>;
