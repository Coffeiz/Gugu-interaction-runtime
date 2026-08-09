import { Runtime } from '../Runtime';
import { RuntimeDomAdapter } from './dom';
/** React callback ref / effect 生命周期使用的 Runtime 绑定适配器。 */
export declare function createReactRuntimeAdapter(runtime: Runtime): RuntimeDomAdapter;
