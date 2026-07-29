<template>
  <aside class="motion-debug-panel">
    <button class="motion-debug-toggle" @click="open = !open">
      Motion 调参 <span>{{ open ? '收起' : '展开' }}</span>
    </button>
    <div v-if="open" class="motion-debug-body">
      <label>
        <span>落地刚度
          <output v-if="editing !== 'stiffness'" class="editable-value" @click="editing = 'stiffness'">{{ draft.stiffness }}</output>
          <input v-else v-model.number="draft.stiffness" class="inline-number" type="number" min="1" step="1" autofocus @blur="editing = null" @input="changeStiffness" />
        </span>
        <input v-model.number="draft.stiffness" type="range" min="80" max="1200" step="1" @input="changeStiffness" />
      </label>
      <label>
        <span>落地阻尼
          <output v-if="editing !== 'damping'" class="editable-value" @click="editing = 'damping'">{{ draft.damping }}</output>
          <input v-else v-model.number="draft.damping" class="inline-number" type="number" min="0" step="0.1" autofocus @blur="editing = null" @input="applyPreview" />
        </span>
        <input v-model.number="draft.damping" type="range" min="1" max="100" step="1" @input="applyPreview" />
      </label>
      <label>
        <span>落地时长
          <output v-if="editing !== 'duration'" class="editable-value" @click="editing = 'duration'">{{ draft.duration }}ms</output>
          <input v-else v-model.number="draft.duration" class="inline-number" type="number" min="100" step="10" autofocus @blur="editing = null" @input="changeDuration" />
        </span>
        <input v-model.number="draft.duration" type="range" min="100" max="1200" step="10" @input="changeDuration" />
      </label>
      <label>
        <span>跟手刚度
          <output v-if="editing !== 'followStiffness'" class="editable-value" @click="editing = 'followStiffness'">{{ draft.followStiffness }}</output>
          <input v-else v-model.number="draft.followStiffness" class="inline-number" type="number" min="1" step="1" autofocus @blur="editing = null" @input="applyPreview" />
        </span>
        <input v-model.number="draft.followStiffness" type="range" min="80" max="1200" step="1" @input="applyPreview" />
      </label>
      <label>
        <span>跟手阻尼
          <output v-if="editing !== 'followDamping'" class="editable-value" @click="editing = 'followDamping'">{{ draft.followDamping.toFixed(1) }}</output>
          <input v-else v-model.number="draft.followDamping" class="inline-number" type="number" min="0" step="0.1" autofocus @blur="editing = null" @input="applyPreview" />
        </span>
        <input v-model.number="draft.followDamping" type="range" min="1" max="100" step="0.1" @input="applyPreview" />
      </label>
      <label>
        <span>抬升角度
          <output v-if="editing !== 'tilt'" class="editable-value" @click="editing = 'tilt'">{{ draft.tilt }}°</output>
          <input v-else v-model.number="draft.tilt" class="inline-number" type="number" min="0" step="0.5" autofocus @blur="editing = null" @input="applyPreview" />
        </span>
        <input v-model.number="draft.tilt" type="range" min="0" max="15" step="0.5" @input="applyPreview" />
      </label>
      <label>
        <span>横向摆动
          <output v-if="editing !== 'sway'" class="editable-value" @click="editing = 'sway'">{{ draft.sway.toFixed(2) }}</output>
          <input v-else v-model.number="draft.sway" class="inline-number" type="number" min="0" step="0.01" autofocus @blur="editing = null" @input="applyPreview" />
        </span>
        <input v-model.number="draft.sway" type="range" min="0" max="1" step="0.01" @input="applyPreview" />
      </label>
      <label>
        <span>抛出速度倍率
          <output v-if="editing !== 'velocityScale'" class="editable-value" @click="editing = 'velocityScale'">{{ draft.velocityScale.toFixed(2) }}</output>
          <input v-else v-model.number="draft.velocityScale" class="inline-number" type="number" min="0" step="0.01" autofocus @blur="editing = null" @input="applyPreview" />
        </span>
        <input v-model.number="draft.velocityScale" type="range" min="0" max="2" step="0.01" @input="applyPreview" />
      </label>
      <label>
        <span>抛出最低速度
          <output v-if="editing !== 'minVelocity'" class="editable-value" @click="editing = 'minVelocity'">{{ draft.minVelocity }}</output>
          <input v-else v-model.number="draft.minVelocity" class="inline-number" type="number" min="0" step="1" autofocus @blur="editing = null" @input="applyPreview" />
        </span>
        <input v-model.number="draft.minVelocity" type="range" min="0" max="300" step="1" @input="applyPreview" />
      </label>
      <div class="motion-debug-actions">
        <button @click="resetToSaved">重置</button>
        <button class="primary" @click="save">保存参数</button>
      </div>
      <small>拖动滑块立即预览；保存后刷新仍保留，重置回到已保存值。</small>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { FOLLOW_PROFILE, FOLLOW_ROTATION, LANDING_PROFILE } from '../motion/MotionProfile'
import { DEFAULT_RELEASE_PROFILE } from '../motion/ReleaseMotion'
import { runtime } from '../Runtime'

interface SavedMotionConfig {
  stiffness: number
  damping: number
  duration: number
  followStiffness: number
  followDamping: number
  tilt: number
  sway: number
  velocityScale: number
  minVelocity: number
}

