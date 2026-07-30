import { VisualState, VisualSnapshot } from './VisualAdapterTypes';
import { MotionProfile } from './MotionProfile';
import { MotionState } from '../motion/CardMotionController';
import { Runtime } from '../Runtime';
export interface VisualLifecycleContext {
    readonly objectId: string;
    readonly sessionId: string;
    readonly mode: string;
    readonly destination?: unknown;
    readonly sourceElement?: HTMLElement;
    /** 抓取开始时冻结的内容快照；仅供视觉代理使用，不承载业务状态。 */
    readonly beforeContent?: HTMLElement;
    readonly targetElement?: HTMLElement;
    readonly sourceRect?: DOMRect;
    readonly visualSnapshot?: VisualSnapshot;
    readonly targetSnapshot?: VisualSnapshot;
    /** 对象类型注册的 MotionProfile；adapter 可用此覆盖 landing 速度。 */
    readonly motion?: MotionProfile;
    /** 是否由 Runtime 内置 MotionController 驱动 landing；默认开启。 */
    readonly motionEnabled?: boolean;
    /** grabbing 结束时冻结的运动状态，用于 landing 继承释放速度。 */
    readonly motionState?: Pick<MotionState, 'x' | 'y' | 'vx' | 'vy' | 'scaleX' | 'scaleY' | 'rotateX' | 'rotateZ' | 'rotateVX' | 'rotateVZ'>;
}
export interface VisualProxy {
    readonly element: HTMLElement;
    dispose?(): void;
}
/** 业务可选覆盖的视觉适配器；未提供的方法由 Runtime 默认实现补齐。 */
export interface VisualAdapter {
    resolveSource?(objectId: string): HTMLElement | null;
    resolveTarget?(objectId: string, destination: unknown): HTMLElement | null;
    captureVisualState?(element: HTMLElement): VisualSnapshot;
    applyState?(element: HTMLElement, state: VisualState): void;
    createProxy?(context: VisualLifecycleContext): VisualProxy;
    updateProxy?(proxy: VisualProxy, context: VisualLifecycleContext): void;
    land?(proxy: VisualProxy, target: HTMLElement, context: VisualLifecycleContext): void | Promise<{
        completed: boolean;
        reason?: string;
    }>;
    reveal?(proxy: VisualProxy, target: HTMLElement, context: VisualLifecycleContext): void | Promise<void>;
    dispose?(proxy: VisualProxy, context: VisualLifecycleContext): void;
}
export interface VisualAdapterRegistry {
    register(type: string, adapter: VisualAdapter): void;
    get(type: string): VisualAdapter | undefined;
    remove(type: string): void;
}
export declare class DefaultVisualAdapter implements VisualAdapter {
    private runtime?;
    constructor(runtime?: Runtime);
    /** 设置/更新 runtime 引用（在 registerObjectType 时自动设置） */
    setRuntime(runtime: Runtime): void;
    resolveSource(objectId: string): HTMLElement | null;
    resolveTarget(objectId: string): HTMLElement | null;
    captureVisualState(element: HTMLElement): VisualSnapshot;
    applyState(element: HTMLElement, state: VisualState): void;
    createProxy(context: VisualLifecycleContext): VisualProxy;
    land(proxy: VisualProxy, target: HTMLElement, context: VisualLifecycleContext): Promise<{
        completed: boolean;
        reason?: string;
    }>;
    reveal(_proxy: VisualProxy, target: HTMLElement, context: VisualLifecycleContext): void;
    dispose(proxy: VisualProxy, context: VisualLifecycleContext): void;
    /** 创建 detach 拖拽 move，从 Runtime 注册表自动获取 surface 信息 */
    createMove(context: {
        objectId: string;
        element: HTMLElement;
        event: PointerEvent;
        fromRect?: DOMRect;
        returnRect?: DOMRect;
    }): any;
}
export declare class VisualAdapters implements VisualAdapterRegistry {
    private readonly adapters;
    register(type: string, adapter: VisualAdapter): void;
    get(type: string): VisualAdapter | undefined;
    remove(type: string): void;
}
