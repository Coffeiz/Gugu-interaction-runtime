import { VisualAdapter, VisualLifecycleContext, VisualProxy } from '../dom/VisualAdapter';
import { VisualState } from '../dom/VisualAdapterTypes';
import { LandingTargetTrackerOptions } from '../dom/LandingTargetTracker';
import { Cleanup } from '../cleanup/Cleanup';
import { Session } from '../session/Session';
import { LandingRect } from '../dom/Visual';
export interface VisualStatePort {
    getAdapter(objectId: string): VisualAdapter;
}
export declare class VisualStateCoordinator {
    private readonly port;
    constructor(port: VisualStatePort);
    resolveTarget(objectId: string, destination: unknown): HTMLElement | null;
    apply(objectId: string, element: HTMLElement, state: VisualState): void;
    capture(objectId: string, element: HTMLElement): import('..').VisualSnapshot;
    trackTarget(cleanup: Cleanup, target: HTMLElement, retarget: (rect: DOMRect) => void, options?: Omit<LandingTargetTrackerOptions, 'cleanup' | 'target' | 'retarget'>): () => void;
}
export declare class VisualProxyCoordinator {
    private readonly proxies;
    register(sessionId: string, proxy: VisualProxy): void;
    get(sessionId: string): VisualProxy | undefined;
    remove(sessionId: string): VisualProxy | undefined;
}
export interface VisualMotionPort {
    getSession(id: string): Session | undefined;
    getAdapter(objectId: string): VisualAdapter;
    getGroupAdapter?(objectId: string): VisualAdapter | undefined;
    createContext(id: string, destination?: unknown, target?: HTMLElement | LandingRect): VisualLifecycleContext;
}
export declare class VisualMotionCoordinator {
    private readonly port;
    private readonly proxies;
    constructor(port: VisualMotionPort, proxies: VisualProxyCoordinator);
    private getAdapter;
    create(sessionId: string, context: VisualLifecycleContext): VisualProxy | undefined;
    land(sessionId: string, target: HTMLElement | LandingRect, context?: VisualLifecycleContext): Promise<{
        completed: boolean;
        reason?: string;
    }>;
    update(sessionId: string, context?: VisualLifecycleContext): void;
    reveal(sessionId: string, target: HTMLElement, context?: VisualLifecycleContext): Promise<void>;
}
