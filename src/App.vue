<template>
  <MotionDebugPanel />
  <DemoShell />
</template>

<script setup lang="ts">
import DemoShell from './demo/DemoShell.vue'
import MotionDebugPanel from './demo/MotionDebugPanel.vue'
import { provideRuntime } from './vue'
import { runtime } from './Runtime'

provideRuntime(runtime)
</script>
