import { captureRects, FLIP_DURATION, FLIP_EASING, playFlip, resetActiveFlip } from './Flip'
import { type MotionProfile, DEFAULT_MOTION_PROFILE } from './MotionProfile'
import { animateRafHeight, cancelRafHeight } from './RafLayoutAnimator'
import { captureCollectionPresence, playCollectionPresence, type CollectionPresenceSnapshot } from './CollectionPresence'
import { createLayoutMeasurement, type LayoutMeasurement } from './LayoutMeasurement'

/** Runtime 通过此引用注入全局 MotionProfile；模块级而非传参。 */
let currentProfile: MotionProfile | null = null
let layoutPresenceEnabled = false
const groupToggleTokens = new WeakMap<HTMLElement, number>()
export function setMotionProfiles(profile: MotionProfile | null): void {
  currentProfile = profile
}
export function setLayoutPresenceEnabled(enabled: boolean): void { layoutPresenceEnabled = enabled }

/** 读取全局 MotionProfile，不存在时返回默认值。 */
function resolveProfile(): { flip: { duration: number; easing: string }; resize: { duration: number; easing: string } } {
  const p = currentProfile
  return {
    flip: p?.flip ?? DEFAULT_MOTION_PROFILE.flip,
    resize: p?.resize ?? DEFAULT_MOTION_PROFILE.resize,
  }
}


export interface GroupRect { readonly top: number; readonly left: number; readonly width: number; readonly height: number }
export interface GroupLayoutSnapshot {
  readonly element: HTMLElement
  readonly parent: HTMLElement | null
  readonly rect: GroupRect
}
export interface ScrollSnapshot { readonly top: number; readonly height: number; readonly clientHeight: number; readonly anchor: 'top' | 'middle' | 'bottom' }
export interface SurfaceLayoutSnapshot {
  readonly element: HTMLElement
  readonly rect: GroupRect
  readonly inlineStyle: Pick<CSSStyleDeclaration, 'height' | 'overflow' | 'transition'>
}
export interface LayoutFlipSnapshot {
  readonly root: ParentNode
  /** 分组树（年/月包装节点 + 挂在分组下的卡片叶子）的 Relative FLIP 快照。 */
  readonly group?: { readonly before: GroupLayoutSnapshot[] }
  /** 不属于任何分组的普通卡片（比如"进行中"列）的常规 FLIP 快照。 */
  readonly flat?: { readonly elements: HTMLElement[]; readonly before: Map<HTMLElement, DOMRect> }
  readonly surfaces: SurfaceLayoutSnapshot[]
  readonly presence?: CollectionPresenceSnapshot
}

/**
 * 一次跨列拖拽可能同时涉及分组列表（已完成的年/月分组）和普通列表（进行中/
 * 待办）——按每张卡片自己是否挂在 `[data-layout-group]` 下分类，而不是用
 * 拖动起点单一决定整个事务的模式，否则目标列的普通卡片会被整批排除在
 * FLIP 之外，只有列容器的 resize 在动、卡片瞬间摆好位置，两者节奏脱节。
 */
function splitLayoutFlipParticipants(
  cards: readonly HTMLElement[],
  root: ParentNode,
  scopeSurfaces?: readonly HTMLElement[],
): { groups: HTMLElement[]; groupLeaves: HTMLElement[]; flatCards: HTMLElement[] } {
  const inScope = (element: HTMLElement): boolean => {
    if (!scopeSurfaces || scopeSurfaces.length === 0) return true
    return scopeSurfaces.some(surface => surface === element || surface.contains(element))
  }
  // 内容 wrapper（年/月 folder）虽然通常是组标题的兄弟节点，但它同样
  // 承担了这一组的流式位移和裁剪。若只捕获 data-layout-group，标题会做
  // FLIP 而 folder 直接跳到新位置，表现为标题与底部内容错位/提前被裁切。
  const groups = Array.from(root.querySelectorAll<HTMLElement>('[data-layout-group], [data-layout-content]')).filter(inScope)
  const groupLeaves: HTMLElement[] = []
  const flatCards: HTMLElement[] = []
  for (const card of cards) {
    if (!inScope(card)) continue
    if (card.closest('[data-layout-group]') !== null) groupLeaves.push(card)
    else flatCards.push(card)
  }
  return { groups, groupLeaves, flatCards }
}

