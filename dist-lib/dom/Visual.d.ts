import { VisualContext } from './VisualAdapterTypes';
import { MotionState } from '../motion/CardMotionController';
/**
 * 从元素捕获 CSS 继承属性上下文。
 * 用于在元素被移动到 overlay 等脱离原 DOM 树的位置时，
 * 保持文本渲染与原位置一致。
 */
export declare function captureInheritedStyleContext(element: HTMLElement): VisualContext;
/**
 * 将捕获的视觉上下文应用到目标元素。
 */
export declare function applyInheritedStyleContext(target: HTMLElement, context: VisualContext): void;
/**
 * 回归验证：检查 source → proxy 的视觉上下文一致性。
 * 返回不一致的属性列表，空数组表示全部一致。
 */
export declare function verifyVisualContextConsistency(source: HTMLElement, proxy: HTMLElement): string[];
export declare function setProxyInteractive(proxy: HTMLElement, enabled: boolean): void;
export interface ProxyVisualState {
    transform: string;
    boxShadow: string;
    opacity: string;
}
export declare function captureProxyVisualState(proxy: HTMLElement): ProxyVisualState;
export declare function restoreProxyVisualState(proxy: HTMLElement, state: ProxyVisualState): void;
/**
 * proxy：跟随指针的临时视觉对象，随 Session 创建/销毁，不属于 Vue 管理
 * 的真实 DOM——见 docs/DESIGN.md "Vue 创建真实 DOM，Runtime 创建临时 DOM"。
 */
export declare function createDragProxy(source: HTMLElement, rect?: DOMRect, options?: {
    glass?: boolean;
}): HTMLElement;
export declare function getProxyAttitude(proxy: HTMLElement): HTMLElement;
export declare function getProxyContent(proxy: HTMLElement): HTMLElement;
export declare function moveDragProxy(proxy: HTMLElement, x: number, y: number, offsetX: number, offsetY: number): void;
export interface LandingVisualOptions {
    duration?: number;
    easing?: string;
    targetShadow?: string;
    targetRadius?: string;
    targetBackground?: string;
    /** 目标背景图（渐变等）。backgroundColor 与 backgroundImage 分设，避免
     *  background 简写把渐变覆盖成透明。 */
    targetBackgroundImage?: string;
    targetOpacity?: string;
    /**
     * 落点内容本身会变化时用（比如落点比源多/少某个子元素——徽章、按钮这类
     * 真实 DOM 结构差异，不是纯样式差异，插值 background/box-shadow 这类
     * 数值属性解决不了）。传入落点真实渲染出的节点，这里会把代理现有内容
     * 包一层、克隆一份目标内容叠在上面，两层内容做 opacity 交叉淡变；
     * 位置/尺寸/容器级样式（背景、阴影等，见上面几个 target* 选项）仍由
     * 外层代理统一插值，两套机制独立生效、互不干扰。不传时完全不建这层，
     * 内容不变的场景维持原来更轻量的路径。
     */
    targetContent?: HTMLElement;
    /** retarget 执行时重新读取目标几何，避免使用布局变化前缓存的中间 rect。 */
    readTarget?: () => LandingRect;
    motionState?: Pick<MotionState, 'x' | 'y' | 'vx' | 'vy' | 'scaleX' | 'scaleY' | 'rotateX' | 'rotateZ'>;
    coast?: {
        duration: number;
        friction: number;
        maxDistance: number;
        minVelocity: number;
    };
    /** 有释放速度时降低位置阻尼，保留横向抛掷的越过感。 */
    releaseDamping?: number;
}
export type LandingRect = Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>;
/** 将 landing 目标限制在 Surface viewport 内，不等待滚动动画结束。 */
export declare function clampLandingRectToBounds(rect: LandingRect, bounds: DOMRect): LandingRect;
/**
 * 把代理从当前帧交接到最终目标。目标默认只提供一次几何快照——但调用方
 * 可以用返回值里的 retarget() 持续纠正：如果落地途中又有一次不相关的
 * 布局事务把目标的实际落点挪了（比如紧接着又落地了另一张卡，兄弟卡跟着
 * 重新排位），飞行终点会跟着更新，而不是飞向一个已经过期的坐标。不调用
 * retarget 的调用方行为不变，仍然是"一次性快照、不追踪"。
 */
