import type { Behavior } from './Behavior'

export class BehaviorStore {
  private readonly items = new Map<string, Behavior>()

  register(behavior: Behavior): void {
    if (this.items.has(behavior.type)) throw new Error(`Behavior already exists: ${behavior.type}`)
    this.items.set(behavior.type, behavior)
  }

  get(type: string): Behavior | undefined {
    return this.items.get(type)
  }

  has(type: string): boolean {
    return this.items.has(type)
  }
}
