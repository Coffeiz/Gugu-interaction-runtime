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
        'vue': resolve(__dirname, 'src/vue/index.ts'),
        'runtime/move/MoveAdapter': resolve(__dirname, 'src/runtime/move/MoveAdapter.ts'),
      },
      name: 'GuguInteractionRuntime',
      formats: ['es'],
    },
    rollupOptions: {
      external: ['vue'],
    },
  },
})
