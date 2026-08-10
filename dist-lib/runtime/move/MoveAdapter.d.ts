import { Runtime } from '../../Runtime';
import { MoveBehaviorDriver, MoveVisualLifecycle } from '../../behavior/MoveBehavior';
export declare function createDetachMoveFromAdapter(config: {
    runtime: Runtime;
    objectId: string;
    element: HTMLElement;
    event: PointerEvent;
    fromRect?: DOMRect;
    returnRect?: DOMRect;
    /** clone 保留源节点的布局占位，并用独立代理跟手。 */
    clone?: boolean;
}): {
    driver: MoveBehaviorDriver;
    lifecycle: MoveVisualLifecycle;
};
/** Runtime 内建 clone 策略；生命周期与 detach 共用，差异只在抓取阶段的占位语义。 */
export declare function createCloneMoveFromAdapter(config: {
    runtime: Runtime;
    objectId: string;
    element: HTMLElement;
    event: PointerEvent;
    fromRect?: DOMRect;
    returnRect?: DOMRect;
}): {
    driver: MoveBehaviorDriver;
    lifecycle: MoveVisualLifecycle;
};
