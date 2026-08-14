import { MaybeRefOrGetter, Ref } from 'vue';
import { Surface } from '../surface/Surface';
import { FloatingSurfaceOptions } from './floatingSurface';
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
    /** 启用约定式浮动 Surface DOM 自动发现。 */
    floating?: MaybeRefOrGetter<boolean | FloatingSurfaceOptions>;
}
export interface UseSurfaceResult {
    elementRef: Ref<HTMLElement | null>;
    generation: number;
    isAnimating: Readonly<Ref<boolean>>;
}
export declare function useSurface(options: UseSurfaceOptions): UseSurfaceResult;
