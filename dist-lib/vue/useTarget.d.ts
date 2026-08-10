import { MaybeRefOrGetter, Ref } from 'vue';
export interface UseTargetOptions {
    id: string;
    surfaceId: MaybeRefOrGetter<string>;
    accepts: MaybeRefOrGetter<readonly string[]>;
    priority?: MaybeRefOrGetter<number | undefined>;
    resolve?: MaybeRefOrGetter<(() => unknown) | undefined>;
}
export interface UseTargetResult {
    elementRef: Ref<HTMLElement | null>;
    generation: number;
}
export declare function useTarget(options: UseTargetOptions): UseTargetResult;
