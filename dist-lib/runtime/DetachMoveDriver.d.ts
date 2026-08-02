import { captureLayoutFlip } from '../dom/GroupLayout';
import { LandingResult, MoveContext } from '../behavior/MoveBehavior';
import { VisualSnapshot, VisualState } from '../dom/VisualAdapterTypes';
import { GrabAlignConfig } from '../Runtime';
export declare function captureDetachDraggingSnapshot(capture: (objectId: string, element: HTMLElement) => VisualSnapshot, objectId: string, element: HTMLElement): VisualSnapshot;
/**
 * 抓取点默认取卡片几何中心，不管实际点在卡片哪个位置——对应咕咕旧版
 * （main 分支 usePhysicsDrag.ts）的 centerGrab:true：卡片水平/垂直中心
 * 始终跟指针对齐，不是"点哪抓哪"。按 grabAlign.align 也可以切回
 * 'pointer'（保留点击位置在卡片里的相对偏移），再叠加 offsetX/offsetY
 * 做额外的固定偏移（比如往下偏几 px，做出"被拎着"的悬垂感）。
 * regrab（fromRect 有值）时用当时飞行中代理的 rect 重新量一次，保持
 * 抓取点在卡片里的相对位置不因为落地途中尺寸变化（缩放）而跑偏。
 */
export declare function prepareDetachMotion(context: MoveContext, element: HTMLElement, event: PointerEvent, fromRect?: DOMRect, grabAlign?: GrabAlignConfig): {
    rect: DOMRect;
    offsetX: number;
    offsetY: number;
};
export declare function applyDetachPickupVisual(applyState: (objectId: string, element: HTMLElement, state: VisualState) => void, objectId: string, element: HTMLElement, rect: DOMRect, fromRect?: DOMRect): void;
export interface DetachPickupPreparation {
    readonly beforeContent: HTMLElement;
    readonly beforePickup: ReturnType<typeof captureLayoutFlip>;
}
export declare function prepareDetachPickup(sourceElement: HTMLElement, registeredElements: () => HTMLElement[], scopeSurfaces?: () => readonly HTMLElement[]): DetachPickupPreparation;
export declare function createDetachDropState<TDrop>(initialSurface: string | undefined, resolve: (event: PointerEvent) => TDrop | null, same: (drop: TDrop, previous: TDrop | null) => boolean): {
    update(event: PointerEvent, getSurface: (drop: TDrop) => string): TDrop | null;
    release(): TDrop | null;
    readonly currentSurface: string | undefined;
};
export declare function updateDetachDrop<TDrop>(args: {
    active: boolean;
    event: PointerEvent;
    state: ReturnType<typeof createDetachDropState<TDrop>>;
    resolve: (event: PointerEvent) => TDrop | null;
    getSurface: (drop: TDrop) => string;
}): TDrop | null;
export declare function interruptDetachRegrab(args: {
    event: PointerEvent;
    proxy: HTMLElement;
    source: HTMLElement;
    sessionId: string;
    interrupt: () => void;
    clearRegrab: () => void;
}): void;
export declare function cancelDetachWithoutDrop(args: {
    source: HTMLElement;
    registeredElements: () => HTMLElement[];
    cancel: () => void;
    releaseObject: () => void;
    clearFloating: (element: HTMLElement) => void;
    clearActive: () => void;
}): void;
export declare function prepareDetachLanding(args: {
    source: HTMLElement;
    settle: (element: HTMLElement) => void;
    clearActive: () => void;
    releaseObject: () => void;
}): DOMRect;
export declare function scheduleDetachLandingFrame(clearFloating: () => void, callback: () => void): () => void;
export declare function resolveDetachLandingTarget<TDestination>(args: {
    resolve: () => HTMLElement | null;
    applyState: (element: HTMLElement) => void;
}): HTMLElement | null;
export declare function captureDetachTargetSnapshot(capture: (element: HTMLElement) => VisualSnapshot, element: HTMLElement): VisualSnapshot;
export declare function createDetachVisualContext<TContext extends object>(args: {
    createContext: () => TContext;
    source: HTMLElement;
    sourceRect: DOMRect;
    visualSnapshot: VisualSnapshot;
    targetSnapshot: VisualSnapshot;
    motionState?: {
        x: number;
        y: number;
        vx: number;
        vy: number;
        scaleX: number;
        scaleY: number;
        rotateX: number;
        rotateZ: number;
    };
}): TContext & {
    sourceElement: HTMLElement;
    sourceRect: DOMRect;
    visualSnapshot: VisualSnapshot;
    targetSnapshot: VisualSnapshot;
};
export declare function startDetachLandingVisual(args: {
    createProxy: () => {
        element: HTMLElement;
    } | null;
    enableProxy: (element: HTMLElement) => void;
    bindRegrab: (element: HTMLElement) => void;
    land: (element: HTMLElement) => Promise<LandingResult>;
    onMissing: () => void;
    onComplete: (result: LandingResult) => void;
}): HTMLElement | null;
export declare function completeDetachLanding(args: {
    active: boolean;
    result: LandingResult;
    complete: (result: LandingResult) => void;
    reveal: () => void;
}): void;
export declare function resolveDetachRegrabTarget(resolve: () => HTMLElement | null, fallback: () => HTMLElement | null): HTMLElement | null;
export declare function createDetachLandingLifecycle<TGate extends {
    promise: Promise<LandingResult>;
}>(args: {
    createGate: () => TGate;
    onGate: (gate: TGate) => void;
    clearDragging: () => void;
    scheduleLanding: () => void;
    clearRegrab: () => void;
    finishReveal: () => void;
}): {
    landing: () => Promise<LandingResult>;
    reveal: () => void;
};
export declare function createDetachLayoutLifecycle(sourceEl: HTMLElement, registeredElements: () => HTMLElement[], scopeSurfaces?: () => readonly HTMLElement[]): {
    capture: () => import('..').LayoutFlipSnapshot;
    play: (_context: unknown, snapshot: unknown, useRaf?: boolean) => void;
};
