import { describe, expect, test } from "bun:test";
import {
  ActivityTracker,
  WaitError,
  boundary,
  createDeferred,
  debounce,
  throttle,
  wait,
} from "../src/index.js";

describe("async-control", () => {
  test("creates externally settleable promises", async () => {
    const deferred = createDeferred<number>();
    deferred.resolve(42);
    await expect(deferred.promise).resolves.toBe(42);
  });

  test("wait exposes a typed rejection", async () => {
    await expect(wait(0, false)).rejects.toBeInstanceOf(WaitError);
  });

  test("delay throttle shares one promise and executes the latest arguments", async () => {
    const gate = createDeferred<void>();
    const calls: number[] = [];
    const observed: string[] = [];
    const controlled = throttle(
      (value: number) => (calls.push(value), value * 2),
      { mode: "delay", ms: 50, observe: (_active, step) => observed.push(step) },
      () => gate.promise,
    );
    const first = controlled(1);
    const second = controlled(3);
    expect(second).toBe(first);
    gate.resolve();
    await expect(first).resolves.toBe(6);
    expect(calls).toEqual([3]);
    expect(observed).toEqual(["start", "delay", "running", "reset"]);
  });

  test("timer rejection fails the call and releases delay throttle for retry", async () => {
    let attempt = 0;
    const controlled = throttle(
      (value: number) => value,
      { mode: "delay", ms: 1 },
      () => (++attempt === 1 ? Promise.reject(new Error("timer failed")) : Promise.resolve()),
    );
    await expect(controlled(1)).rejects.toThrow("timer failed");
    await expect(controlled(2)).resolves.toBe(2);
  });

  test("urgent throttle holds one result through cooldown and then resets", async () => {
    const cooldowns: Array<ReturnType<typeof createDeferred<void>>> = [];
    const calls: number[] = [];
    const controlled = throttle(
      async (value: number) => (calls.push(value), value * 2),
      { mode: "urgent", ms: 10 },
      () => {
        const deferred = createDeferred<void>();
        cooldowns.push(deferred);
        return deferred.promise;
      },
    );
    const first = controlled(2);
    expect(controlled(9)).toBe(first);
    await expect(first).resolves.toBe(4);
    expect(calls).toEqual([2]);
    cooldowns[0]?.resolve();
    await Promise.resolve();
    const next = controlled(5);
    await expect(next).resolves.toBe(10);
    expect(calls).toEqual([2, 5]);
    cooldowns[1]?.resolve();
  });

  test("tracks overlapping activity without an early inactive transition", async () => {
    const states: boolean[] = [];
    const tracker = new ActivityTracker((active) => states.push(active));
    const first = createDeferred<void>();
    const second = createDeferred<void>();
    tracker.track(first.promise);
    tracker.track(second.promise);
    first.resolve();
    await Promise.resolve();
    expect(tracker.active).toBe(true);
    second.resolve();
    await tracker.idle();
    expect(tracker.active).toBe(false);
    expect(states).toEqual([true, false]);
  });

  test("debounce keeps the latest arguments and exposes cancellation", () => {
    const calls: number[] = [];
    let scheduled: (() => void) | undefined;
    const cancelled = new Set<unknown>();
    const scheduler = {
      clear: (handle: unknown) => cancelled.add(handle),
      set: (callback: () => void) => {
        scheduled = callback;
        return Symbol("timer");
      },
    };
    const controlled = debounce((value: number) => calls.push(value), 50, scheduler);
    controlled(1);
    controlled(3);
    scheduled?.();
    expect(calls).toEqual([3]);
    controlled(5);
    controlled.cancel();
    expect(cancelled.size).toBeGreaterThan(0);
  });

  test("returns boundary fallbacks without hiding successful values", async () => {
    await expect(boundary(() => 7, 0)).resolves.toBe(7);
    await expect(boundary(() => Promise.reject(new Error("x")), (error) => (error instanceof Error ? error.message : "unknown"))).resolves.toBe("x");
  });
});
