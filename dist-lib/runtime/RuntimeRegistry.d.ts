import { VisualAdapters, VisualAdapter } from '../dom/VisualAdapter';
import { MoveVisualStrategy } from '../behavior/MoveBehavior';
import { ObjectTypeRegistration } from '../Runtime';
import { MotionProfile } from '../dom/MotionProfile';
import { MotionControllerConfig } from '../motion/MotionProfile';
/** Runtime 的注册状态；不参与 Session 或视觉生命周期。 */
export declare class RuntimeRegistry {
    readonly visuals: VisualAdapters;
    readonly objectTypes: Map<string, ObjectTypeRegistration>;
    readonly visualStrategies: Map<string, import('..').MoveVisualLifecycle>;
    motionProfile: MotionProfile | null;
    motionController: MotionControllerConfig;
    registerVisualAdapter(type: string, adapter: VisualAdapter): void;
    registerVisualStrategy(type: string, strategy: MoveVisualStrategy): void;
    registerObjectType(type: string, registration: ObjectTypeRegistration): void;
    setMotionProfile(profile: MotionProfile): void;
    setMotionController(config: MotionControllerConfig): void;
}