/** 一份快照里按各自参与者的实际归属，分别捕获 Relative Group FLIP 和普通 FLIP。 */
export function captureLayoutFlip(
  cards: readonly HTMLElement[],
  root: ParentNode = document,
  includePresence = true,
  /**
   * 正在被 Runtime 接管（抓取中/落地中）的对象要从 collection 入场/离场
   * 判断里排除——整段生命周期都要排除，不能靠 dataset.runtimeActive 这类
   * 会在松手瞬间就被提前清掉的标记来判断（比落地动画结束早得多）。调用方
   * 在抓取→落地全程都拿得到确定的源节点引用，直接传进来最可靠。
   */
  presenceIgnore?: (element: HTMLElement) => boolean,
  options: { readonly scopeSurfaces?: readonly HTMLElement[] } = {},
): LayoutFlipSnapshot {
  // 新事务开始时先终止上一笔仍在运行的 Surface resize，避免旧 timeout
  // 在本事务中恢复过期高度。
  const inScope = (element: HTMLElement): boolean => {
    const surfaces = options.scopeSurfaces
    if (!surfaces || surfaces.length === 0) return true
    return surfaces.some(surface => surface === element || surface.contains(element))
  }
  const activeSurfaces = Array.from(root.querySelectorAll<HTMLElement>('[data-layout-surface]'))
    .filter(inScope)
    .map(element => ({ element, rect: readRect(element), inlineStyle: readSurfaceInlineStyle(element) }))
  resetActiveSurfaceResize(activeSurfaces)
  const measurement = createLayoutMeasurement()
  const { groups, groupLeaves, flatCards } = splitLayoutFlipParticipants(cards, root, options.scopeSurfaces)
  const surfaces = captureSurfaceLayout(Array.from(root.querySelectorAll<HTMLElement>('[data-layout-surface]')).filter(inScope), measurement)
  // 普通列表没有 collection presence 语义时不做全量卡片扫描和 cloneNode；
  // 完成列等需要感知 collection 迁移的业务通过 data-layout-collection
  // 显式开启。collection 通常标在列表容器上，卡片节点只标
  // data-layout-role="card"，不能要求两个属性出现在同一个节点上。
  const hasPresenceCollection = (options.scopeSurfaces ?? [root]).some(scope =>
    scope instanceof HTMLElement
      ? scope.matches('[data-layout-collection]') || scope.querySelector('[data-layout-collection]') !== null
      : root.querySelector('[data-layout-collection]') !== null,
  )
  const snapshot: LayoutFlipSnapshot = {
    root,
    group: groups.length > 0 ? { before: captureGroupLayout([...groups, ...groupLeaves], measurement) } : undefined,
    flat: flatCards.length > 0 ? { elements: flatCards, before: captureRects(flatCards, measurement) } : undefined,
    surfaces,
    presence: includePresence && hasPresenceCollection
      ? captureCollectionPresence(root, '[data-layout-role="card"]', undefined, presenceIgnore, options.scopeSurfaces, measurement)
      : undefined,
  }
  return mergePendingLayoutSnapshot(root, snapshot)
}

export function playLayoutFlip(snapshot: LayoutFlipSnapshot): void {
  const measurement = createLayoutMeasurement()
  const profile = resolveProfile()
  const groupClip = snapshot.group
    ? releaseGroupClip(snapshot.group.before)
    : null
  if (snapshot.group) playGroupFlip(snapshot.group.before, profile.flip.duration, profile.flip.easing, measurement)
  if (snapshot.flat) playFlip(snapshot.flat.elements, snapshot.flat.before, profile.flip.duration, profile.flip.easing, measurement)
  playSurfaceResize(snapshot.surfaces, profile.resize.duration, profile.resize.easing, measurement)
  if (snapshot.presence) playCollectionPresence(snapshot.presence, {
      duration: profile.flip.duration,
      easing: profile.flip.easing,
  }, measurement)
  if (groupClip) restoreGroupClip(groupClip, profile.flip.duration + 50)
}

