import { AsyncLocalStorage } from 'node:async_hooks'

export class LockTimeoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LockTimeoutError'
  }
}

export class LockQueueFullError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LockQueueFullError'
  }
}

interface LockEntry {
  promise: Promise<void>
  resolve: () => void
  reject: (err: Error) => void
  timeout: NodeJS.Timeout
  acquired: boolean
}

interface CallerLockState {
  held: Set<string>
  reentryCounts: Map<string, number>
}

const DEFAULT_TIMEOUT = 15000
const DEFAULT_MAX_QUEUE_LENGTH = 5

const lockContext = new AsyncLocalStorage<CallerLockState>()

function getState(): CallerLockState {
  return (
    lockContext.getStore() ?? {
      held: new Set<string>(),
      reentryCounts: new Map<string, number>(),
    }
  )
}

export function isLockHeldByCurrentCaller(key: string): boolean {
  return getState().held.has(key)
}

function withRootContext<T>(fn: () => Promise<T>): Promise<T> {
  if (lockContext.getStore()) {
    return fn()
  }
  return lockContext.run(
    { held: new Set<string>(), reentryCounts: new Map<string, number>() },
    fn
  )
}

export class LockManager {
  private locks: Map<string, LockEntry[]> = new Map()

  async acquire(
    key: string,
    timeoutMs: number = DEFAULT_TIMEOUT,
    maxQueueLength: number = DEFAULT_MAX_QUEUE_LENGTH
  ): Promise<() => void> {
    const state = getState()

    if (state.held.has(key)) {
      const current = state.reentryCounts.get(key) ?? 0
      state.reentryCounts.set(key, current + 1)

      return () => {
        const s = getState()
        const c = s.reentryCounts.get(key) ?? 0
        if (c > 1) {
          s.reentryCounts.set(key, c - 1)
        } else {
          s.reentryCounts.delete(key)
        }
      }
    }

    const waiting = this.locks.get(key) ?? []

    if (waiting.length >= maxQueueLength) {
      throw new LockQueueFullError(
        `系统繁忙，请稍后再试。当前请求排队人数已达上限（${maxQueueLength}人）`
      )
    }

    const entry: LockEntry = {
      promise: null as unknown as Promise<void>,
      resolve: null as unknown as () => void,
      reject: null as unknown as (err: Error) => void,
      timeout: null as unknown as NodeJS.Timeout,
      acquired: false,
    }

    entry.promise = new Promise<void>((resolve, reject) => {
      entry.resolve = resolve
      entry.reject = reject
    })

    entry.timeout = setTimeout(() => {
      this.removeLock(key, entry, false)
      if (!entry.acquired) {
        entry.reject(
          new LockTimeoutError(
            `等待超时（${timeoutMs / 1000}秒）。当前时段预约人数较多，请稍后重试或选择其他时段`
          )
        )
      }
    }, timeoutMs)

    waiting.push(entry)
    this.locks.set(key, waiting)

    if (waiting.length > 1) {
      const prevEntry = waiting[waiting.length - 2]
      try {
        await prevEntry.promise
      } catch {
        this.removeLock(key, entry, false)
        throw new LockTimeoutError(
          '排队等待过程中发生错误，请稍后重试'
        )
      }
    }

    entry.acquired = true
    clearTimeout(entry.timeout)
    state.held.add(key)
    state.reentryCounts.set(key, 1)

    return () => this.release(key, entry)
  }

  private release(key: string, entry: LockEntry): void {
    const state = getState()
    const count = state.reentryCounts.get(key) ?? 0

    if (count > 1) {
      state.reentryCounts.set(key, count - 1)
      return
    }

    state.reentryCounts.delete(key)
    state.held.delete(key)
    this.removeLock(key, entry, true)
  }

  private removeLock(key: string, entry: LockEntry, shouldResolve: boolean): void {
    const waiting = this.locks.get(key)
    if (!waiting) return

    const index = waiting.findIndex((e) => e === entry)
    if (index === -1) return

    clearTimeout(entry.timeout)

    waiting.splice(index, 1)

    if (waiting.length === 0) {
      this.locks.delete(key)
    }

    if (shouldResolve && entry.acquired) {
      entry.resolve()
    }
  }

  isLocked(key: string): boolean {
    const waiting = this.locks.get(key)
    return waiting !== undefined && waiting.length > 0
  }

  getQueueLength(key: string): number {
    const waiting = this.locks.get(key)
    return waiting?.length ?? 0
  }

  async withLock<T>(
    key: string,
    fn: () => Promise<T> | T,
    timeoutMs?: number,
    maxQueueLength?: number
  ): Promise<T> {
    return withRootContext(async () => {
      const release = await this.acquire(key, timeoutMs, maxQueueLength)
      try {
        return await fn()
      } finally {
        release()
      }
    })
  }

  async runWithLock<T>(
    key: string,
    fn: () => Promise<T> | T,
    timeoutMs?: number,
    maxQueueLength?: number
  ): Promise<T> {
    return this.withLock(key, fn, timeoutMs, maxQueueLength)
  }

  async acquireMulti(
    keys: string[],
    timeoutMsPerLock: number = DEFAULT_TIMEOUT,
    maxQueueLength: number = DEFAULT_MAX_QUEUE_LENGTH
  ): Promise<() => void> {
    const sortedKeys = [...keys].sort()
    const releases: (() => void)[] = []

    try {
      for (const key of sortedKeys) {
        const release = await this.acquire(key, timeoutMsPerLock, maxQueueLength)
        releases.push(release)
      }
    } catch (error) {
      for (let i = releases.length - 1; i >= 0; i--) {
        try { releases[i]() } catch { /* ignore */ }
      }
      throw error
    }

    return () => {
      for (let i = releases.length - 1; i >= 0; i--) {
        try { releases[i]() } catch { /* ignore */ }
      }
    }
  }

  async runWithMultiLock<T>(
    keys: string[],
    fn: () => Promise<T> | T,
    timeoutMsPerLock?: number,
    maxQueueLength?: number
  ): Promise<T> {
    return withRootContext(async () => {
      const release = await this.acquireMulti(keys, timeoutMsPerLock, maxQueueLength)
      try {
        return await fn()
      } finally {
        release()
      }
    })
  }
}

const lockManager = new LockManager()
export default lockManager
export { lockManager }
