export type LayoutParticipantMode = 'move' | 'removal'

export interface LayoutParticipantFocus {
  readonly sourceElement: HTMLElement
  readonly sourceContainer?: HTMLElement | null
  readonly layoutKey?: string
  readonly mode: LayoutParticipantMode
}

export interface LayoutParticipantPlan {
  readonly eligible: ReadonlySet<HTMLElement>
  readonly focusTarget: HTMLElement | null
  readonly rangeSkipped: number
  readonly inheritedSkipped: number
  readonly offscreenSkipped: number
}

function escapeSelectorValue(value: string): string {
  const css = globalThis.CSS
  if (css?.escape) return css.escape(value)
  return value.replace(/([\\"'\[\]#.>:~+*^$|=(), ])/g, '\\$1')
}

function inScope(element: HTMLElement, scopeSurfaces?: readonly HTMLElement[]): boolean {
  if (!scopeSurfaces || scopeSurfaces.length === 0) return true
  return scopeSurfaces.some(surface => surface === element || surface.contains(element))
}

export function findLayoutScopeSurface(
  element: HTMLElement,
  scopeSurfaces?: readonly HTMLElement[],
): HTMLElement | null {
  if (!scopeSurfaces || scopeSurfaces.length === 0) return null
  return scopeSurfaces.find(surface => surface === element || surface.contains(element)) ?? null
}

function nearestCollection(element: HTMLElement): HTMLElement | null {
  return element.closest<HTMLElement>('[data-layout-collection]')
}

function nearestContent(element: HTMLElement): HTMLElement | null {
  return element.closest<HTMLElement>('[data-layout-content]')
}

function isFollowing(reference: HTMLElement, candidate: HTMLElement): boolean {
  return Boolean(reference.compareDocumentPosition(candidate) & Node.DOCUMENT_POSITION_FOLLOWING)
}

/**
 * Capture-time source suffix. This is cheap (DOM-order only; no geometry reads) and protects
 * clone/custom modes where committing a move can still remove the source node from its old
 * list. Later groups are intentionally not included: their own group container participates in
 * Relative FLIP, so their leaves do not need a second transform.
 */
export function captureSourceAffectedCards(
  cards: readonly HTMLElement[],
  sourceElement: HTMLElement,
): ReadonlySet<HTMLElement> {
  const parent = sourceElement.parentElement
  if (!parent) return new Set()
  const affected = new Set<HTMLElement>()
  for (const card of cards) {
    if (card.parentElement !== parent) continue
    if (isFollowing(sourceElement, card)) affected.add(card)
  }
  return affected
}

/**
 * Resolve the semantic object at its post-mutation location. Cross-Surface Vue trees may mount
 * a different DOM node for the same object, so data-layout-key is the identity; same-node
 * reorders naturally fall back to sourceElement.
 */
export function resolveLayoutFocusTarget(
  root: ParentNode,
  focus: LayoutParticipantFocus | undefined,
  scopeSurfaces?: readonly HTMLElement[],
): HTMLElement | null {
  if (!focus) return null
  if (focus.mode === 'removal') {
    return focus.sourceElement.isConnected && inScope(focus.sourceElement, scopeSurfaces)
      ? focus.sourceElement
      : null
  }
  const key = focus.layoutKey
  if (key && typeof root.querySelectorAll === 'function') {
    const selector = `[data-layout-key="${escapeSelectorValue(key)}"]`
    const candidates = Array.from(root.querySelectorAll<HTMLElement>(selector))
      .filter(element => element.isConnected && inScope(element, scopeSurfaces))
      .filter(element => element.dataset.runtimeProxy !== 'true'
        && element.dataset.runtimePlaceholder !== 'true')
    const replacement = candidates.find(element => element !== focus.sourceElement)
    if (replacement) return replacement
    if (candidates.includes(focus.sourceElement)) return focus.sourceElement
  }
  return focus.sourceElement.isConnected && inScope(focus.sourceElement, scopeSurfaces)
    ? focus.sourceElement
    : null
}

/**
 * Participant reduction after the business DOM mutation:
 * - same-container detach release uses the destination suffix. The release capture already sees
 *   the source vacated from layout, so restoring/inserting the source moves every card after the
 *   final insertion point; oldSuffix XOR newSuffix would incorrectly discard the exact cards
 *   that need to animate when the source returns to its original Surface/index.
 * - cross-container moves retain source suffix plus destination suffix;
 * - card leaves in sibling data-layout-content groups are inherited by their group container;
 * - cards outside the viewport+overscan eligibility set are allowed to jump to final layout.
 *
 * Ambiguous DOM structures deliberately fall back to keeping the card. Correctness wins over
 * reduction whenever Runtime cannot prove that a leaf is unaffected or parent-owned.
 */
export function buildLayoutParticipantPlan(args: {
  readonly cards: readonly HTMLElement[]
  readonly root: ParentNode
  readonly focus?: LayoutParticipantFocus
  readonly scopeSurfaces?: readonly HTMLElement[]
  readonly sourceAffected?: ReadonlySet<HTMLElement>
  readonly viewportEligible?: ReadonlySet<HTMLElement>
}): LayoutParticipantPlan {
  const sourceAffected = args.sourceAffected ?? new Set<HTMLElement>()
  const viewportEligible = args.viewportEligible
  const focusTarget = resolveLayoutFocusTarget(args.root, args.focus, args.scopeSurfaces)
  const eligible = new Set<HTMLElement>()
  let rangeSkipped = 0
  let inheritedSkipped = 0
  let offscreenSkipped = 0

  const targetSurface = focusTarget
    ? findLayoutScopeSurface(focusTarget, args.scopeSurfaces)
    : null
  const sourceSurface = args.focus
    ? findLayoutScopeSurface(args.focus.sourceElement, args.scopeSurfaces)
    : null
  const targetContent = focusTarget ? nearestContent(focusTarget) : null
  const targetCollection = focusTarget ? nearestCollection(focusTarget) : null
  let capturedSourceContainer = args.focus?.sourceContainer ?? null
  if (!capturedSourceContainer) {
    for (const card of sourceAffected) {
      capturedSourceContainer = card.parentElement
      break
    }
  }
  const sameContainerReorder = Boolean(
    focusTarget
    && capturedSourceContainer
    && focusTarget.parentElement === capturedSourceContainer,
  )

  for (const card of args.cards) {
    let keep = true
    let inherited = false

    if (args.focus?.mode === 'removal') {
      keep = sourceAffected.has(card)
    } else if (focusTarget) {
      const cardSurface = findLayoutScopeSurface(card, args.scopeSurfaces)
      if (sameContainerReorder && card.parentElement === focusTarget.parentElement) {
        // Release capture happens after detach pickup removed the source from layout. From that
        // visual baseline, inserting/restoring it affects the final destination suffix, even
        // when the semantic object returns to exactly the same index. Using XOR here produced
        // an empty participant set for that case and made siblings snap to their final rects.
        keep = isFollowing(focusTarget, card)
      } else if (sourceAffected.has(card)) {
        keep = true
      } else if (targetSurface && cardSurface && cardSurface !== targetSurface) {
        keep = !(sourceSurface && cardSurface === sourceSurface)
      } else if (!targetSurface || !cardSurface || cardSurface === targetSurface) {
        const cardContent = nearestContent(card)
        const cardCollection = nearestCollection(card)
        if (targetContent && cardContent && cardContent !== targetContent
          && targetCollection && cardCollection === targetCollection) {
          keep = false
          inherited = true
        } else if (card.parentElement === focusTarget.parentElement) {
          keep = isFollowing(focusTarget, card)
        } else if (targetContent && cardContent === targetContent) {
          keep = isFollowing(focusTarget, card)
        }
      }
    }

    if (!keep) {
      if (inherited) inheritedSkipped += 1
      else rangeSkipped += 1
      continue
    }
    if (viewportEligible && !viewportEligible.has(card)) {
      offscreenSkipped += 1
      continue
    }
    eligible.add(card)
  }

  return { eligible, focusTarget, rangeSkipped, inheritedSkipped, offscreenSkipped }
}

export interface ViewportRectLike {
  readonly top: number
  readonly left: number
  readonly width: number
  readonly height: number
}

export function isRectWithinViewportOverscan(
  rect: ViewportRectLike,
  viewport: ViewportRectLike,
  overscanPx = Math.max(240, viewport.height),
): boolean {
  const rectRight = rect.left + rect.width
  const rectBottom = rect.top + rect.height
  const viewportRight = viewport.left + viewport.width
  const viewportBottom = viewport.top + viewport.height
  return rectRight >= viewport.left - overscanPx
    && rect.left <= viewportRight + overscanPx
    && rectBottom >= viewport.top - overscanPx
    && rect.top <= viewportBottom + overscanPx
}
