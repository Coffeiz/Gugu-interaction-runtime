import type { LayoutMeasurement } from './LayoutMeasurement'

export interface CollectionPresenceSnapshot {
  readonly root: ParentNode
  readonly selector: string
  /** key -> 所属 collection 标识（data-layout-collection 的值），不只是存不存在。 */
  readonly collectionByKey: ReadonlyMap<string, string>
  readonly entries: ReadonlyArray<{
    key: string
    element: HTMLElement
    rect: { left: number; top: number; width: number; height: number }
    content: HTMLElement
  }>
  /** capture 时登记的忽略判断，play 阶段必须用同一份，否则两边判断口径不一致。 */
  readonly ignore?: (element: HTMLElement) => boolean
  /** 只在受影响的 Surface 内比较 collection，避免扫描整个页面。 */
  readonly scopeSurfaces?: readonly HTMLElement[]
}

export interface CollectionPresenceOptions {
  readonly duration?: number
  readonly easing?: string
  readonly key?: (element: HTMLElement) => string
}

function defaultKey(element: HTMLElement): string {
  return element.dataset.layoutKey ?? element.dataset.card ?? ''
}

/**
 * 卡片可能同时属于好几个结构上独立的 collection（比如"最近完成"和各个年/
 * 月分组，都是各自独立的 v-for 作用域，不是同一个列表内部分区）。只判断
 * "这个 key 现在存不存在"不够——卡片从一个 collection 搬到另一个 collection
 * 时，key 本身没变，但物理上是旧 collection 里的节点被销毁、新 collection
 * 里创建了一个全新节点，只是恰好同名。这种情况必须能识别出来，按"旧
 * collection 离场 + 新 collection 入场"处理，不能因为 key 还在就当无事发生。
 *
 * 卡片是不是挂在一个折叠着的年/月分组里（`.month-folder`/`.year-folder`
 * `[data-layout-open="false"]`）。折叠分组用 `height:0; overflow:hidden`
 * 裁切，但里面的卡片作为普通流内子元素，自己的 `getBoundingClientRect()`
 * 依然是撑开后的自然尺寸——不会因为祖先高度是 0 就跟着变成 0，纯靠卡片
 * 自身的宽高校验测不出"其实看不见"，必须显式查一下折叠祖先。
 */
function isInsideCollapsedGroup(element: HTMLElement): boolean {
  const collapsed = element.closest<HTMLElement>('[data-layout-open="false"]')
  return collapsed !== null && collapsed.dataset.runtimeGroupAnimating !== 'true'
}

function resolveCollectionCard(element: HTMLElement, measurement?: LayoutMeasurement): { collectionId: string } | null {
  if (isInsideCollapsedGroup(element)) return null
  const collection = element.closest<HTMLElement>('[data-layout-collection]')
  if (!collection) return null
  const rect = measurement?.rect(element) ?? element.getBoundingClientRect()
  const parent = measurement?.rect(collection) ?? collection.getBoundingClientRect()
  const valid = rect.width > 0 && rect.height > 0 && parent.width > 0
    && rect.width <= parent.width * 1.25
    && rect.left >= parent.left - 1
    && rect.right <= parent.right + 1
  if (!valid) return null
  return { collectionId: collection.dataset.layoutCollection ?? '' }
}

function isWithinScope(element: HTMLElement, surfaces?: readonly HTMLElement[]): boolean {
  if (!surfaces || surfaces.length === 0) return true
  return surfaces.some(surface => surface === element || surface.contains(element))
}