/**
 * 兼容旧调用方的 landing 入口。动画时序统一转交 MotionController；
 * 下面的 legacy 实现仅保留作历史对照，不再被 Runtime 使用。
 */
export declare function landDragProxy(proxy: HTMLElement, target: LandingRect, options?: LandingVisualOptions): {
    finished: Promise<void>;
    retarget: (nextTarget: LandingRect) => void;
};
/** MotionController 可选关闭时使用的 CSS 过渡落地实现。 */
export declare function landDragProxyLegacy(proxy: HTMLElement, target: LandingRect, options?: LandingVisualOptions): {
    finished: Promise<void>;
    retarget: (nextTarget: LandingRect) => void;
};
/**
 * MotionController 驱动的 landing 版本。
 * DOM 视觉属性仍由本文件处理，控制器只负责连续的位置、尺寸和完成时机。
 */
export declare function landDragProxyWithMotion(proxy: HTMLElement, target: LandingRect, options?: LandingVisualOptions): {
    finished: Promise<void>;
    retarget: (nextTarget: LandingRect) => void;
};
export declare function destroyDragProxy(proxy: HTMLElement): void;
/** 清理 demo 中上一次异常中断留下的代理节点。 */
export declare function destroyAllDragProxies(): void;
export declare function destroyDragProxiesByCardId(cardId: string): void;
export declare function applyFloatingStyle(el: HTMLElement, rect: DOMRect): void;
export declare function getFloatingProxy(el: HTMLElement): HTMLElement | undefined;
export declare function moveFloating(el: HTMLElement, x: number, y: number, offsetX: number, offsetY: number): void;
export declare function clearFloatingStyle(el: HTMLElement): void;
/**
 * 松手后本体虽然已经被 Vue/Teleport 插回真实列表 DOM，但只要还是
 * applyFloatingStyle 设的 position:fixed，就不占父级正常布局的空间——
 * 兄弟卡 FLIP、容器高度动画这类"量一下最终布局有多高"的计算，测到的
 * 还是"这张卡不存在"的旧高度，跟真实卡数对不上。不能直接调用完整的
 * clearFloatingStyle 提前复位：那样本体会立刻跳回正常位置可见，抢在
 * 落地代理（接管视觉的那个临时对象）还没接管完成前露出来，表现为闪一下。
 * 这里只解除影响布局的几个属性，同时用 visibility:hidden 保持不可见——
 * 布局计算立刻能测到正确高度，视觉上依旧交给落地代理，等真正落地完成
 * 再由 clearFloatingStyle 整体恢复。
 */
export declare function settleFloatingLayout(el: HTMLElement): void;
export declare function setDefaultDraggingGlassEnabled(enabled: boolean): void;
export declare function isDefaultDraggingGlassEnabled(): boolean;
export declare function applyDraggingGlassStyle(element: HTMLElement): void;
/**
 * 隐藏目标元素并登记 visibility ownership。
 * 只有登记的 owner 才能通过 revealElement() 恢复可见性。
 */
export declare function concealElement(el: HTMLElement, ownerId: string): void;
/**
 * 恢复元素的可见性。只有当前 owner 才能恢复，非 owner 调用无效果。
 * 返回是否实际执行了恢复操作。
 */
export declare function revealElement(el: HTMLElement, ownerId: string): boolean;
/**
 * 解除 visibility ownership（不修改元素可见性）。
 * 用于 regrab 场景：旧 session 的 dispose 异步触发时检查 owner 不匹配，
 * 跳过 visibility 恢复。
 */
export declare function releaseVisibilityOwnership(el: HTMLElement, ownerId: string): void;
export declare function createDragPlaceholder(source: HTMLElement, rect: DOMRect): HTMLElement;
export declare function destroyDragPlaceholder(placeholder: HTMLElement): void;
