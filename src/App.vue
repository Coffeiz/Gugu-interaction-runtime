<template>
  <BenchmarkPage v-if="isBenchmarkRoute" />
  <template v-else>
    <MotionDebugPanel />
    <DemoShell />
  </template>
</template>

<script setup lang="ts">
import BenchmarkPage from './benchmark/BenchmarkPage.vue'
import DemoShell from './demo/DemoShell.vue'
import MotionDebugPanel from './demo/MotionDebugPanel.vue'
import { provideRuntime } from './vue'
import { runtime } from './Runtime'

const isBenchmarkRoute = location.pathname === '/benchmark' || location.pathname === '/benchmark/'
provideRuntime(runtime)
</script>
