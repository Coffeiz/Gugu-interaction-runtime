import { ObjectStore } from '../object/ObjectStore';
import { Surface } from '../surface/Surface';
import { SurfaceStore } from '../surface/SurfaceStore';
import { TargetStore } from '../target/TargetStore';
import { HitResolver } from './Hit';
/**
 * 由 Runtime 已登记的 Object / Surface 构建默认命中器。
 *
 * 接入方只需交出真实元素；这里不依赖看板 demo 的 data-column / data-card 选择器。
 *
 * findSurface/findIndex 都先把候选元素的 rect 一次性量好缓存下来，过滤/排序/遍历
 * 都只读这份缓存——sort 的比较器会被调用 O(n log n) 次，如果每次都现测
 * getBoundingClientRect，同一个元素在一次命中判定里会被反复强制布局，
 * pointermove 密集触发时测出来是实打实的卡顿（见 dragging jank 排查记录）。
 */
export declare function createRegisteredHitResolver(objects: ObjectStore, surfaces: SurfaceStore, targets: TargetStore, objectId: string): HitResolver<Surface, HTMLElement>;
