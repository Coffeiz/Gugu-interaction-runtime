import { TargetItem } from '../target/Target';
import { Runtime } from '../Runtime';
export interface RuntimeDomAdapter {
    bindObject(id: string, element: HTMLElement | null): void;
    bindSurface(id: string, element: HTMLElement | null): void;
    bindTarget(key: string, target: Omit<TargetItem, 'id' | 'element'> & {
        id?: string;
        element?: HTMLElement | null;
    }, element: HTMLElement | null): void;
    getSurfaceElement(id: string): HTMLElement | null;
    runLayoutMutation(options: {
        elements: readonly HTMLElement[];
        root: ParentNode;
        mutate: () => void | Promise<void>;
        waitForPatch?: () => void | Promise<void>;
    }): Promise<void>;
    dispose(): void;
}
/**
 * 共享 DOM 生命周期实现。Vue/React 适配器只负责暴露各自框架习惯的入口，
 * 不重复实现 Runtime 注册表、拖拽或布局算法。
 */
export declare function createDomRuntimeAdapter(runtime: Runtime): RuntimeDomAdapter;
