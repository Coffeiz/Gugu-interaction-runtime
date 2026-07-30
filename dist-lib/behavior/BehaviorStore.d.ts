import { Behavior } from './Behavior';
export declare class BehaviorStore {
    private readonly items;
    register(behavior: Behavior): void;
    get(type: string): Behavior | undefined;
    has(type: string): boolean;
}
