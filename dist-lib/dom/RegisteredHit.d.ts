import { ObjectStore } from '../object/ObjectStore';
import { Surface } from '../surface/Surface';
import { SurfaceStore } from '../surface/SurfaceStore';
import { HitResolver } from './Hit';
/**
 * 由 Runtime 已登记的 Object / Surface 构建默认命中器。
 *
 * 接入方只需交出真实元素；这里不依赖看板 demo 的 data-column / data-card 选择器。
 */
export declare function createRegisteredHitResolver(objects: ObjectStore, surfaces: SurfaceStore, objectId: string): HitResolver<Surface, HTMLElement>;
