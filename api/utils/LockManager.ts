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

const DEFAULT_TIMEOUT = 15000
const DEFAULT_MAX_QUEUE_LENGTH = 5

export class LockManager {
  private locks: Map<string, LockEntry[]> = new Map()

  async acquire(
    key: string,
    timeoutMs: number = DEFAULT_TIMEOUT,
    maxQueueLength: number = DEFAULT_MAX_QUEUE_LENGTH
  ): Promise<() => void> {
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

    return () => this.release(key, entry)
  }

  private release(key: string, entry: LockEntry): void {
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
    const release = await this.acquire(key, timeoutMs, maxQueueLength)
    try {
      return await fn()
    } finally {
      release()
    }
  }

  async runWithLock<T>(
    key: string,
    fn: () => Promise<T> | T,
    timeoutMs?: number,
    maxQueueLength?: number
  ): Promise<T> {
    return this.withLock(key, fn, timeoutMs, maxQueueLength)
  }
}

const lockManager = new LockManager()
export default lockManager
export { lockManager }