interface GroupClipState {
  readonly token: string
  readonly entries: ReadonlyArray<{ element: HTMLElement; overflow: string }>
}

const groupClipStates = new WeakMap<ParentNode, GroupClipState>()
let groupClipSequence = 0

function releaseGroupClip(before: readonly GroupLayoutSnapshot[]): GroupClipState | null {
  const entries = before
    .filter(item => item.rect.height > 0)
    .map(item => ({ element: item.element, overflow: item.element.style.overflow }))
    .filter(item => item.element.isConnected)
    // 组展开/收起自身已经由 transitionGroupHeight 接管 overflow:hidden；
    // 这里不能覆盖它，否则收起时内容会直接消失而不是从底部向上收缩。
    .filter(item => item.element.dataset.runtimeGroupAnimating !== 'true')
    .filter(item => getComputedStyle(item.element).overflow !== 'visible')
  if (entries.length === 0) return null
  const root = entries[0].element.getRootNode() as ParentNode
  const previous = groupClipStates.get(root)
  previous?.entries.forEach(({ element, overflow }) => { element.style.overflow = overflow })
  entries.forEach(({ element }) => { element.style.overflow = 'visible' })
  const state = { token: String(++groupClipSequence), entries }
  groupClipStates.set(root, state)
  return state
}

function restoreGroupClip(state: GroupClipState, delay: number): void {
  const root = state.entries[0]?.element.getRootNode() as ParentNode | undefined
  if (!root) return
  window.setTimeout(() => {
    if (groupClipStates.get(root)?.token !== state.token) return
    state.entries.forEach(({ element, overflow }) => { element.style.overflow = overflow })
    groupClipStates.delete(root)
  }, delay)
}

/**
 * 把布局播放排到微任务里，同一 root 在这一批同步代码内出现新事务时，新
 * 事务会接管旧快照：抓起后立刻放下就不会先启动"收束"，再被第二笔 FLIP
 * 硬清空。
 *
 * 这里原来用的是 requestAnimationFrame，而不是 queueMicrotask——两者都能
 * 实现"合并同一批同步调用"这个效果，但 rAF 只保证"下一次绘制之前执行"，
 * 不保证"这一帧还没画完就执行"：如果 DOM 变化（松手、Vue 重渲染、兄弟卡
 * 让位）发生在一次不是由 rAF 驱动的事件（比如 pointerup）里，浏览器完全
 * 可能在当前任务结束后先画一帧——这时候 FLIP 的 Invert 步骤（读取"变化后"
 * 位置、写入反向 transform 把视觉冻结在"变化前"）还没执行，画出来的就是
 * "已经变化完、但动画还没开始"的最终布局，下一帧才突然摁回起点开始播放，
 * 表现为松手瞬间"闪一下排布好的最终布局，然后才回到起点做动画"。
 * queueMicrotask 保证在任何绘制之前执行，同时仍然能被同步执行的后续调用
 * 覆盖（微任务队列在当前同步代码跑完之后、下一次绘制之前统一清空），批量
 * 合并的效果不受影响。
 */
export function scheduleLayoutFlip(snapshot: LayoutFlipSnapshot): void {
  pendingLayoutFlips.set(snapshot.root, snapshot)
  queueMicrotask(() => {
    if (pendingLayoutFlips.get(snapshot.root) !== snapshot) return
    pendingLayoutFlips.delete(snapshot.root)
    playLayoutFlip(snapshot)
  })
}

/**
 * rAF 版调度：等下一帧、Vue patch 全部落地后再量布局执行 Invert。
 * 只用于"列尾追加"——此时目标列已有卡片无位移（没有 transform Invert），
 * 只有容器 resize + 被拖卡片滑入，rAF 不会产生闪现；而 rAF 保证量到的是
 * 最终布局（容器高度含新卡片），resize 冻结与播放同帧起步，不会顶动。
 * 中间插入/重排有卡片位移 FLIP（有 Invert），必须走 microtask 版
 * scheduleLayoutFlip，Invert 才能在 paint 前写入、不闪现。
 */
