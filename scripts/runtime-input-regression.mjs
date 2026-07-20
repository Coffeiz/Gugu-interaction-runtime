import {
  Cleanup,
  bindPointerSessionInput,
  getActiveCleanupCount,
} from '../dist-lib/index.js'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

class FakeWindowTarget {
  listeners = new Map()

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? new Set()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  removeEventListener(type, listener) {
    const listeners = this.listeners.get(type)
    listeners?.delete(listener)
    if (listeners?.size === 0) this.listeners.delete(type)
  }

  dispatch(type, event = {}) {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener(event)
  }

  listenerCount() {
    return [...this.listeners.values()].reduce((total, listeners) => total + listeners.size, 0)
  }
}

function createSink() {
  const calls = {
    updates: [],
    releases: [],
    cancels: [],
    interrupts: [],
  }
  return {
    calls,
    sink: {
      update: (sessionId, input) => calls.updates.push({ sessionId, input }),
      release: (sessionId, input) => calls.releases.push({ sessionId, input }),
      cancel: (sessionId, reason) => calls.cancels.push({ sessionId, reason }),
      interrupt: (sessionId, reason) => calls.interrupts.push({ sessionId, reason }),
    },
  }
}

function assertCleanupReturnsTo(baseline, cleanup, target, label) {
  assert(target.listenerCount() === 0, `${label}: listeners should be removed immediately`)
  cleanup.disposeAll()
  assert(getActiveCleanupCount() === baseline, `${label}: cleanup count should return to baseline`)
}

function testPointerIdentityAndRelease() {
  const baseline = getActiveCleanupCount()
  const cleanup = new Cleanup()
  const target = new FakeWindowTarget()
  const { sink, calls } = createSink()

  bindPointerSessionInput(sink, 'session-release', cleanup, {
    target,
    pointerId: 7,
  })

  target.dispatch('pointermove', { pointerId: 8 })
  target.dispatch('pointerup', { pointerId: 8 })
  assert(calls.updates.length === 0, 'foreign pointermove must be ignored')
  assert(calls.releases.length === 0, 'foreign pointerup must not release the session')

  target.dispatch('pointermove', { pointerId: 7 })
  target.dispatch('pointerup', { pointerId: 7 })
  assert(calls.updates.length === 1, 'matching pointermove should update once')
  assert(calls.releases.length === 1, 'matching pointerup should release once')

  target.dispatch('pointerup', { pointerId: 7 })
  assert(calls.releases.length === 1, 'released input must be one-shot')
  assertCleanupReturnsTo(baseline, cleanup, target, 'release')
}

function testPointerCancel() {
  const baseline = getActiveCleanupCount()
  const cleanup = new Cleanup()
  const target = new FakeWindowTarget()
  const { sink, calls } = createSink()

  bindPointerSessionInput(sink, 'session-cancel', cleanup, {
    target,
    pointerId: 3,
  })
  target.dispatch('pointercancel', { pointerId: 9 })
  assert(calls.cancels.length === 0, 'foreign pointercancel must be ignored')
  target.dispatch('pointercancel', { pointerId: 3 })
  assert(calls.cancels.length === 1, 'matching pointercancel should cancel once')
  assert(calls.cancels[0].reason === 'pointer-cancelled', 'pointercancel reason should be stable')
  assertCleanupReturnsTo(baseline, cleanup, target, 'pointercancel')
}

function testBlurInterrupt() {
  const baseline = getActiveCleanupCount()
  const cleanup = new Cleanup()
  const target = new FakeWindowTarget()
  const { sink, calls } = createSink()

  bindPointerSessionInput(sink, 'session-blur', cleanup, { target, pointerId: 4 })
  target.dispatch('blur')
  assert(calls.interrupts.length === 1, 'window blur should interrupt once')
  assert(calls.interrupts[0].reason === 'window-blur', 'blur reason should be stable')
  assertCleanupReturnsTo(baseline, cleanup, target, 'blur')
}

function testEscapeCancel() {
  const baseline = getActiveCleanupCount()
  const cleanup = new Cleanup()
  const target = new FakeWindowTarget()
  const { sink, calls } = createSink()

  bindPointerSessionInput(sink, 'session-escape', cleanup, { target, pointerId: 5 })
  target.dispatch('keydown', { key: 'Enter' })
  assert(calls.cancels.length === 0, 'non-Escape key must be ignored')
  target.dispatch('keydown', { key: 'Escape' })
  assert(calls.cancels.length === 1, 'Escape should cancel once')
  assert(calls.cancels[0].reason === 'escape', 'Escape reason should be stable')
  assertCleanupReturnsTo(baseline, cleanup, target, 'escape')
}

testPointerIdentityAndRelease()
testPointerCancel()
testBlurInterrupt()
testEscapeCancel()

console.log('runtime input regression: ok')
