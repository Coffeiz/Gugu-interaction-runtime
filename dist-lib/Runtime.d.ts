import { Lease } from './owner/Owner';
import { Session } from './session/Session';
import { GroupDragSession, GroupObjectOffset } from './session/GroupDragSession';
import { ObjectStore } from './object/ObjectStore';
import { SurfaceStore } from './surface/SurfaceStore';
import { TargetStore } from './target/TargetStore';
import { RuntimeInput, SessionHandle, StartRequest } from './core/Interaction';
import { Behavior } from './behavior/Behavior';
import { BehaviorStore } from './behavior/BehaviorStore';
import { MoveBehaviorDriver, MoveContext, MoveVisualLifecycle, MoveVisualStrategy } from './behavior/MoveBehavior';
import { VisualAdapter, VisualLifecycleContext, VisualProxy } from './dom/VisualAdapter';
import { VisualState } from './dom/VisualAdapterTypes';
import { MotionProfile } from './dom/MotionProfile';
import { GroupDragConfig } from './dom/GroupDragProfile';
import { DragProxyLayoutConfig } from './dom/Visual';
import { MotionControllerConfig } from './motion/MotionProfile';
import { HitResolver, HitResult } from './dom/Hit';
import { Surface } from './surface/Surface';
import { LandingTargetTrackerOptions } from './dom/LandingTargetTracker';
import { PointerSessionInputOptions } from './input/PointerSessionInput';
import { Action } from './action/Action';
import { RuntimeRegistry } from './runtime/RuntimeRegistry';
import { LayoutFlipSnapshot } from './dom/GroupLayout';
import { AutoScrollController, AutoScrollOptions } from './dom/AutoScroll';
export type RuntimeEvent = {
    type: 'object-added' | 'object-removed' | 'object-changed';
    id: string;
} | {
    type: 'surface-added' | 'surface-removed' | 'surface-changed';
    id: string;
} | {
    type: 'target-added' | 'target-removed' | 'target-changed';
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
    /** 已创建的 GroupDragSession 需要先执行 MoveBehavior.prepare。 */
    prepareExisting?: boolean;
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
/** 抓取时卡片跟指针的对齐方式，按对象类型注册（见 ObjectTypeRegistration.grabAlign）。 */
export interface GrabAlignConfig {
    /**
     * 基准对齐方式：
     * - 'center'（默认）：卡片几何中心对指针，不管实际点在卡片哪个位置。
     * - 'pointer'：保留实际点击位置在卡片里的相对偏移，点哪抓哪。
     */
    align?: 'center' | 'pointer';
    /** 在基准对齐结果上再叠加的水平偏移(px)，正值往右；默认 0。 */
    offsetX?: number;
    /** 在基准对齐结果上再叠加的垂直偏移(px)，正值往下；默认 0。 */
    offsetY?: number;
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
    /** landing 的终态表现；default 保持看板行为，target 到达语义目标后缩小淡出。 */
    landingMode?: 'default' | 'target';
    /** target landing 时是否跳过"代理套上目标背景/圆角/内容"的视觉 morph，只保留位置和
     * 缩小淡出。目标和源对象内部结构差异较大（不同组件、不同子节点布局）时，内容 morph 会
     * 插值出不对齐的中间态，看起来像"代理直接变成了目标"而不是"飞向目标后消失"；只有源和
     * 目标共用同一套内部结构（如 demo 的 file-item/folder-item）时 morph 才会平滑。默认
     * false（保留 morph，兼容原行为）。 */
    disableTargetVisualMorph?: boolean;
    /** 抓取对齐方式；不传就是纯几何中心对齐（等价于 { align: 'center' }）。 */
    grabAlign?: GrabAlignConfig;
    /** 抓取代理的可选紧凑布局；Runtime 负责尺寸和位置过渡。 */
    proxyLayout?: DragProxyLayoutConfig;
    /** 多选拖拽的叠牌与 modifier 淡出配置；未设置时使用 Runtime 默认值。 */
    groupDrag?: GroupDragConfig;
    /** 类型级 pointer 输入配置；业务无需自行绑定 pointer listener。 */
    pointerInput?: PointerSessionInputOptions;
    /** 可选业务目标解析；返回空时继续使用 Runtime 的注册 Surface 命中。 */
    resolveMoveHit?(context: {
        objectId: string;
        x: number;
        y: number;
    }): HitResult | null;
    /** 可选落地目标解析，用于目标不是被移动对象自身的场景。 */
    resolveMoveTarget?(context: {
        objectId: string;
        destination: unknown;
    }): HTMLElement | null;
    /** 可选视觉落点解析；目标可以是文件夹卡、面包屑等语义接收节点。 */
    resolveMoveLandingTarget?(context: {
        objectId: string;
        destination: unknown;
    }): HTMLElement | null;
    /** 落地代理飞向业务目标时是否保留目标节点可见。 */
    preserveMoveTarget?: boolean;
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
    /** 代理当前屏幕位置配合真实节点的未变换布局尺寸，供新 session 接管。 */
    readonly regrabRect: DOMRect;
    interrupt(reason?: string): void;
}
export declare class Runtime {
    private readonly owner;
    readonly objects: ObjectStore;
    readonly surfaces: SurfaceStore;
    readonly targets: TargetStore;
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
    private readonly surfaceScrollFrames;
    constructor();
    registerVisualAdapter(type: string, adapter: VisualAdapter): void;
    registerVisualStrategy(type: string, strategy: MoveVisualStrategy): void;
    /** 查询某个 Object/Surface 当前是否由 Runtime 接管视觉状态。 */
    isControlled(id: string): boolean;
    /** 订阅 Runtime 接管权变化，供框架层刷新 DOM 编排状态。 */
    onOwnershipChange(listener: (id: string) => void): () => void;
    registerObjectType(type: string, registration: ObjectTypeRegistration): void;
    private syncObjectTarget;
    configureMotion(config: {
        profile?: import('./dom/MotionProfile').MotionProfile;
        controller?: MotionControllerConfig;
    } & import('./dom/MotionProfile').MotionProfile): void;
    /** 配置 Runtime 默认代理视觉；业务也可以完全关闭并由 VisualAdapter 自行绘制。 */
    configureVisual(config: {
        dragGlass?: boolean;
        layoutPresence?: boolean;
    }): void;
    getMotionProfile(): import('./dom/MotionProfile').MotionProfile | null;
    startObjectPointer(objectId: string, element: HTMLElement, event: PointerEvent, fromRect?: DOMRect, returnRect?: DOMRect): boolean;
    /**
     * 以一个主卡启动多对象移动。主卡仍复用单卡 MoveBehavior，GroupDragSession
     * 负责其余对象的 ownership 和批量 Action；视觉适配器可以据 objectIds 创建
     * 主代理及修饰代理。
     */
    startGroupObjectPointer(objectIds: readonly string[], primaryObjectId: string, element: HTMLElement, event: PointerEvent, fromRect?: DOMRect, returnRect?: DOMRect): boolean;
    private startObjectPointerInSession;
    bindObjectPointer(objectId: string, element: HTMLElement): () => void;
    private syncObjectPointerBinding;
    private defaultVisualAdapter;
    getVisualAdapter(type: string): VisualAdapter;
    /** 按对象类型读取抓取对齐配置；未注册的类型返回 undefined，调用方按纯居中兜底。 */
    getObjectGrabAlign(objectId: string): GrabAlignConfig | undefined;
    /** 按对象注册解析抓取代理布局，供 detach 浮动入口与生命周期入口共用。 */
    getObjectProxyLayout(objectId: string, sourceElement?: HTMLElement): DragProxyLayoutConfig | undefined;
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
    /** 创建绑定当前 Session 的自动滚动控制器；滚动资源随 Session 自动清理。 */
    createAutoScroller(sessionId: string, options?: AutoScrollOptions): AutoScrollController | null;
    /**
     * 将落地目标滚动到注册 Surface 的可视范围内。
     *
     * 松手后的滚动由 Runtime 用 rAF 驱动，时长跟 landing 基准时长一致，
     * 不再交给浏览器的原生 smooth scroll。这样代理从松手立即开始飞行时，
     * 容器滚动不会比代理慢一大截，避免代理先完成并被销毁而容器仍在滚动。
     */
    keepSurfaceTargetVisible(surfaceId: string, target: HTMLElement): void;
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
    /** 由 Runtime 统一捕获当前移动事务的布局快照。 */
    captureMoveLayout(sessionId: string): void;
    /** 由 Runtime 统一播放移动事务的布局 FLIP。 */
    playMoveLayout(sessionId: string, useRaf?: boolean): void;
    /** 捕获 Runtime 管理的 Surface / group / collection 布局快照。 */
    captureLayout(elements: readonly HTMLElement[], root?: ParentNode, includePresence?: boolean, ignore?: (element: HTMLElement) => boolean): LayoutFlipSnapshot;
    /** 按统一时序播放布局快照；列尾追加可选择等待 Vue patch 的下一帧。 */
    scheduleLayout(snapshot: LayoutFlipSnapshot, useRaf?: boolean): void;
    /** 统一编排组展开/收起、容器 resize、兄弟 FLIP 与可选 presence。 */
    runGroupToggle(options: import('./dom/GroupLayout').GroupToggleOptions): Promise<void>;
    /** 组件卸载/弹窗关闭时取消根节点下尚未完成的布局动画。 */
    cancelLayoutAnimations(root: ParentNode): void;
    resolveMoveTarget(sessionId: string, destination: unknown, fallback?: () => HTMLElement | null): HTMLElement | null;
    resolveMoveLandingTarget(sessionId: string, destination: unknown, fallback?: () => HTMLElement | null): HTMLElement | null;
    /**
     * 统一取得 landing 交接目标：先尝试当前帧的同步目标，再等待业务 Action
     * 触发的 DOM 重渲染。视觉 adapter 不需要再组合这两个阶段，也不会各自
     * 实现一套跨 Surface 的等待规则。
     */
    resolveLandingTarget(sessionId: string, destination: unknown, maxFrames?: number): Promise<HTMLElement | null>;
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
     * 统一完成 landing → regrab 的旧 Session 接管。视觉 adapter 只处理
     * source 可见性和监听器，旧 Session、completion gate 与 landing proxy
     * 的失效由 Runtime 保证。
     */
    takeoverRegrab(sessionId: string): boolean;
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
    startGroupSession(objectIds: readonly string[], primaryObjectId: string, options?: {
        type?: string;
        offsets?: ReadonlyMap<string, GroupObjectOffset>;
    }): GroupDragSession;
    getSession(id: string): Session | undefined;
    /** 返回多对象会话的公开元数据，供视觉层决定源节点占位策略。 */
    getGroup(sessionId: string): {
        primaryObjectId: string;
        objectIds: readonly string[];
    } | undefined;
    takeSurface(sessionId: string, surfaceId: string): boolean;
    /** 获取需要在 landing 前提前释放的对象 Lease（例如 detach 本体）。 */
    acquireObject(sessionId: string, objectId: string): Lease | null;
    /**
     * 组件因业务重排卸载时延迟注销对象。
     *
     * 跨 Surface 移动会先触发业务状态更新，再触发 landing；Vue 组件可能在
     * landing 解析前卸载。如果对象仍被当前 session 持有，必须把注销推迟到
     * session cleanup，并由 generation 防止新实例接管后被旧实例误删。
     */
    unregisterObjectWhenIdle(objectId: string, generation: number): void;
    /** 将 Surface placeholder 的销毁纳入当前移动事务清理。 */
    trackPlaceholder(sessionId: string, dispose: () => void): void;
    takeSurfaces(sessionId: string, surfaceIds: readonly string[]): boolean;
    endSession(session: Session): void;
    private failCompletionGates;
    private disposeBehavior;
    private createBehaviorContext;
}
export declare const runtime: Runtime;
