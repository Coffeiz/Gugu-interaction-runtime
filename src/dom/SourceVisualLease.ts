/**
 * 真实业务 DOM 永远归框架所有；Runtime 只在拖拽事务中临时接管它的可见性与布局。
 *
 * 同一对象在 landing 中被 regrab 时，旧 session 的异步收尾不得覆盖新 session
 * 的样式。因此 lease 以元素为键、以 session 为所有者，非所有者的 restore 是空操作。
 */
interface SourceLeaseRecord {
  readonly sessionId: string
  readonly cssText: string
}

const LIVE_LAYOUT_PROPERTIES = ['left', 'top', 'right', 'bottom', 'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight', 'zIndex'] as const

function preserveLiveLayout(element: HTMLElement): Record<typeof LIVE_LAYOUT_PROPERTIES[number], string> {
  return Object.fromEntries(LIVE_LAYOUT_PROPERTIES.map(property => [property, element.style[property]])) as Record<typeof LIVE_LAYOUT_PROPERTIES[number], string>
}

function restoreSourceStyle(element: HTMLElement, cssText: string): void {
  const liveLayout = preserveLiveLayout(element)
  element.style.cssText = cssText
  for (const property of LIVE_LAYOUT_PROPERTIES) {
    if (liveLayout[property] !== '') element.style[property] = liveLayout[property]
  }
}

const sourceLeases = new WeakMap<HTMLElement, SourceLeaseRecord>()

export interface SourceVisualLease {
  readonly element: HTMLElement
  readonly sessionId: string
  /** 抓取阶段从业务布局中移出本体；可见运动只由 Runtime overlay proxy 承担。 */
  detachFromLayout(): boolean
  /** 提交后恢复业务布局位置，但保持本体不可见，等待 proxy reveal。 */
  restoreLayoutHidden(): boolean
  /** 完整恢复抓取前的内联样式。仅当前 owner 有效。 */
  restore(): boolean
  isOwner(): boolean
}

// 曾经加过 detachToOverlay()：手动把业务节点 appendChild 到 document.documentElement
// 逃裁切，跟 landing proxy 同一招。实测证实不安全——Vue 重渲染时认不出被搬移过的
// 节点，在新列另外挂一份新的，旧节点没被回收，变成两张卡片同时存在。已撤销，不要
// 再加回来。真要在抓取阶段也逃出玻璃裁切，得走 Vue 自己的 <Teleport>（业务组件自己
// 声明，Vue 的 vnode 追踪能正确处理），不能由 Runtime 在业务节点身上做无 Vue 感知
// 的 DOM 手术。

export function acquireSourceVisualLease(
  element: HTMLElement,
  sessionId: string,
): SourceVisualLease {
  const record: SourceLeaseRecord = {
    sessionId,
    cssText: element.style.cssText,
  }
  sourceLeases.set(element, record)

  const owns = (): boolean => sourceLeases.get(element) === record

  return {
    element,
    sessionId,
    detachFromLayout: () => {
      if (!owns()) return false
      element.style.display = 'none'
      element.style.pointerEvents = 'none'
      return true
    },
    restoreLayoutHidden: () => {
      if (!owns()) return false
      element.style.display = ''
      element.style.visibility = 'hidden'
      element.style.pointerEvents = 'none'
      return true
    },
    restore: () => {
      if (!owns()) return false
      // Vue 可能已在 landing 期间把卡片提交到新坐标；不能用抓取前的整段
      // cssText 把这些实时布局字段覆盖回旧位置。Runtime 只恢复自己接管的
      // 可见性/交互状态，保留当前业务布局。
      restoreSourceStyle(element, record.cssText)
      sourceLeases.delete(element)
      return true
    },
    isOwner: owns,
  }
}