export function scheduleLayoutFlipOnRaf(snapshot: LayoutFlipSnapshot): void {
  pendingLayoutFlips.set(snapshot.root, snapshot)
  requestAnimationFrame(() => {
    if (pendingLayoutFlips.get(snapshot.root) !== snapshot) return
    pendingLayoutFlips.delete(snapshot.root)
    playLayoutFlip(snapshot)
  })
}

/**
 * 若上一笔事务还未进入播放帧，屏幕最后展示的仍是它的 before 布局。把该
 * before 继承给新事务，直接从旧视觉状态飞向最新布局，而非经过中间布局。
 */
function mergePendingLayoutSnapshot(root: ParentNode, next: LayoutFlipSnapshot): LayoutFlipSnapshot {
  const pending = pendingLayoutFlips.get(root)
  if (!pending) return next
  const surfaces = mergeSurfaceSnapshots(next.surfaces, pending.surfaces)
  const flat = mergeFlatSnapshot(next.flat, pending.flat)
  const group = mergeGroupSnapshot(next.group, pending.group)
  return { ...next, flat, group, surfaces }
}

function mergeFlatSnapshot(
  next: LayoutFlipSnapshot['flat'],
  pending: LayoutFlipSnapshot['flat'],
): LayoutFlipSnapshot['flat'] {
  if (!next || !pending) return next
  const before = new Map(next.before)
  for (const element of next.elements) {
    const rect = pending.before.get(element)
    if (rect) before.set(element, rect)
  }
  return { ...next, before }
}

function mergeGroupSnapshot(
  next: LayoutFlipSnapshot['group'],
  pending: LayoutFlipSnapshot['group'],
): LayoutFlipSnapshot['group'] {
  if (!next || !pending) return next
  const pendingRects = new Map(pending.before.map(item => [item.element, item.rect]))
  return { before: next.before.map(item => ({ ...item, rect: pendingRects.get(item.element) ?? item.rect })) }
}

function mergeSurfaceSnapshots(
  next: readonly SurfaceLayoutSnapshot[],
  pending: readonly SurfaceLayoutSnapshot[],
): SurfaceLayoutSnapshot[] {
  const pendingByElement = new Map(pending.map(item => [item.element, item]))
  return next.map(item => {
    const previous = pendingByElement.get(item.element)
    return previous ? { ...item, rect: previous.rect, inlineStyle: previous.inlineStyle } : item
  })
}

const pendingLayoutFlips = new WeakMap<ParentNode, LayoutFlipSnapshot>()

function readRect(element: HTMLElement, measurement?: LayoutMeasurement): GroupRect {
  const rect = measurement?.rect(element) ?? element.getBoundingClientRect()
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
}

export function captureGroupLayout(elements: readonly HTMLElement[], measurement?: LayoutMeasurement): GroupLayoutSnapshot[] {
  // display:none 的折叠子树没有有效的上一帧坐标；若把零矩形带进 FLIP，
  // 打开时会被误算成从视口左上角飞入。
  const visible = elements.filter(element => {
    const rect = measurement?.rect(element) ?? element.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0
  })
  const groupSet = new Set(visible)
  return visible.map(element => ({
    element,
    parent: findGroupParent(element, groupSet),
    rect: readRect(element, measurement),
  }))
}

function findGroupParent(element: HTMLElement, groupSet: ReadonlySet<HTMLElement>): HTMLElement | null {
  let parent = element.parentElement
  while (parent) {
    if (groupSet.has(parent)) return parent
    parent = parent.parentElement
  }
  return null
}

/**
 * Relative FLIP：节点（组或卡片叶）的屏幕位移减去直接父节点的屏幕位移，
 * 只播放它在父布局内真正产生的局部位移。父组 transform 会自然带动局部
 * 位移为 0 的子内容；同一月内卡片重排则会留下非零局部位移。
 */
