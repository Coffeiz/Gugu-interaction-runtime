import { MaybeRefOrGetter, Ref } from 'vue';
import { Surface } from '../surface/Surface';
export interface UseSurfaceOptions {
    id: string;
    type: MaybeRefOrGetter<string>;
    accepts: MaybeRefOrGetter<readonly string[]>;
    layout: MaybeRefOrGetter<Surface['layout']>;
    camera?: MaybeRefOrGetter<Surface['camera']>;
    /** Surface 的滚动视口回调；它本身不能再作为 getter 被 toValue 解包。 */
    viewport?: (() => HTMLElement | null) | undefined;
    layoutElement?: (() => HTMLElement | null) | undefined;
    measureLayout?: (() => {
        width?: number;
        height: number;
    } | null) | undefined;
    motion?: MaybeRefOrGetter<Surface['motion'] | undefined>;
}
export interface UseSurfaceResult {
    elementRef: Ref<HTMLElement | null>;
    generation: number;
}
export declare function useSurface(options: UseSurfaceOptions): UseSurfaceResult;