export function captureCollectionPresence(
  root: ParentNode,
  selector: string,
  key: (element: HTMLElement) => string = defaultKey,
  ignore?: (element: HTMLElement) => boolean,
  scopeSurfaces?: readonly HTMLElement[],
  measurement?: LayoutMeasurement,
): CollectionPresenceSnapshot {
  const collectionByKey = new Map<string, string>()
  const entries = Array.from(root.querySelectorAll<HTMLElement>(selector))
    .map(element => {
      // 正在被 Runtime 接管的对象（抓取中/落地中）不参与 presence 判断——
      // 它自己的呈现由拖拽/落地动画控制，不该被这套跟它无关的入场/离场
      // 动画打断。dataset.runtimeActive 这类标记会在松手瞬间就被提前清掉
      // （比落地动画结束早得多），不能拿来在 capture/play 时判断"是不是
      // 还在交互中"；调用方（DetachMoveDriver）在整段抓取→落地生命周期内
      // 都能拿到确定的源节点引用，直接把它传进来最可靠。
      if (ignore?.(element)) return null
      if (!isWithinScope(element, scopeSurfaces)) return null
      const resolved = resolveCollectionCard(element, measurement)
      if (!resolved) return null
      const id = key(element)
      if (!id) return null
      const rect = measurement?.rect(element) ?? element.getBoundingClientRect()
      collectionByKey.set(id, resolved.collectionId)
      return {
        key: id,
        element,
        rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
        content: element.cloneNode(true) as HTMLElement,
      }
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
  return { root, selector, collectionByKey, entries, ignore, scopeSurfaces }
}

export function playCollectionPresence(
  snapshot: CollectionPresenceSnapshot,
  options: CollectionPresenceOptions = {},
  measurement?: LayoutMeasurement,
): void {
  const duration = options.duration ?? 250
  const easing = options.easing ?? 'cubic-bezier(.22,1,.36,1)'
  const key = options.key ?? defaultKey
  const currentCollectionByKey = new Map<string, string>()
  const current = Array.from(snapshot.root.querySelectorAll<HTMLElement>(snapshot.selector))
    .filter(element => {
      if (snapshot.ignore?.(element)) return false
      if (!isWithinScope(element, snapshot.scopeSurfaces)) return false
      const resolved = resolveCollectionCard(element, measurement)
      if (!resolved) return false
      const id = key(element)
      if (!id) return false
      currentCollectionByKey.set(id, resolved.collectionId)
      return true
    })

  // 入场：现在有效存在，但要么是全新 key，要么 key 虽然存在过、这次却挂在
  // 了跟之前不同的 collection 下（同名节点换了个列表，物理上是新节点）。
  current.filter(element => {
    const id = key(element)
    if (!id) return false
    const previousCollection = snapshot.collectionByKey.get(id)
    return previousCollection === undefined || previousCollection !== currentCollectionByKey.get(id)
  }).forEach(element => {
    element.animate([{ opacity: 0 }, { opacity: 1 }], { duration, easing, fill: 'both' })
  })

  // 离场幽灵只用来提示"这张卡彻底从视图里消失了"（比如挤出最近完成、又
  // 落进折叠着的月分组，看不见了）。如果卡片只是换了个 collection、但
  // 现在仍然可见（比如从月组升进了最近完成），旧位置的尺寸/边距跟新
  // collection 往往不一样（月组比最近完成多一圈缩进），旧位置离新位置又
  // 通常很近——两个不同尺寸的动画紧挨着同时播放，视觉上会像"中间变形"，
  // 反而比不放幽灵更让人困惑。这种情况只留入场淡入，不放离场幽灵。
  snapshot.entries.forEach(entry => {
    // 只要卡片还能在任何 collection 里找到（不管有没有换），就不是"消失"，
    // 不需要离场幽灵。
    if (currentCollectionByKey.has(entry.key)) return
    const ghost = entry.content
    const rect = entry.rect
    ghost.style.position = 'fixed'
    ghost.style.left = `${rect.left}px`
    ghost.style.top = `${rect.top}px`
    ghost.style.width = `${rect.width}px`
    ghost.style.height = `${rect.height}px`
    ghost.style.margin = '0'
    ghost.style.pointerEvents = 'none'
    ghost.style.zIndex = '2147483646'
    document.body.appendChild(ghost)
    const animation = ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration, easing, fill: 'both' })
    animation.finished.then(() => ghost.remove()).catch(() => ghost.remove())
  })
}