export function playGroupFlip(before: readonly GroupLayoutSnapshot[], duration = FLIP_DURATION, easing = FLIP_EASING, measurement?: LayoutMeasurement): void {
  resetActiveFlip(before.map(item => item.element))
  const viewportDeltas = new Map<HTMLElement, { x: number; y: number }>()

  for (const item of before) {
    const next = readRect(item.element, measurement)
    viewportDeltas.set(item.element, {
      x: item.rect.left - next.left,
      y: item.rect.top - next.top,
    })
  }

  for (const item of before) {
    const delta = viewportDeltas.get(item.element)!
    const parentDelta = item.parent ? viewportDeltas.get(item.parent) : undefined
    const dx = delta.x - (parentDelta?.x ?? 0)
    const dy = delta.y - (parentDelta?.y ?? 0)
    if (
      item.element.dataset.runtimeProxy === 'true'
      || item.element.dataset.runtimePlaceholder === 'true'
      || item.element.dataset.runtimeActive === 'true'
      || (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5)
    ) {
      // resetActiveFlip 可能给这个元素设置了 transition: none，
      // 如果跳过 FLIP，需要清除以免永久锁定 transition。
      // 但组高度动画由 transitionGroupHeight 独立持有，不能在这里清掉。
      if (item.element.dataset.runtimeGroupAnimating !== 'true') {
        item.element.style.transition = ''
      }
      continue
    }
    item.element.style.transform = `translate(${dx}px, ${dy}px)`
    item.element.style.transition = 'none'
    const token = String(Number(item.element.dataset.runtimeFlipToken ?? '0') + 1)
    item.element.dataset.runtimeFlip = 'true'
    item.element.dataset.runtimeFlipToken = token
    requestAnimationFrame(() => {
      if (item.element.dataset.runtimeFlipToken !== token) return
      item.element.style.transition = `transform ${duration}ms ${easing}`
      item.element.style.transform = ''
    })
    window.setTimeout(() => {
      if (item.element.dataset.runtimeFlipToken !== token) return
      item.element.style.transition = ''
      item.element.style.transform = ''
      delete item.element.dataset.runtimeFlip
    }, duration + 40)
  }
}

export function transitionGroupHeight(element: HTMLElement, targetHeight: number, duration = FLIP_DURATION, easing = FLIP_EASING, fromHeight?: number): void {
  const currentHeight = fromHeight ?? element.getBoundingClientRect().height
  const heightToken = String(Number(element.dataset.runtimeGroupToken ?? '0') + 1)
  element.dataset.runtimeGroupToken = heightToken
  // 分组高度按位移决定时长：小月份保持轻快，大分组不会在缓出曲线前段
  // 一次性完成。duration 作为基准上限，保留最小值避免小组过快。
  const distance = Math.abs(Math.max(0, targetHeight) - currentHeight)
  const speed = 8
  const effectiveDuration = Math.min(Math.max(distance / speed, 200), 350)
  element.dataset.runtimeGroupAnimating = 'true'
  element.style.overflow = 'hidden'
  element.style.height = `${currentHeight}px`
  element.style.transition = `height ${effectiveDuration}ms ${easing}`
  // 与 Demo 的分组动画保持一致：先让起始高度提交到布局，再写目标高度，
  // 避免大内容组在同一帧被浏览器合并成一次性展开。
  void element.offsetHeight
  requestAnimationFrame(() => {
    element.style.height = `${Math.max(0, targetHeight)}px`
  })
  window.setTimeout(() => {
    if (element.dataset.runtimeGroupToken !== heightToken) return
    if (targetHeight <= 0) {
      element.style.height = '0px'
      element.style.overflow = 'hidden'
    } else {
      element.style.height = ''
      element.style.overflow = ''
    }
    element.style.transition = ''
    delete element.dataset.runtimeGroupAnimating
  }, effectiveDuration + 40)
}

export interface GroupToggleOptions {
  readonly root: ParentNode
  readonly content: HTMLElement
  readonly opening: boolean
  readonly mutate: () => void
  readonly waitForLayout: () => void | Promise<void>
  readonly isCurrent?: () => boolean
  readonly duration?: number
  readonly easing?: string
}

