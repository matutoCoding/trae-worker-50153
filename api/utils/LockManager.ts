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

interface WaiterEntry {
  promise: Promise<void>
  resolve: () => void
  reject: (err: Error) => void
  timeout: NodeJS.Timeout
}

interface LockState {
  locked: boolean
  waiters: WaiterEntry[]
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
  private locks: Map<string, LockState> = new Map()

  private getOrCreateLock(key: string): LockState {
    let state = this.locks.get(key)
    if (!state) {
      state = { locked: false, waiters: [] }
      this.locks.set(key, state)
    }
    return state
  }

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

    const lock = this.getOrCreateLock(key)

    if (lock.waiters.length >= maxQueueLength) {
      throw new LockQueueFullError(
        `系统繁忙，请稍后再试。当前请求排队人数已达上限（${maxQueueLength}人）`
      )
    }

    if (!lock.locked) {
      lock.locked = true
      state.held.add(key)
      state.reentryCounts.set(key, 1)

      return () => this.release(key)
    }

    const entry: WaiterEntry = {
      promise: null as unknown as Promise<void>,
      resolve: null as unknown as () => void,
      reject: null as unknown as (err: Error) => void,
      timeout: null as unknown as NodeJS.Timeout,
    }

    entry.promise = new Promise<void>((resolve, reject) => {
      entry.resolve = resolve
      entry.reject = reject
    })

    entry.timeout = setTimeout(() => {
      const idx = lock.waiters.indexOf(entry)
      if (idx !== -1) {
        lock.waiters.splice(idx, 1)
      }
      if (lock.waiters.length === 0 && !lock.locked) {
        this.locks.delete(key)
      }
      entry.reject(
        new LockTimeoutError(
          `等待超时（${timeoutMs / 1000}秒）。当前时段预约人数较多，请稍后重试或选择其他时段`
        )
      )
    }, timeoutMs)

    lock.waiters.push(entry)

    try {
      await entry.promise
    } catch (err) {
      clearTimeout(entry.timeout)
      throw err
    }

    clearTimeout(entry.timeout)
    state.held.add(key)
    state.reentryCounts.set(key, 1)

    return () => this.release(key)
  }

  private release(key: string): void {
    const state = getState()
    const count = state.reentryCounts.get(key) ?? 0

    if (count > 1) {
      state.reentryCounts.set(key, count - 1)
      return
    }

    state.reentryCounts.delete(key)
    state.held.delete(key)

    const lock = this.locks.get(key)
    if (!lock) return

    if (lock.waiters.length > 0) {
      const next = lock.waiters.shift()!
      next.resolve()
    } else {
      lock.locked = false
      if (lock.waiters.length === 0) {
        this.locks.delete(key)
      }
    }
  }

  isLocked(key: string): boolean {
    const lock = this.locks.get(key)
    return lock ? lock.locked : false
  }

  getQueueLength(key: string): number {
    const lock = this.locks.get(key)
    return lock?.waiters.length ?? 0
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
