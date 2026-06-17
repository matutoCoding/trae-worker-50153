interface LockEntry {
  promise: Promise<void>;
  resolve: () => void;
  timeout: NodeJS.Timeout;
}

const DEFAULT_TIMEOUT = 30000;

export class LockManager {
  private locks: Map<string, LockEntry[]> = new Map();

  async acquire(key: string, timeoutMs: number = DEFAULT_TIMEOUT): Promise<() => void> {
    const waiting = this.locks.get(key) ?? [];

    let resolveLock: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });

    const timeout = setTimeout(() => {
      this.removeLock(key, lockPromise);
      throw new Error(`Lock acquisition timed out for key: ${key}`);
    }, timeoutMs);

    const entry: LockEntry = {
      promise: lockPromise,
      resolve: resolveLock!,
      timeout,
    };

    waiting.push(entry);
    this.locks.set(key, waiting);

    if (waiting.length > 1) {
      const prevEntry = waiting[waiting.length - 2];
      await prevEntry.promise;
    }

    return () => this.release(key, lockPromise);
  }

  private release(key: string, promise: Promise<void>): void {
    const waiting = this.locks.get(key);
    if (!waiting) return;

    const index = waiting.findIndex((e) => e.promise === promise);
    if (index === -1) return;

    const entry = waiting[index];
    clearTimeout(entry.timeout);
    entry.resolve();

    waiting.splice(index, 1);

    if (waiting.length === 0) {
      this.locks.delete(key);
    }
  }

  private removeLock(key: string, promise: Promise<void>): void {
    const waiting = this.locks.get(key);
    if (!waiting) return;

    const index = waiting.findIndex((e) => e.promise === promise);
    if (index === -1) return;

    const entry = waiting[index];
    clearTimeout(entry.timeout);
    waiting.splice(index, 1);

    if (waiting.length === 0) {
      this.locks.delete(key);
    }
  }

  isLocked(key: string): boolean {
    const waiting = this.locks.get(key);
    return waiting !== undefined && waiting.length > 0;
  }

  async withLock<T>(key: string, fn: () => Promise<T> | T, timeoutMs?: number): Promise<T> {
    const release = await this.acquire(key, timeoutMs);
    try {
      return await fn();
    } finally {
      release();
    }
  }

  async runWithLock<T>(key: string, fn: () => Promise<T> | T, timeoutMs?: number): Promise<T> {
    return this.withLock(key, fn, timeoutMs);
  }
}

const lockManager = new LockManager();
export default lockManager;
export { lockManager };
