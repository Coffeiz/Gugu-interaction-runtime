import type { LayoutFlipTelemetry } from '../dom/GroupLayout'

export type BenchmarkScenario = 'flat' | 'flat-thumbnails' | 'kanban' | 'grouped' | 'canvas'
export type BenchmarkImplementation = 'runtime' | 'dnd-kit'
export type BenchmarkInteraction = 'same-list' | 'cross-column' | 'grouped' | 'folded-context' | 'regrab' | 'canvas-node' | 'multi-select'

export interface BenchmarkOptions {
  scenario: BenchmarkScenario
  implementation: BenchmarkImplementation
  interaction: BenchmarkInteraction
  count: number
  runId: string
}
export interface BenchmarkSample {
  schemaVersion: 4
  options: BenchmarkOptions
  environment: {
    userAgent: string
    platform: string
    hardwareConcurrency: number
    deviceMemory?: number
    viewport: { width: number; height: number; deviceScaleFactor: number }
    timestamp: string
  }
  interaction: { startedAt: number; pointerDownAt?: number; pointerUpAt?: number; commitEndAt?: number; settleEndAt?: number }
  eventTiming: Array<{ name: string; startTime: number; duration: number; interactionId: number; inputDelay: number; processingDuration: number; presentationDelay: number }>
  dragInteractionP98?: { duration: number; interactionCount: number }
  eventTimingMaxMs?: number
  longAnimationFrames: Array<{ startTime: number; duration: number; blockingDuration: number; scripts: Array<{ sourceURL: string; sourceFunctionName: string; duration: number; invoker: string }> }>
  longTasks: Array<{ startTime: number; duration: number; name: string }>
  frames: { count: number; over24ms: number; intervals: number[] }
  phases: { inputMs?: number; commitMs?: number; settleMs?: number }
  settleTimedOut: boolean
  layoutFlipTelemetry:
    | { status: 'unsupported'; transactionCount: 0 }
    | { status: 'missing'; transactionCount: number }
    | { status: 'captured'; transactionCount: number; aggregation: 'last-published-transaction'; values: LayoutFlipTelemetry }
  commit?: { objectIds: string[]; committed: boolean; sourceGroupId?: string; destinationGroupId?: string; index?: number }
}
