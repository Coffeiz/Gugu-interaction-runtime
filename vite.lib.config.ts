import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'
import { resolve } from 'node:path'

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
      entry: {
        'index': resolve(__dirname, 'src/index.ts'),
        'vue/useSurface': resolve(__dirname, 'src/vue/useSurface.ts'),
        'vue/useObject': resolve(__dirname, 'src/vue/useObject.ts'),
        'vue/useRuntimeTransition': resolve(__dirname, 'src/vue/useRuntimeTransition.ts'),
        'runtime/detach/DetachAdapter': resolve(__dirname, 'src/runtime/detach/DetachAdapter.ts'),
      },
      name: 'GuguInteractionRuntime',
      formats: ['es'],
    },
    rollupOptions: {
      external: ['vue'],
    },
  },
})
