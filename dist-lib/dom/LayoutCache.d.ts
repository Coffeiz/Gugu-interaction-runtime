export interface CachedLayoutSize {
    readonly width?: number;
    readonly height: number;
}
export interface CachedGroupLayout {
    readonly height: number;
    readonly surfaceTargets: ReadonlyMap<HTMLElement, CachedLayoutSize | null>;
}
/**
 * Runtime 生命周期内的布局缓存。
 *
 * 缓存只保存最近一次已提交的真实 DOM 测量；任何注册表结构变化都会
 * 由 Runtime 推进 version，避免把旧布局误用于新事务。DOM 本身变化时，
 * 框架适配层可调用 invalidate()，不需要让 Core 依赖 Vue/React。
 */
export declare class LayoutCache {
    private version;
    private readonly groups;
    getVersion(): number;
    invalidate(content?: HTMLElement): void;
    getGroup(content: HTMLElement, opening: boolean): CachedGroupLayout | undefined;
    setGroup(content: HTMLElement, opening: boolean, targetHeight: number, surfaceTargets: ReadonlyMap<HTMLElement, CachedLayoutSize | null>): void;
}
