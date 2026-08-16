import { MaybeRefOrGetter, Ref } from 'vue';
import { TargetItem } from '../target/Target';
import { NodeConfig } from '../node/Node';
export type ObjectTargetOptions = Omit<TargetItem, 'id' | 'element' | 'generation'> & {
    id?: string;
    element?: HTMLElement | null;
};
export interface UseObjectOptions {
    id: string;
    type: MaybeRefOrGetter<string>;
    surface: MaybeRefOrGetter<string>;
    abilities: MaybeRefOrGetter<readonly string[]>;
    selected?: MaybeRefOrGetter<boolean>;
    visual?: MaybeRefOrGetter<string | undefined>;
    visualMode?: MaybeRefOrGetter<string | undefined>;
    target?: MaybeRefOrGetter<ObjectTargetOptions | undefined>;
    node?: MaybeRefOrGetter<NodeConfig | undefined>;
}
export interface UseObjectResult {
    elementRef: Ref<HTMLElement | null>;
    generation: number;
    /** 清理当前对象与目标对象之间的 Runtime 连接；关系数据仍由业务层删除。 */
    disconnectFrom: (targetObjectId: string) => number;
}
export declare function useObject(options: UseObjectOptions): UseObjectResult;
