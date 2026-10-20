import type { BenchmarkOptions, BenchmarkSample } from './benchmarkTypes'
import { getLastLayoutFlipTelemetry, getLayoutFlipTelemetryCount } from '../dom/GroupLayout'

type EventEntry = PerformanceEventTiming & { interactionId?: number }
type FrameRecord = BenchmarkSample['longAnimationFrames'][number]

/** Collects browser-provided Event Timing, LoAF and Long Task entries for one measured drag. */
export class PerformanceRecorder {
  private readonly options: BenchmarkOptions
  private readonly layoutFlipTelemetryStartCount: number | null
  private readonly startedAt = performance.now()
  private readonly eventTiming: BenchmarkSample['eventTiming'] = []
  private readonly longAnimationFrames: FrameRecord[] = []
  private readonly longTasks: BenchmarkSample['longTasks'] = []
  private readonly intervals: Array<{ endTime: number; duration: number }> = []
  private readonly observers: PerformanceObserver[] = []
  private eventObserver?: PerformanceObserver
  private frameId = 0
  private previousFrame: number | null = null
  private pointerDownAt?: number
  private pointerUpAt?: number
  private commitEndAt?: number
  private settleEndAt?: number
  private layoutFlipTelemetryAtSettle?: BenchmarkSample['layoutFlipTelemetry']
  private commit?: BenchmarkSample['commit']

  constructor(options: BenchmarkOptions) {
    this.options = options
    this.layoutFlipTelemetryStartCount = options.implementation === 'runtime' ? getLayoutFlipTelemetryCount() : null
    if (PerformanceObserver.supportedEntryTypes.includes('event')) {
      this.eventObserver = new PerformanceObserver(list => this.recordEventEntries(list.getEntries()))
      this.eventObserver.observe({ type: 'event', buffered: true, durationThreshold: 16 } as PerformanceObserverInit & { durationThreshold: number })
      this.observers.push(this.eventObserver)
    }
    this.observe('long-animation-frame', entries => {
      for (const entry of entries as PerformanceEntryList) {
        const loaf = entry as PerformanceEntry & { blockingDuration?: number; scripts?: Array<Record<string, unknown>> }
        this.longAnimationFrames.push({
          startTime: loaf.startTime,
          duration: loaf.duration,
          blockingDuration: loaf.blockingDuration ?? 0,
          scripts: (loaf.scripts ?? []).map(script => ({
            sourceURL: String(script.sourceURL ?? ''),
            sourceFunctionName: String(script.sourceFunctionName ?? ''),
            duration: Number(script.duration ?? 0),
            invoker: String(script.invoker ?? ''),
          })),
        })
      }
    })
    this.observe('longtask', entries => {
      for (const entry of entries as PerformanceEntryList) {
        this.longTasks.push({ startTime: entry.startTime, duration: entry.duration, name: entry.name })
      }
    })
    this.frameId = requestAnimationFrame(this.onFrame)
  }

  mark(name: 'pointerdown' | 'pointerup' | 'commit-end' | 'settle-end'): void {
    const time = performance.now()
    if (name === 'pointerdown') this.pointerDownAt = time
    if (name === 'pointerup') this.pointerUpAt = time
    if (name === 'commit-end') this.commitEndAt = time
    if (name === 'settle-end') {
      this.settleEndAt = time
      this.layoutFlipTelemetryAtSettle = this.readLayoutFlipTelemetry()
      cancelAnimationFrame(this.frameId)
      this.frameId = 0
    }
  }

  setCommit(commit: NonNullable<BenchmarkSample['commit']>): void {
    this.commit = commit
  }