const STORAGE_KEY = 'gugu-runtime-motion-profile'
const open = ref(false)
const editing = ref<string | null>(null)
const saved = reactive<SavedMotionConfig>({
  stiffness: LANDING_PROFILE.position.stiffness,
  damping: LANDING_PROFILE.position.damping,
  duration: runtime.getMotionProfile()?.landing?.duration ?? 250,
  followStiffness: FOLLOW_PROFILE.position.stiffness,
  followDamping: FOLLOW_PROFILE.position.damping,
  tilt: FOLLOW_ROTATION.tilt,
  sway: FOLLOW_ROTATION.sway,
  velocityScale: DEFAULT_RELEASE_PROFILE.velocityScale,
  minVelocity: DEFAULT_RELEASE_PROFILE.minVelocity,
})
const draft = reactive<SavedMotionConfig>({ ...saved })

function applyPreview(): void {
  LANDING_PROFILE.position.stiffness = draft.stiffness
  LANDING_PROFILE.position.damping = draft.damping
  LANDING_PROFILE.scale.stiffness = draft.stiffness
  LANDING_PROFILE.scale.damping = draft.damping
  FOLLOW_PROFILE.position.stiffness = draft.followStiffness
  FOLLOW_PROFILE.position.damping = draft.followDamping
  FOLLOW_ROTATION.tilt = draft.tilt
  FOLLOW_ROTATION.sway = draft.sway
  DEFAULT_RELEASE_PROFILE.velocityScale = draft.velocityScale
  DEFAULT_RELEASE_PROFILE.minVelocity = draft.minVelocity
  runtime.registerMotionProfile({
    ...(runtime.getMotionProfile() ?? {}),
    landing: { duration: draft.duration, easing: 'cubic-bezier(.22,1,.36,1)' },
  })
}

const SPEED_CALIBRATION = 5100
function changeStiffness(): void {
  const stiffness = Math.max(1, Number(draft.stiffness) || 1)
  draft.stiffness = stiffness
  draft.duration = Math.round(Math.max(100, Math.min(1200, SPEED_CALIBRATION / Math.sqrt(stiffness))))
  applyPreview()
}

function changeDuration(): void {
  const duration = Math.max(100, Number(draft.duration) || 100)
  draft.duration = duration
  draft.stiffness = Math.round(Math.max(80, Math.min(1200, (SPEED_CALIBRATION / duration) ** 2)))
  applyPreview()
}

function save(): void {
  Object.assign(saved, draft)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
  applyPreview()
}

function resetToSaved(): void {
  Object.assign(draft, saved)
  applyPreview()
}

onMounted(() => {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<SavedMotionConfig> | null
    if (!value) return
    if (typeof value.stiffness === 'number') saved.stiffness = value.stiffness
    if (typeof value.damping === 'number') saved.damping = value.damping
    if (typeof value.duration === 'number') saved.duration = value.duration
    if (typeof value.followStiffness === 'number') saved.followStiffness = value.followStiffness
    if (typeof value.followDamping === 'number') saved.followDamping = value.followDamping
    if (typeof value.tilt === 'number') saved.tilt = value.tilt
    if (typeof value.sway === 'number') saved.sway = value.sway
    if (typeof value.velocityScale === 'number') saved.velocityScale = value.velocityScale
    if (typeof value.minVelocity === 'number') saved.minVelocity = value.minVelocity
    Object.assign(draft, saved)
    applyPreview()
  } catch {
    // 调试面板的本地配置损坏时回退代码默认值，不影响 Runtime 主流程。
  }
})
</script>

<style scoped>
.motion-debug-panel { position: fixed; right: 16px; top: 16px; z-index: 20; width: 220px; font: 12px system-ui, sans-serif; color: #333; }
.motion-debug-toggle, .motion-debug-body { box-sizing: border-box; width: 100%; border: 1px solid rgba(0,0,0,.12); background: rgba(255,255,255,.94); box-shadow: 0 8px 24px rgba(0,0,0,.12); }
.motion-debug-toggle { padding: 8px 10px; border-radius: 8px; cursor: pointer; text-align: left; }
.motion-debug-toggle span { float: right; color: #888; }
.motion-debug-body { margin-top: 6px; padding: 10px; border-radius: 8px; }
label { display: block; margin-bottom: 9px; }
label span { display: flex; justify-content: space-between; margin-bottom: 3px; }
output { color: #6670b8; font-variant-numeric: tabular-nums; }
input { width: 100%; accent-color: #6670b8; }
.editable-value { cursor: text; border-bottom: 1px dashed #6670b8; }
.inline-number { width: 68px; padding: 1px 3px; border: 1px solid #6670b8; border-radius: 3px; font: inherit; }
.motion-debug-actions { display: flex; gap: 6px; margin-top: 8px; }
.motion-debug-actions button { flex: 1; padding: 5px 6px; border: 1px solid rgba(0,0,0,.14); border-radius: 5px; background: #fff; cursor: pointer; }
.motion-debug-actions .primary { color: #fff; border-color: #6670b8; background: #6670b8; }
small { display: block; margin-top: 8px; color: #888; line-height: 1.4; }
</style>
