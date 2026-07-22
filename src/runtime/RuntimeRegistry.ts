import { VisualAdapters, type VisualAdapter } from '../dom/VisualAdapter'
import type { MoveVisualStrategy } from '../behavior/MoveBehavior'
import type { ObjectTypeRegistration } from '../Runtime'

/** Runtime 的注册状态；不参与 Session 或视觉生命周期。 */
export class RuntimeRegistry {
  readonly visuals = new VisualAdapters()
  readonly objectTypes = new Map<string, ObjectTypeRegistration>()
  readonly visualStrategies = new Map<string, MoveVisualStrategy>()

  registerVisualAdapter(type: string, adapter: VisualAdapter): void {
    this.visuals.register(type, adapter)
  }

  registerVisualStrategy(type: string, strategy: MoveVisualStrategy): void {
    this.visualStrategies.set(type, strategy)
  }

  registerObjectType(type: string, registration: ObjectTypeRegistration): void {
    this.objectTypes.set(type, registration)
    if (registration.visual) this.visuals.register(type, registration.visual)
  }
}
