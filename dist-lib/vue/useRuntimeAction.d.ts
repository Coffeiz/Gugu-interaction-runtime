import { Action } from '../action/Action';
export declare function useRuntimeAction(handler: (action: Action) => void | Promise<void>): void;