/** 统一编排组展开/收起及其兄弟 FLIP。 */
export async function runGroupToggle(options: GroupToggleOptions): Promise<void> {
  const token = (groupToggleTokens.get(options.content) ?? 0) + 1
  groupToggleTokens.set(options.content, token)
  const cardNodes = Array.from(options.root.querySelectorAll<HTMLElement>('.done-card-item'))
  const cards = (cardNodes.length > 0 ? cardNodes : Array.from(options.root.querySelectorAll<HTMLElement>('[data-card]')))
    .filter(element => {
      const rect = element.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0
    })
  const snapshot = captureLayoutFlip(cards, options.root, false)
  const currentHeight = options.content.getBoundingClientRect().height
  const presenceState = layoutPresenceEnabled
    ? prepareGroupPresence(options.content, options.opening, options.duration, options.easing)
    : null
  options.mutate()
  await options.waitForLayout()
  if (groupToggleTokens.get(options.content) !== token) return
  if (options.isCurrent && !options.isCurrent()) return
  transitionGroupHeight(options.content, options.opening ? options.content.scrollHeight : 0, options.duration, options.easing, currentHeight)
  if (presenceState) playGroupPresence(presenceState, options.opening)
  playLayoutFlip(snapshot)
}

interface GroupPresenceState { content: HTMLElement; elements: HTMLElement[]; token: string; duration: number }

function prepareGroupPresence(content: HTMLElement, opening: boolean, duration = FLIP_DURATION, easing = FLIP_EASING): GroupPresenceState {
  const elements = Array.from(content.querySelectorAll<HTMLElement>('.done-card-item'))
  const token = String(Number(content.dataset.runtimePresenceToken ?? '0') + 1)
  content.dataset.runtimePresenceToken = token
  elements.forEach(element => {
    if (opening) element.style.opacity = '0'
  })
  return { content, elements, token, duration }
}

