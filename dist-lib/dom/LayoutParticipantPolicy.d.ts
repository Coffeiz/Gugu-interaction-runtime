export type LayoutParticipantMode = 'move' | 'removal';
export interface LayoutParticipantFocus {
    readonly sourceElement: HTMLElement;
    readonly layoutKey?: string;
    readonly mode: LayoutParticipantMode;
}
export interface LayoutParticipantPlan {
    readonly eligible: ReadonlySet<HTMLElement>;
    readonly rangeSkipped: number;
    readonly inheritedSkipped: number;
    readonly offscreenSkipped: number;
}
export declare function findLayoutScopeSurface(element: HTMLElement, scopeSurfaces?: readonly HTMLElement[]): HTMLElement | null;
/**
 * Capture-time source suffix. This is cheap (DOM-order only; no geometry reads) and protects
 * clone/custom modes where committing a move can still remove the source node from its old
 * list. Later groups are intentionally not included: their own group container participates in
 * Relative FLIP, so their leaves do not need a second transform.
 */
export declare function captureSourceAffectedCards(cards: readonly HTMLElement[], sourceElement: HTMLElement): ReadonlySet<HTMLElement>;
/**
 * Resolve the semantic object at its post-mutation location. Cross-Surface Vue trees may mount
 * a different DOM node for the same object, so data-layout-key is the identity; same-node
 * reorders naturally fall back to sourceElement.
 */
export declare function resolveLayoutFocusTarget(root: ParentNode, focus: LayoutParticipantFocus | undefined, scopeSurfaces?: readonly HTMLElement[]): HTMLElement | null;
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
export declare function buildLayoutParticipantPlan(args: {
    readonly cards: readonly HTMLElement[];
    readonly root: ParentNode;
    readonly focus?: LayoutParticipantFocus;
    readonly scopeSurfaces?: readonly HTMLElement[];
    readonly sourceAffected?: ReadonlySet<HTMLElement>;
    readonly viewportEligible?: ReadonlySet<HTMLElement>;
}): LayoutParticipantPlan;
export interface ViewportRectLike {
    readonly top: number;
    readonly left: number;
    readonly width: number;
    readonly height: number;
}
export declare function isRectWithinViewportOverscan(rect: ViewportRectLike, viewport: ViewportRectLike, overscanPx?: number): boolean;
