import { Runtime } from '../Runtime';
import { RuntimeDomAdapter } from './dom';
/** Vue ref / nextTick 生命周期使用的 Runtime 绑定适配器。 */
export declare function createVueRuntimeAdapter(runtime: Runtime): RuntimeDomAdapter;
