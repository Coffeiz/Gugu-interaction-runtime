import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'
import { resolve } from 'node:path'

/**
 * 库打包配置，跟 vite.config.ts（demo 应用构建）分开：demo 继续用默认配置
 * 产出可预览的静态站点，这份只负责把 src/index.ts 打成能被外部项目
 * import 的库，不混在一起。
 */
export default defineConfig({
  plugins: [
    vue(),
    dts({
      include: ['src'],
      exclude: ['src/demo/**', 'src/App.vue', 'src/main.ts', 'src/shims-vue.d.ts'],
      rollupTypes: false,
    }),
  ],
  build: {
    outDir: 'dist-lib',
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'GuguInteractionRuntime',
      fileName: 'index',
      formats: ['es'],
    },
    rollupOptions: {
      external: ['vue'],
      output: {
        globals: { vue: 'Vue' },
      },
    },
  },
})
