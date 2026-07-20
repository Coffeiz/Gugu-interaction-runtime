import { createApp } from 'vue'
import App from './App.vue'
import { getActiveCleanupCount } from './cleanup/Cleanup'
import { runtime } from './Runtime'
import './demo/proxyTypography.css'

createApp(App).mount('#app')

// 仅供 demo/手测排查用：在控制台里看当前还有多少个 Session 没清理干净的
// 监听器/RAF、ObjectStore/SurfaceStore 里实际登记了什么——验收标准里
// "dispose 之后确实清空"就是靠这个数字，而不是肉眼确认。生产代码不会
// 引入这类全局挂载。
if (import.meta.env.DEV) {
  ;(window as unknown as { __runtimeDebug: unknown }).__runtimeDebug = {
    getActiveCleanupCount,
    getObject: (id: string) => runtime.objects.get(id),
    getSurface: (id: string) => runtime.surfaces.get(id),
  }
}
