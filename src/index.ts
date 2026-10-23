export { ContextFence, type ContextTicket } from "./context.js";

export type MaybePromise<T> = T | Promise<T>;
export type AnyFunction = (...args: never[]) => unknown;

export interface Deferred<T, E = unknown> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason: E) => void;
}

export const createDeferred = <T = void, E = unknown>(): Deferred<T, E> => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason: E) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
};

export class WaitError extends Error {
  override name = "WaitError";
}

export const wait = (milliseconds: number, success = true): Promise<void> => {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) {
    return Promise.reject(new RangeError("Wait duration must be a finite non-negative number"));
  }
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (success) resolve();
      else reject(new WaitError("wait rejected"));
    }, milliseconds);
  });
};

export type ThrottleMode = "urgent" | "delay";
export type ThrottleStep = "start" | "delay" | "running" | "reset";

export interface ThrottleOptions {
  mode?: ThrottleMode;
  ms?: number;
  observe?: (active: boolean, step: ThrottleStep) => void;
}

export const throttle = <Args extends unknown[], Result>(
  operation: (...args: Args) => MaybePromise<Result>,
  { mode = "urgent", ms = 250, observe }: ThrottleOptions = {},
  timer: (milliseconds: number) => Promise<void> = wait,
): ((...args: Args) => Promise<Result>) => {
  if (!Number.isFinite(ms) || ms < 0) throw new RangeError("Throttle duration must be a finite non-negative number");

  let activePromise: Promise<Result> | null = null;
  let latestArgs: Args;

  const reset = (): void => {
    activePromise = null;
    observe?.(false, "reset");
  };

  return (...args: Args): Promise<Result> => {
    latestArgs = args;
    if (activePromise) return activePromise;

    observe?.(true, "start");

    if (mode === "delay") {
      const delayed = (async (): Promise<Result> => {
        try {
          observe?.(true, "delay");
          await timer(ms);
          observe?.(true, "running");
          return await operation(...latestArgs);
        } finally {
          reset();
        }
      })();
      activePromise = delayed;
      return delayed;
    }

    observe?.(true, "running");
    const urgentArgs = args;
    const result = Promise.resolve().then(() => operation(...urgentArgs));
    activePromise = result;
    void result
      .finally(async () => {
        observe?.(true, "delay");
        try {
          await timer(ms);
        } finally {
          reset();
        }
      })
      .catch(() => undefined);
    return result;
  };
};

export interface DebounceScheduler {
  set: (callback: () => void, milliseconds: number) => unknown;
  clear: (handle: unknown) => void;
}

export interface Debounced<Args extends unknown[]> {
  (...args: Args): void;
  cancel(): void;
}

const defaultDebounceScheduler: DebounceScheduler = {
  set: (callback, milliseconds) => setTimeout(callback, milliseconds),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export const debounce = <Args extends unknown[]>(
  operation: (...args: Args) => unknown,
  milliseconds: number,
  scheduler: DebounceScheduler = defaultDebounceScheduler,
): Debounced<Args> => {
  let handle: unknown;
  let latestArgs: Args;

  const debounced = (...args: Args): void => {
    latestArgs = args;
    if (handle !== undefined) scheduler.clear(handle);
    handle = scheduler.set(() => {
      handle = undefined;
      operation(...latestArgs);
    }, milliseconds);
  };

  debounced.cancel = (): void => {
    if (handle === undefined) return;
    scheduler.clear(handle);
    handle = undefined;
  };

  return debounced;
};

export type BoundaryFallback<T> = T | ((error: unknown) => MaybePromise<T>);

export const boundary = async <Result, Fallback = Result>(
  operation: () => MaybePromise<Result>,
  fallback: BoundaryFallback<Fallback>,
): Promise<Result | Fallback> => {
  try {
    return await operation();
  } catch (error: unknown) {
    return typeof fallback === "function"
      ? await (fallback as (error: unknown) => MaybePromise<Fallback>)(error)
      : fallback;
  }
};

export class ActivityTracker {
  readonly #pending = new Set<Promise<unknown>>();
  readonly #idleWaiters = new Set<Deferred<void>>();
  readonly #onChange: (active: boolean) => void;

  constructor(onChange: (active: boolean) => void = () => undefined) {
    this.#onChange = onChange;
  }

  get active(): boolean {
    return this.#pending.size > 0;
  }

  track<T>(promise: Promise<T>): Promise<T> {
    const wasActive = this.active;
    this.#pending.add(promise);
    if (!wasActive) this.#onChange(true);

    void promise
      .finally(() => {
        this.#pending.delete(promise);
        if (this.#pending.size !== 0) return;
        this.#onChange(false);
        for (const waiter of this.#idleWaiters) waiter.resolve();
        this.#idleWaiters.clear();
      })
      .catch(() => undefined);

    return promise;
  }

  idle(): Promise<void> {
    if (!this.active) return Promise.resolve();
    const waiter = createDeferred<void>();
    this.#idleWaiters.add(waiter);
    return waiter.promise;
  }
}