  async finish(): Promise<BenchmarkSample> {
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    if (this.eventObserver) this.recordEventEntries(this.eventObserver.takeRecords())
    this.observers.forEach(observer => observer.disconnect())
    cancelAnimationFrame(this.frameId)
    const measuredEndAt = this.settleEndAt ?? this.pointerUpAt
    const hasMeasuredWindow = this.pointerDownAt !== undefined && measuredEndAt !== undefined
    const inMeasuredWindow = (entry: { startTime: number }) => hasMeasuredWindow && entry.startTime >= this.pointerDownAt! && entry.startTime <= measuredEndAt!
    const intervals = hasMeasuredWindow
      ? this.intervals.filter(interval => interval.endTime >= this.pointerDownAt! && interval.endTime <= measuredEndAt!).map(interval => interval.duration)
      : []
    const over24ms = intervals.filter(interval => interval > 24).length
    const eventTiming = this.eventTiming.filter(inMeasuredWindow)
    const longAnimationFrames = this.longAnimationFrames.filter(inMeasuredWindow)
    const longTasks = this.longTasks.filter(inMeasuredWindow)
    const interactions = new Map<number, number>()
    for (const event of eventTiming) {
      if (!event.interactionId) continue
      interactions.set(event.interactionId, Math.max(interactions.get(event.interactionId) ?? 0, event.duration))
    }
    const interactionDurations = [...interactions.values()].sort((a, b) => a - b)
    const percentile = 98
    const dragInteractionP98 = interactionDurations.length
      ? interactionDurations[Math.max(0, Math.ceil(interactionDurations.length * percentile / 100) - 1)]
      : undefined
    const dragInteractionP98Ms = dragInteractionP98 === undefined ? undefined : { duration: dragInteractionP98, interactionCount: interactionDurations.length }
    const eventTimingMaxMs = eventTiming.length ? Math.max(...eventTiming.map(event => event.duration)) : undefined
    const layoutFlipTelemetry = this.layoutFlipTelemetryAtSettle ?? this.readLayoutFlipTelemetry()
    return {
      schemaVersion: 4,
      options: this.options,
      environment: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        hardwareConcurrency: navigator.hardwareConcurrency,
        deviceMemory: 'deviceMemory' in navigator ? Number((navigator as Navigator & { deviceMemory?: number }).deviceMemory) : undefined,
        viewport: { width: innerWidth, height: innerHeight, deviceScaleFactor: devicePixelRatio },
        timestamp: new Date().toISOString(),
      },
      interaction: { startedAt: this.startedAt, pointerDownAt: this.pointerDownAt, pointerUpAt: this.pointerUpAt, commitEndAt: this.commitEndAt, settleEndAt: this.settleEndAt },
      eventTiming,
      ...(dragInteractionP98Ms ? { dragInteractionP98: dragInteractionP98Ms } : {}),
      ...(eventTimingMaxMs === undefined ? {} : { eventTimingMaxMs }),
      longAnimationFrames,
      longTasks,
      frames: { count: intervals.length, over24ms, intervals },
      phases: {
        inputMs: this.phase(this.pointerDownAt, this.pointerUpAt),
        commitMs: this.phase(this.pointerUpAt, this.commitEndAt),
        settleMs: this.phase(this.commitEndAt, this.settleEndAt),
      },
      settleTimedOut: this.settleEndAt === undefined,
      layoutFlipTelemetry,
      ...(this.commit ? { commit: this.commit } : {}),
    }
  }

  private readLayoutFlipTelemetry(): BenchmarkSample['layoutFlipTelemetry'] {
    if (this.layoutFlipTelemetryStartCount === null) return { status: 'unsupported', transactionCount: 0 }
    const transactionCount = Math.max(0, getLayoutFlipTelemetryCount() - this.layoutFlipTelemetryStartCount)
    if (transactionCount === 0) return { status: 'missing', transactionCount: 0 }
    const values = getLastLayoutFlipTelemetry()
    if (!values) return { status: 'missing', transactionCount: 0 }
    return { status: 'captured', transactionCount, aggregation: 'last-published-transaction', values }
  }

  private phase(start?: number, end?: number): number | undefined {
    return start === undefined || end === undefined ? undefined : Math.max(0, end - start)
  }

  private observe(type: string, callback: (entries: PerformanceEntryList) => void, options: PerformanceObserverInit & { durationThreshold?: number } = {}): void {
    if (!PerformanceObserver.supportedEntryTypes.includes(type)) return
    const observer = new PerformanceObserver(list => callback(list.getEntries()))
    observer.observe({ type, buffered: true, ...options } as PerformanceObserverInit & { durationThreshold?: number })
    this.observers.push(observer)
  }

  private recordEventEntries(entries: PerformanceEntryList): void {
    for (const entry of entries as PerformanceEntryList) {
      const event = entry as EventEntry
      if (event.startTime < this.startedAt) continue
      const processingStart = event.processingStart ?? event.startTime
      const processingEnd = event.processingEnd ?? processingStart
      this.eventTiming.push({
        name: event.name,
        startTime: event.startTime,
        duration: event.duration,
        interactionId: event.interactionId ?? 0,
        inputDelay: Math.max(0, processingStart - event.startTime),
        processingDuration: Math.max(0, processingEnd - processingStart),
        presentationDelay: Math.max(0, event.startTime + event.duration - processingEnd),
      })
    }
  }

  private readonly onFrame = (now: number): void => {
    if (this.previousFrame !== null) this.intervals.push({ endTime: now, duration: now - this.previousFrame })
    this.previousFrame = now
    this.frameId = requestAnimationFrame(this.onFrame)
  }
}
