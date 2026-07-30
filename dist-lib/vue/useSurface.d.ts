import { Ref } from 'vue';
export interface UseSurfaceOptions {
    id: string;
    type: string;
    /** 接受哪些 object type；空数组表示不限制。 */
    accepts: string[];
    /** Surface resize 运动参数。未设置时使用 DEFAULT_MOTION_PROFILE。 */
    motion?: {
        resize?: {
            duration: number;
            easing: string;
        };
    };
}
export interface UseSurfaceResult {
    elementRef: Ref<HTMLElement | null>;
}
export declare function useSurface(options: UseSurfaceOptions): UseSurfaceResult;
