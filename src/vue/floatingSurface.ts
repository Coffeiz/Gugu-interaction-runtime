export interface FloatingSurfaceOptions {
  /** 浮动 Surface 是否打开；由 Vue 适配层负责驱动外壳高度。 */
  open?: boolean | (() => boolean)
  /** 用于选择多个同级滚动区域中的真实滚动节点。 */
  scrollKey?: string | (() => string | null)
  /** 自然高度上限；传函数可以读取响应式/运行时尺寸。 */
  maxHeight?: number | (() => number | null)
}

export interface FloatingSurfaceDom {
  layoutElement: HTMLElement | null
  viewport: HTMLElement | null
  measureLayout: (() => { height: number } | null)
}

function resolveNodes(root: HTMLElement | null, options: FloatingSurfaceOptions): { layoutElement: HTMLElement | null; viewport: HTMLElement | null } {
  const layoutElement = root?.matches('[data-layout-role="viewport"]')
    ? root
    : root?.querySelector<HTMLElement>('[data-layout-role="viewport"]') ?? null
  const rawKey = typeof options.scrollKey === 'function' ? options.scrollKey() : options.scrollKey
  const key = rawKey?.replace(/"/g, '\\"')
  const viewport = root
    ? (key ? root.querySelector<HTMLElement>(`[data-drawer-scroll="${key}"]`) : null)
      ?? root.querySelector<HTMLElement>('[data-drawer-scroll], [data-scroll-viewport]')
      ?? null
    : null
  return { layoutElement, viewport }
}

function readMaxHeight(options: FloatingSurfaceOptions): number | null {
  const value = options.maxHeight
  if (typeof value === 'function') return value()
  return value ?? null
}

function clampHeight(height: number, maxHeight: number | null): number {
  if (!Number.isFinite(height) || height <= 0) return 0
  return maxHeight !== null ? Math.min(height, Math.max(0, maxHeight)) : height
}

/**
 * 抓取到底部卡片时，Move Runtime 会临时插入滚动补偿占位，避免源卡移出
 * 布局流后 scrollTop 上跳。它只服务于滚动位置，不属于 Surface 的自然内容高度。
 */
function readContentScrollHeight(element: HTMLElement): number {
  const compensation = Array.from(
    element.querySelectorAll<HTMLElement>('[data-runtime-scroll-compensation="true"]'),
  ).reduce((total, node) => total + node.getBoundingClientRect().height, 0)
  return Math.max(0, element.scrollHeight - compensation)
}

function readNaturalHeight(root: HTMLElement, layoutElement: HTMLElement | null, viewport: HTMLElement | null): number {
  const style = layoutElement?.style
  const inlineStyle = style
    ? { height: style.height, overflow: style.overflow, transition: style.transition }
    : null
  if (style) {
    // 浮动 Surface 通常正处于上一笔 resize 的固定高度，直接读取
    // layoutElement.scrollHeight 会把当前高度误当成自然高度，收起组时无法缩小。
    style.height = 'auto'
    style.overflow = 'visible'
    style.transition = 'none'
    void layoutElement?.offsetHeight
  }
  const layoutCandidates = Array.from(root.querySelectorAll<HTMLElement>('[data-layout-collection], [data-layout-content]'))
    .map(element => {
      const rect = element.getBoundingClientRect()
      const computed = getComputedStyle(element)
      return {
        element,
        scrollHeight: readContentScrollHeight(element),
        rectHeight: rect.height,
        display: computed.display,
        visibility: computed.visibility,
        opacity: computed.opacity,
        layoutOpen: element.dataset.layoutOpen ?? null,
        role: element.dataset.layoutRole ?? null,
        collection: element.dataset.layoutCollection ?? null,
      }
    })
    .filter(candidate => {
      if (candidate.display === 'none' || candidate.visibility === 'hidden') return false
      if (candidate.layoutOpen === 'false') return false
      return candidate.rectHeight > 0 || candidate.collection !== null
    })
  const viewportScrollHeight = viewport ? readContentScrollHeight(viewport) : 0
  // 有明确布局节点时，它的自然 scrollHeight 才是外壳高度。内部滚动轨道的
  // scrollHeight 包含溢出内容，不能和外壳高度一起取最大值，否则抓走底部卡片后
  // 会把滚动轨道旧的溢出高度误当成外壳目标，留下恰好一张卡片的底部空位。
  // 独立 collection 仍可提供布局高度，但同滚动轨道的 collection 只是同一份
  // scrollHeight 的重复观测，应排除避免重复候选。
  const candidates = layoutElement
    ? [
        readContentScrollHeight(layoutElement),
        ...layoutCandidates
          .filter(candidate => candidate.collection === null || candidate.scrollHeight !== viewportScrollHeight)
          .map(candidate => candidate.scrollHeight),
      ]
    : [viewportScrollHeight, ...layoutCandidates.map(candidate => candidate.scrollHeight)]
  const height = Math.max(...candidates, 0)
  if (style && inlineStyle) {
    style.height = inlineStyle.height
    style.overflow = inlineStyle.overflow
    style.transition = inlineStyle.transition
  }
  return height
}

/**
 * 只在传入的 Surface 根节点内解析浮动 Surface 的布局角色。
 * 不扫描 document，也不把外壳错误地当成滚动视口。
 */
export function resolveFloatingSurfaceDom(
  root: HTMLElement | null,
  options: FloatingSurfaceOptions = {},
): FloatingSurfaceDom {
  const { layoutElement, viewport } = resolveNodes(root, options)

  return {
    layoutElement,
    viewport,
    measureLayout: () => {
      const currentRoot = root?.isConnected ? root : null
      if (!currentRoot) return null
      const currentNodes = resolveNodes(currentRoot, options)
      const naturalHeight = readNaturalHeight(currentRoot, currentNodes.layoutElement, currentNodes.viewport)
        || readContentScrollHeight(currentRoot)
      const maxHeight = readMaxHeight(options)
      const height = clampHeight(naturalHeight, maxHeight)
      return { height }
    },
  }
}
