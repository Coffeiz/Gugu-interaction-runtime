import { Owner, Lease } from './owner/Owner';
import { Session } from './session/Session';
import { ObjectStore } from './object/ObjectStore';
import { SurfaceStore } from './surface/SurfaceStore';
import { RuntimeInput, SessionHandle, StartRequest } from './core/Interaction';
import { Behavior } from './behavior/Behavior';
import { BehaviorStore } from './behavior/BehaviorStore';
import { MoveBehaviorDriver, MoveContext, MoveVisualLifecycle, MoveVisualStrategy } from './behavior/MoveBehavior';
import { VisualAdapter, VisualLifecycleContext, VisualProxy } from './dom/VisualAdapter';
import { VisualState } from './dom/VisualAdapterTypes';
import { MotionProfile } from './dom/MotionProfile';
import { MotionControllerConfig } from './motion/MotionProfile';
import { HitResolver, HitResult } from './dom/Hit';
import { Surface } from './surface/Surface';
import { LandingTargetTrackerOptions } from './dom/LandingTargetTracker';
import { PointerSessionInputOptions } from './input/PointerSessionInput';
import { Action } from './action/Action';
import { RuntimeRegistry } from './runtime/RuntimeRegistry';
export type RuntimeEvent = {
    type: 'object-added' | 'object-removed' | 'object-changed';
    id: string;
} | {
    type: 'surface-added' | 'surface-removed' | 'surface-changed';
    id: string;
} | {
    type: 'ownership-changed';
    id: string;
};
export type RuntimeLandingTargetOptions = Omit<LandingTargetTrackerOptions, 'cleanup' | 'target' | 'retarget'>;
export interface OrchestrateMoveSessionOptions {
    /** 跟手阶段的行为驱动。 */
    driver?: MoveBehaviorDriver;
    /** 落地/揭示阶段的视觉生命周期。 */
    lifecycle?: MoveVisualLifecycle;
    /** 可选的对象视觉策略；未传时按对象类型从 Runtime 注册表解析。 */
    visualStrategy?: MoveVisualStrategy;
    /** PointerSessionInput 选项。 */
    pointerInput?: PointerSessionInputOptions;
    /**
     * 已存在的 sessionId。传入时跳过 start()，直接绑定到已有 session。
     * 用于 demo 等需要在 start() 和 wiring 之间做初始化的场景。
     */
    sessionId?: string;
    /**
     * 跟手定位的目标元素。设置后 MoveBehavior.update() 会自动更新该元素的
     * left/top 实现跟手。业务层无需手动设置 moveContext.followElement。
     */
    followElement?: HTMLElement | null;
}
export interface MoveSessionHandle extends SessionHandle {
    /** 当前 session 的 MoveContext。 */
    readonly moveContext: MoveContext;
    /** 解绑 pointer 输入并清理。 */
    dispose(): void;
}
export interface ObjectTypeRegistration {
    defaultVisualMode: string;
    /** 类型级视觉适配器；每个对象只复用这一份适配器定义。 */
    visual?: ObjectVisualAdapter;
    /** 运动实现与参数；默认启用 Runtime MotionController。 */
    motion?: {
        enabled?: boolean;
        profile?: MotionProfile;
    };
    /** 兼容旧 demo 的手动启动入口。 */
    start?(context: {
        objectId: string;
        element: HTMLElement;
        event: PointerEvent;
        mode: string;
    }): void;
    /** 新入口：Runtime 根据适配器自动创建并编排一次 Move Session。 */
    createMove?(context: {
        objectId: string;
        element: HTMLElement;
        event: PointerEvent;
        mode: string;
        fromRect?: DOMRect;
    }): {
        request?: StartRequest;
        driver?: MoveBehaviorDriver;
        lifecycle?: MoveVisualLifecycle;
        pointerInput?: PointerSessionInputOptions;
    };
}
export interface ObjectVisualAdapter extends VisualAdapter {
    createMove?(context: {
        objectId: string;
        element: HTMLElement;
        event: PointerEvent;
        mode: string;
        fromRect?: DOMRect;
    }): {
        request?: StartRequest;
        driver?: MoveBehaviorDriver;
        lifecycle?: MoveVisualLifecycle;
        pointerInput?: PointerSessionInputOptions;
    };
}
export interface RuntimeCompletionGate<T> {
    readonly promise: Promise<T>;
    complete(value: T): void;
    fail(reason?: string): void;
}
export interface RegrabContext {
    readonly sessionId: string;
    readonly objectId: string;
    readonly event: PointerEvent;
    readonly proxyElement: HTMLElement;
    readonly sourceElement: HTMLElement;
    readonly proxyRect: DOMRect;
    interrupt(reason?: string): void;
}
export declare class Runtime {
    readonly owner: Owner;
    readonly objects: ObjectStore;
    readonly surfaces: SurfaceStore;
    readonly behaviors: BehaviorStore;
    readonly registry: RuntimeRegistry;
    /** 兼容现有调用方；新的注册逻辑统一落在 registry。 */
    get visuals(): import('.').VisualAdapters;
    private readonly moveBehavior;
    private hitResolver;
    private readonly sessionCoordinator;
    private readonly runtimeSession;
    private readonly events;
    private readonly actions;
    private readonly inputCoordinator;
    private readonly visualProxyCoordinator;
    private readonly dispatcher;
    private readonly moveActions;
    private readonly runtimeMove;
    private readonly moveCommit;
    private readonly moveLanding;
    private readonly visualState;
    private readonly visualMotion;
    constructor();
    registerVisualAdapter(type: string, adapter: VisualAdapter): void;
    registerVisualStrategy(type: string, strategy: MoveVisualStrategy): void;
    registerObjectType(type: string, registration: ObjectTypeRegistration): void;
    registerSurface(surface: import('./surface/Surface').Surface): void;
    configureMotion(config: {
        profile?: import('./dom/MotionProfile').MotionProfile;
        controller?: MotionControllerConfig;
    } & import('./dom/MotionProfile').MotionProfile): void;
    getMotionProfile(): import('./dom/MotionProfile').MotionProfile | null;
    startObjectPointer(objectId: string, element: HTMLElement, event: PointerEvent, fromRect?: DOMRect, returnRect?: DOMRect): boolean;
    bindObjectPointer(objectId: string, element: HTMLElement): () => void;
    private syncObjectPointerBinding;
    private defaultVisualAdapter;
    getVisualAdapter(type: string): VisualAdapter;
    getObjectVisualAdapter(objectId: string): VisualAdapter;
    createVisualLifecycleContext(sessionId: string, destination?: unknown, targetElement?: HTMLElement, beforeContent?: HTMLElement): VisualLifecycleContext;
    /** 由注册的 VisualAdapter 创建并登记当前 session 的唯一视觉代理。 */
    createVisualProxy(sessionId: string, context: VisualLifecycleContext): VisualProxy | undefined;
    /** 调用当前对象适配器的 landing，并保证无代理时也有确定结果。 */
    landVisualProxy(sessionId: string, target: HTMLElement, context?: VisualLifecycleContext): Promise<{
        completed: boolean;
        reason?: string;
    }>;
    /** 将跟手或重定位更新转发给当前 session 的视觉适配器。 */
    updateVisualProxy(sessionId: string, context?: VisualLifecycleContext): void;
    /** 通过对象 VisualAdapter 解析最终揭示目标，并过滤已断开的节点。 */
    resolveVisualTarget(sessionId: string, destination: unknown): HTMLElement | null;
    /** 将对象的生命周期视觉状态交给其适配器写入。 */
    applyVisualState(objectId: string, element: HTMLElement, state: VisualState): void;
    /** 获取对象当前视觉快照；未覆盖时使用默认 DOM 样式快照。 */
    captureVisualState(objectId: string, element: HTMLElement): import('.').VisualSnapshot;
    /** 调用当前对象适配器的 reveal；交接只允许由 Runtime 触发。 */
    revealVisualProxy(sessionId: string, target: HTMLElement, context?: VisualLifecycleContext): Promise<void>;
    registerVisualProxy(sessionId: string, proxy: VisualProxy): void;
    getVisualProxy(sessionId: string): VisualProxy | undefined;
    disposeVisualProxy(sessionId: string): void;
    createCompletionGate<T>(sessionId: string, failureValue: T): RuntimeCompletionGate<T>;
    setHitResolver(resolver: HitResolver | null): void;
    getHitResolver(): HitResolver | null;
    /** 默认命中由已注册 Object/Surface 推导；特殊几何才需 setHitResolver()。 */
    createRegisteredHitResolver(objectId: string): HitResolver<Surface, HTMLElement>;
    /** 将自定义或注册表默认命中统一归一成业务无关的 Surface id 与插入索引。 */
    resolveMoveHit(objectId: string, x: number, y: number): HitResult | null;
    /** 自动滚动只需要当前命中 Surface 的真实滚动元素。 */
    resolveMoveSurfaceElement(objectId: string, x: number, y: number): HTMLElement | null;
    /** 取得指定 Surface 的滚动视口，不让视觉 driver 探查业务 DOM 结构。 */
    resolveMoveSurfaceViewport(surfaceId: string): HTMLElement | null;
    /** 已注册对象按屏幕布局排序后的索引，不依赖业务 DOM 的 data 属性。 */
    getObjectSurfaceIndex(objectId: string, surfaceId?: string): number;
    subscribe(listener: (event: RuntimeEvent) => void): () => void;
    onAction(listener: (action: Action) => void | Promise<void>): () => void;
    emitAction(action: Action): void;
    snapshot(): {
        objects: import('./object/ObjectItem').ObjectItem[];
        surfaces: Surface[];
    };
    registerBehavior(behavior: Behavior): void;
    setMoveDriver(driver: MoveBehaviorDriver): void;
    bindMoveSession(sessionId: string, driver: MoveBehaviorDriver): void;
    bindMoveLifecycle(sessionId: string, lifecycle: MoveVisualLifecycle): void;
    getMoveContext(sessionId: string): MoveContext;
    resolveMoveTarget(sessionId: string, destination: unknown, fallback?: () => HTMLElement | null): HTMLElement | null;
    /**
     * 等待 Action 引起的业务 DOM 重渲染并取得落地目标。
     *
     * 跨 Surface 时框架通常会先更新对象所属 Surface，再在随后一两帧销毁旧
     * 组件、登记新组件。不能把仍是源节点的 hidden element 当成 target；同
     * Surface 放回则允许复用原业务节点。业务 adapter 不需要自行轮询 DOM。
     */
    waitForMoveTarget(sessionId: string, destination: unknown, maxFrames?: number): Promise<HTMLElement | null>;
    private getDestinationSurfaceId;
    registerRegrab(objectId: string, handler: (event: PointerEvent) => void): void;
    getRegrab(objectId: string): ((event: PointerEvent) => void) | undefined;
    regrab(objectId: string, event: PointerEvent): boolean;
    clearRegrab(objectId: string, handler?: (event: PointerEvent) => void): void;
    /** 将落地代理的 regrab 监听与当前 Session 清理绑定。 */
    bindRegrabTarget(sessionId: string, objectId: string, target: HTMLElement, handler: (event: PointerEvent) => void): void;
    createRegrabContext(sessionId: string, event: PointerEvent, proxyElement: HTMLElement, sourceElement: HTMLElement): RegrabContext | null;
    /**
     * 绑定 active 阶段的全局 pointer 输入。pointerup 会先立即解绑监听器，再把
     * release 交回 Runtime；cancel/interrupt 时由 Session Cleanup 兜底。
     */
    bindPointerSessionInput(sessionId: string, options?: PointerSessionInputOptions): () => void;
    /**
     * landing 期间追踪真实目标及其祖先的布局变化，并自动登记到 Session Cleanup。
     */
    trackLandingTarget(sessionId: string, target: HTMLElement, retarget: (rect: DOMRect) => void, options?: RuntimeLandingTargetOptions): () => void;
    start(request: StartRequest): SessionHandle;
    private startInternal;
    /**
     * 编排一次完整的 move Session：start → bind driver → bind lifecycle →
     * bind pointer input，一步到位。
     *
     * 调用方只需提供 driver（跟手阶段的行为）和 lifecycle（落地/揭示阶段的
     * 视觉逻辑），不需要手动调用 bindMoveSession/bindMoveLifecycle/
     * bindPointerSessionInput。
     *
     * 返回的 handle 包含 session id、moveContext、state 以及 dispose() 方法。
     */
    orchestrateMoveSession(request: StartRequest, options?: OrchestrateMoveSessionOptions): MoveSessionHandle;
    update(sessionId: string, input: RuntimeInput): void;
    private updateInternal;
    release(sessionId: string, input: RuntimeInput): Promise<void>;
    private releaseInternal;
    cancel(sessionId: string, reason?: string): void;
    private cancelInternal;
    interrupt(sessionId: string, reason?: string): void;
    private interruptInternal;
    startSession(type: string, objectId?: string): Session;
    getSession(id: string): Session | undefined;
    takeSurface(sessionId: string, surfaceId: string): boolean;
    /** 获取需要在 landing 前提前释放的对象 Lease（例如 detach 本体）。 */
    acquireObject(sessionId: string, objectId: string): Lease | null;
    /** 将 Surface placeholder 的销毁纳入当前移动事务清理。 */
    trackPlaceholder(sessionId: string, dispose: () => void): void;
    takeSurfaces(sessionId: string, surfaceIds: readonly string[]): boolean;
    endSession(session: Session): void;
    private failCompletionGates;
    private disposeBehavior;
    private createBehaviorContext;
}
export declare const runtime: Runtime;
