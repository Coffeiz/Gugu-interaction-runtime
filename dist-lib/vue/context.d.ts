import { InjectionKey } from 'vue';
import { Runtime } from '../Runtime';
export declare const runtimeInjectionKey: InjectionKey<Runtime>;
export declare function provideRuntime(runtime: Runtime): void;
export declare function useRuntime(): Runtime;
