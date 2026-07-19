import { createApp } from 'vue'
import App from './App.vue'
import { getActiveCleanupCount } from './cleanup/Cleanup'

createApp(App).mount('#app')

// 仅供 demo/手测排查用：在控制台里看当前还有多少个 Session 没清理干净的
// 监听器/RAF——验收标准里"dispose 之后确实清空"就是靠这个数字，而不是
// 肉眼确认。生产代码不会引入这类全局挂载。
if (import.meta.env.DEV) {
  ;(window as unknown as { __runtimeDebug: unknown }).__runtimeDebug = { getActiveCleanupCount }
}
