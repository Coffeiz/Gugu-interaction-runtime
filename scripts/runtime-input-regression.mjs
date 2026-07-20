import {
  Cleanup,
  bindPointerSessionInput,
  getActiveCleanupCount,
  trackLandingTarget,
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

function testLostPointerCaptureInterrupt() {
  const baseline = getActiveCleanupCount()
  const cleanup = new Cleanup()
  const target = new FakeWindowTarget()
  const captureTarget = new FakeWindowTarget()
  const { sink, calls } = createSink()

  bindPointerSessionInput(sink, 'session-lost-capture', cleanup, {
    target,
    captureTarget,
    pointerId: 6,
  })
  captureTarget.dispatch('lostpointercapture', { pointerId: 2 })
  assert(calls.interrupts.length === 0, 'foreign lostpointercapture must be ignored')
  captureTarget.dispatch('lostpointercapture', { pointerId: 6 })
  assert(calls.interrupts.length === 1, 'matching lostpointercapture should interrupt once')
  assert(calls.interrupts[0].reason === 'lost-pointer-capture', 'lost capture reason should be stable')
  assert(target.listenerCount() === 0, 'lost capture should remove window listeners immediately')
  assert(captureTarget.listenerCount() === 0, 'lost capture should remove capture-target listener immediately')
  cleanup.disposeAll()
  assert(getActiveCleanupCount() === baseline, 'lost capture cleanup count should return to baseline')
}

function testLandingTargetMovement() {
  const originalGlobals = {
    window: globalThis.window,
    document: globalThis.document,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
    ResizeObserver: globalThis.ResizeObserver,
  }

  const fakeWindow = new FakeWindowTarget()
  const frameCallbacks = new Map()
  let nextFrameId = 1
  const resizeObservers = []

  class FakeResizeObserver {
    constructor(callback) {
      this.callback = callback
      this.disconnected = false
      resizeObservers.push(this)
    }
    observe() {}
    disconnect() { this.disconnected = true }
  }

  try {
    globalThis.window = fakeWindow
    globalThis.document = { body: {} }
    globalThis.requestAnimationFrame = callback => {
      const id = nextFrameId++
      frameCallbacks.set(id, callback)
      return id
    }
    globalThis.cancelAnimationFrame = id => frameCallbacks.delete(id)
    globalThis.ResizeObserver = FakeResizeObserver

    const baseline = getActiveCleanupCount()
    const cleanup = new Cleanup()
    let currentRect = { left: 0, top: 0, width: 100, height: 40 }
    const target = {
      isConnected: true,
      parentElement: null,
      getBoundingClientRect: () => ({ ...currentRect }),
    }
    const retargets = []

    trackLandingTarget(target, rect => retargets.push(rect), { cleanup })
    assert(frameCallbacks.size === 1, 'landing tracker should schedule a geometry frame')

    currentRect = { ...currentRect, left: 24 }
    const [firstFrameId, firstFrame] = frameCallbacks.entries().next().value
    frameCallbacks.delete(firstFrameId)
    firstFrame()
    assert(retargets.length === 1, 'frame movement should retarget without a resize')

    currentRect = { ...currentRect, top: 32 }
    fakeWindow.dispatch('scroll')
    assert(retargets.length === 2, 'scroll movement should retarget without a resize')

    currentRect = { ...currentRect, width: 120 }
    resizeObservers[0].callback()
    assert(retargets.length === 3, 'resize should continue to retarget')

    cleanup.disposeAll()
    assert(fakeWindow.listenerCount() === 0, 'landing tracker should remove scroll listener')
    assert(frameCallbacks.size === 0, 'landing tracker should cancel pending frame')
    assert(resizeObservers[0].disconnected, 'landing tracker should disconnect ResizeObserver')
    assert(getActiveCleanupCount() === baseline, 'landing tracker cleanup count should return to baseline')
  } finally {
    for (const [key, value] of Object.entries(originalGlobals)) {
      if (value === undefined) delete globalThis[key]
      else globalThis[key] = value
    }
  }
}

testPointerIdentityAndRelease()
testPointerCancel()
testBlurInterrupt()
testEscapeCancel()
testLostPointerCaptureInterrupt()
testLandingTargetMovement()

console.log('runtime regression: ok')
