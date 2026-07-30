import { Runtime } from '../../Runtime';
import { MoveBehaviorDriver, MoveVisualLifecycle } from '../../behavior/MoveBehavior';
export declare function createDetachMoveFromAdapter(config: {
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
