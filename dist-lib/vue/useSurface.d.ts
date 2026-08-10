import { MaybeRefOrGetter, Ref } from 'vue';
import { Surface } from '../surface/Surface';
export interface UseSurfaceOptions {
    id: string;
    type: MaybeRefOrGetter<string>;
    accepts: MaybeRefOrGetter<readonly string[]>;
    viewport?: MaybeRefOrGetter<(() => HTMLElement | null) | undefined>;
    motion?: MaybeRefOrGetter<Surface['motion'] | undefined>;
}
export interface UseSurfaceResult {
    elementRef: Ref<HTMLElement | null>;
    generation: number;
}
export declare function useSurface(options: UseSurfaceOptions): UseSurfaceResult;