function playGroupPresence(state: GroupPresenceState, opening: boolean): void {
  const { content, elements, token, duration } = state
  requestAnimationFrame(() => {
    if (content.dataset.runtimePresenceToken !== token) return
    elements.forEach(element => {
      element.animate(
        [{ opacity: opening ? 0 : 1 }, { opacity: opening ? 1 : 0 }],
        { duration, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' },
      )
    })
  })
  window.setTimeout(() => {
    if (content.dataset.runtimePresenceToken !== token) return
    elements.forEach(element => { element.style.opacity = '' })
  }, duration + 40)
}

/** 捕获会随卡片进出改变高度的 Surface；业务以 data-layout-surface 标注它们。 */
export function captureSurfaceLayout(elements: readonly HTMLElement[], measurement?: LayoutMeasurement): SurfaceLayoutSnapshot[] {
  return elements.map(element => ({
    element,
    rect: readRect(element, measurement),
    // 事务被打断时，当前 inline height 是 Runtime 上一笔动画写入的临时值，
    // 不能把它错当成业务样式保存，否则取消落点后会永久留下旧高度。
    inlineStyle: surfaceResizeStates.get(element)?.baseStyle ?? readSurfaceInlineStyle(element),
  }))
}

/**
 * Surface 的高度变化属于 resize，不是位移 FLIP。先冻结旧边框盒高度，再过渡到
 * 已经由业务渲染出的最终高度；内部组/卡片继续按自己的 Relative FLIP 运动。
 */
export function playSurfaceResize(
  before: readonly SurfaceLayoutSnapshot[],
  duration = FLIP_DURATION,
  easing = FLIP_EASING,
  measurement?: LayoutMeasurement,
): void {
  resetActiveSurfaceResize(before)
  const plans = before
    .filter(item => item.element.isConnected)
    .map(item => {
      const next = readRect(item.element, measurement)
      const prof = resolveProfile()
      return {
        item, next,
        profile: prof.resize,
        fromHeight: toCssHeight(item.element, item.rect.height),
        toHeight: toCssHeight(item.element, next.height),
      }
    })
    .filter(({ item, next }) => Math.abs(item.rect.height - next.height) >= 0.5)

  for (const { item, fromHeight } of plans) {
    const style = item.element.style
    const state = {
      baseStyle: surfaceResizeStates.get(item.element)?.baseStyle ?? item.inlineStyle,
      // 不能从 DOM dataset 递增：打断会清 dataset，旧 rAF 可能与新事务
      // 重新拿到相同 token，进而错误写入新高度。
      token: String(++surfaceResizeSequence),
    }
    surfaceResizeStates.set(item.element, state)
    style.overflow = 'hidden'
    style.transition = 'none'
    style.height = `${fromHeight}px`
    item.element.dataset.runtimeSurfaceResize = 'true'
    item.element.dataset.runtimeSurfaceResizeToken = state.token
  }

  requestAnimationFrame(() => {
    for (const { item, fromHeight, toHeight, profile } of plans) {
      const style = item.element.style
      const state = surfaceResizeStates.get(item.element)
      if (!state || item.element.dataset.runtimeSurfaceResizeToken !== state.token) continue
      const token = state.token
      style.transition = 'none'
      animateRafHeight(item.element, fromHeight, toHeight, profile.duration, profile.easing)
      window.setTimeout(() => {
        if (item.element.dataset.runtimeSurfaceResizeToken !== token) return
        const state = surfaceResizeStates.get(item.element)
        if (!state || state.token !== token) return
        restoreSurfaceInlineStyle(item.element, state.baseStyle)
        surfaceResizeStates.delete(item.element)
        delete item.element.dataset.runtimeSurfaceResize
      }, profile.duration + 40)
    }
  })
}

function resetActiveSurfaceResize(before: readonly SurfaceLayoutSnapshot[]): void {
  const active = before.filter(item => item.element.dataset.runtimeSurfaceResize === 'true')
  if (active.length === 0) return
  for (const { element } of active) {
    const state = surfaceResizeStates.get(element)
    if (!state) continue
    // 先恢复自然高度再测量新布局；删 token 让旧 timeout 不能覆盖新事务。
    cancelRafHeight(element)
    restoreSurfaceInlineStyle(element, state.baseStyle)
    surfaceResizeStates.delete(element)
    delete element.dataset.runtimeSurfaceResize
    delete element.dataset.runtimeSurfaceResizeToken
  }
}

type SurfaceInlineStyle = SurfaceLayoutSnapshot['inlineStyle']

interface SurfaceResizeState {
  readonly baseStyle: SurfaceInlineStyle
  readonly token: string
}

const surfaceResizeStates = new WeakMap<HTMLElement, SurfaceResizeState>()
let surfaceResizeSequence = 0

function readSurfaceInlineStyle(element: HTMLElement): SurfaceInlineStyle {
  return {
    height: element.style.height,
    overflow: element.style.overflow,
    transition: element.style.transition,
  }
}

function restoreSurfaceInlineStyle(element: HTMLElement, style: SurfaceInlineStyle): void {
  element.style.height = style.height
  element.style.overflow = style.overflow
  element.style.transition = style.transition
}

/** 将测量到的边框盒高度转换为当前 box-sizing 下可直接写入 style.height 的值。 */
function toCssHeight(element: HTMLElement, borderBoxHeight: number): number {
  const style = getComputedStyle(element)
  if (style.boxSizing === 'border-box') return borderBoxHeight
  const extras =
    Number.parseFloat(style.paddingTop)
    + Number.parseFloat(style.paddingBottom)
    + Number.parseFloat(style.borderTopWidth)
    + Number.parseFloat(style.borderBottomWidth)
  return Math.max(0, borderBoxHeight - extras)
}

export function captureScroll(container: HTMLElement): ScrollSnapshot {
  const max = Math.max(0, container.scrollHeight - container.clientHeight)
  const anchor = container.scrollTop <= 1 ? 'top' : (max - container.scrollTop <= 1 ? 'bottom' : 'middle')
  return { top: container.scrollTop, height: container.scrollHeight, clientHeight: container.clientHeight, anchor }
}

export function restoreScroll(container: HTMLElement, snapshot: ScrollSnapshot): void {
  const max = Math.max(0, container.scrollHeight - container.clientHeight)
  if (snapshot.anchor === 'top') container.scrollTop = 0
  else if (snapshot.anchor === 'bottom') container.scrollTop = max
  else container.scrollTop = Math.min(snapshot.top, max)
}
