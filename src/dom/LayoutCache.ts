export interface CachedLayoutSize {
  readonly width?: number
  readonly height: number
}

interface GroupLayoutCacheEntry {
  version: number
  states: Map<'open' | 'closed', {
    height: number
    surfaceTargets: Map<HTMLElement, CachedLayoutSize | null>
  }>
}

export interface CachedGroupLayout {
  readonly height: number
  readonly surfaceTargets: ReadonlyMap<HTMLElement, CachedLayoutSize | null>
}

/**
 * Runtime 生命周期内的布局缓存。
 *
 * 缓存只保存最近一次已提交的真实 DOM 测量；任何注册表结构变化都会
 * 由 Runtime 推进 version，避免把旧布局误用于新事务。DOM 本身变化时，
 * 框架适配层可调用 invalidate()，不需要让 Core 依赖 Vue/React。
 */
export class LayoutCache {
  private version = 0
  private readonly groups = new WeakMap<HTMLElement, GroupLayoutCacheEntry>()

  getVersion(): number {
    return this.version
  }

  invalidate(content?: HTMLElement): void {
    this.version += 1
    if (content) this.groups.delete(content)
  }

  getGroup(content: HTMLElement, opening: boolean): CachedGroupLayout | undefined {
    const entry = this.groups.get(content)
    if (!entry || entry.version !== this.version) return undefined
    return entry.states.get(opening ? 'open' : 'closed')
  }

  setGroup(
    content: HTMLElement,
    opening: boolean,
    targetHeight: number,
    surfaceTargets: ReadonlyMap<HTMLElement, CachedLayoutSize | null>,
  ): void {
    const existing = this.groups.get(content)
    const entry: GroupLayoutCacheEntry = existing && existing.version === this.version
      ? existing
      : { version: this.version, states: new Map() }
    entry.states.set(opening ? 'open' : 'closed', {
      height: targetHeight,
      surfaceTargets: new Map(surfaceTargets),
    })
    this.groups.set(content, entry)
  }
}
