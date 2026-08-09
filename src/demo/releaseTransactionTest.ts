/**
 * release transaction 回归验证。
 *
 * 验证 resolveDestination → commit → landing → reveal 生命周期在
 * clone/detach 两种策略下的行为一致性。
 *
 * 不依赖测试框架，用 console.assert 做断言，在 demo 页面加载时自动运行。
 */

import { MoveBehavior, type MoveBehaviorDriver, type MoveVisualLifecycle } from '../behavior/MoveBehavior'
import type { BehaviorContext } from '../behavior/Behavior'
import type { RuntimeInput } from '../core/Interaction'

interface TestCase {
  name: string
  driver: MoveBehaviorDriver
  lifecycle?: MoveVisualLifecycle
  input: RuntimeInput
  expectedAccepted: boolean
  expectedDestination?: unknown
}

function createMockContext(): BehaviorContext {
  return {
    session: {
      id: 'test-session',
      state: 'active',
      type: 'move',
      objectId: 'test-card',
    } as any,
    emitAction: () => undefined,
    visual: undefined,
    hit: null,
  }
}

function runTestCase(test: TestCase): Promise<boolean> {
  const behavior = new MoveBehavior()
  const sessionId = 'test-session'
  behavior.bindSession(sessionId, test.driver)
  if (test.lifecycle) behavior.bindLifecycle(sessionId, test.lifecycle)

  const context = createMockContext()
  let commitCalled = false
  let landingCalled = false
  let revealCalled = false

  // 拦截 lifecycle 验证调用链
  const originalLifecycle = test.lifecycle
  const wrappedLifecycle: MoveVisualLifecycle = {
    landing: async (ctx, dest) => {
      landingCalled = true
      if (!commitCalled) {
        console.error(`[FAIL] ${test.name}: landing called before commit`)
        return { completed: false, reason: 'commit-not-called' }
      }
      return originalLifecycle?.landing?.(ctx, dest) ?? { completed: true }
    },
    reveal: async (ctx, dest) => {
      revealCalled = true
      if (!landingCalled) {
        console.error(`[FAIL] ${test.name}: reveal called before landing`)
        return
      }
      return originalLifecycle?.reveal?.(ctx, dest)
    },
  }
  behavior.bindLifecycle(sessionId, wrappedLifecycle)

  // 包装 commit 验证
  const originalCommit = test.driver.commit
  if (originalCommit) {
    const wrappedCommit = async (ctx: BehaviorContext, dest: unknown) => {
      commitCalled = true
      return originalCommit(ctx, dest)
    }
    test.driver.commit = wrappedCommit
  }

  return Promise.resolve(behavior.release(context, test.input))
    .then(async (result) => {
      const releaseResult = result as { accepted?: boolean; destination?: unknown } | undefined

      if (releaseResult?.accepted !== test.expectedAccepted) {
        console.error(
          `[FAIL] ${test.name}: expected accepted=${test.expectedAccepted}, got ${releaseResult?.accepted}`,
        )
        return false
      }

      if (test.expectedAccepted && releaseResult?.accepted) {
        if (test.expectedDestination !== undefined) {
          const destStr = JSON.stringify(releaseResult.destination)
          const expectedStr = JSON.stringify(test.expectedDestination)
          if (destStr !== expectedStr) {
            console.error(
              `[FAIL] ${test.name}: expected destination=${expectedStr}, got ${destStr}`,
            )
            return false
          }
        }

        // 验证 commit 被调用
        if (test.driver.commit && !commitCalled) {
          console.error(`[FAIL] ${test.name}: commit was not called`)
          return false
        }
      }

      console.log(`[PASS] ${test.name}`)
      return true
    })
    .catch((error: unknown) => {
      console.error(`[FAIL] ${test.name}: unexpected error`, error)
      return false
    })
}

export async function runReleaseTransactionTests(): Promise<{ passed: number; failed: number }> {
  const tests: TestCase[] = [
    // 1. clone 跨列：有效落点
    {
      name: 'clone cross-column accepted',
      driver: {
        resolveDestination: () => ({ accepted: true, destination: { columnId: 'done', index: 0 } }),
        commit: () => undefined,
      },
      lifecycle: {
        landing: () => ({ completed: true }),
        reveal: () => undefined,
      },
      input: { kind: 'pointerup', event: new PointerEvent('pointerup') },
      expectedAccepted: true,
      expectedDestination: { columnId: 'done', index: 0 },
    },
    // 2. detach 跨列：有效落点
    {
      name: 'detach cross-column accepted',
      driver: {
        resolveDestination: () => ({ accepted: true, destination: { columnId: 'doing', index: 2 } }),
        commit: () => undefined,
      },
      lifecycle: {
        landing: () => ({ completed: true }),
        reveal: () => undefined,
      },
      input: { kind: 'pointerup', event: new PointerEvent('pointerup') },
      expectedAccepted: true,
      expectedDestination: { columnId: 'doing', index: 2 },
    },
    // 3. invalid drop：落点无效
    {
      name: 'invalid drop rejected',
      driver: {
        resolveDestination: () => ({ accepted: false }),
        commit: () => { throw new Error('commit should not be called on invalid drop') },
      },
      input: { kind: 'pointerup', event: new PointerEvent('pointerup') },
      expectedAccepted: false,
    },
    // 4. regrab 场景：有效落点
    {
      name: 'regrab accepted',
      driver: {
        resolveDestination: () => ({ accepted: true, destination: { columnId: 'todo', index: 1 } }),
        commit: () => undefined,
      },
      lifecycle: {
        landing: () => ({ completed: true }),
        reveal: () => undefined,
      },
      input: { kind: 'pointerup', event: new PointerEvent('pointerup') },
      expectedAccepted: true,
      expectedDestination: { columnId: 'todo', index: 1 },
    },
  ]

  let passed = 0
  let failed = 0

  for (const test of tests) {
    const ok = await runTestCase(test)
    if (ok) passed++
    else failed++
  }

  console.log(`\n=== Release Transaction Tests: ${passed} passed, ${failed} failed ===`)
  return { passed, failed }
}

// 在 demo 页面加载时自动运行
if (typeof window !== 'undefined') {
  ;(window as any).__runReleaseTransactionTests = runReleaseTransactionTests
}
