import { VisualAdapter } from './VisualAdapter';
import { Runtime } from '../Runtime';
import { DragProxyLayoutConfig } from './Visual';
/** 将主代理的 compact 布局契约复用到多选 modifier。 */
export declare function applyGroupModifierLayout(element: HTMLElement, compact: DragProxyLayoutConfig['compact'] | undefined): void;
/**
 * Runtime 默认的多对象叠卡视觉。
 *
 * 这层只处理 DOM 代理、修饰卡和源节点的视觉交接，不读取业务字段，
 * 因此可以被文件、看板或其他对象类型复用。业务若需要特殊卡片内容，
 * 可以传入自己的 GroupVisualAdapter 替换默认实现。
 */
export declare function createGroupVisualAdapter(runtime: Runtime, base?: VisualAdapter): VisualAdapter;
