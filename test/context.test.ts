import { describe, expect, test } from "bun:test";
import { ContextFence, createDeferred } from "../src/index.js";

describe("ContextFence", () => {
  test("captures a frozen same-context ticket and preserves it for an equal context", () => {
    const fence = new ContextFence("first");
    const ticket = fence.capture();
    expect(Object.isFrozen(ticket)).toBe(true);
    expect(ticket.context).toBe("first");
    expect(fence.accepts(ticket)).toBe(true);
    fence.set("first");
    expect(fence.capture()).toBe(ticket);
    expect(fence.accepts(ticket)).toBe(true);
  });

  test("switching away and back never revives an old ticket", () => {
    const fence = new ContextFence("first");
    const first = fence.capture();
    fence.set("second");
    const second = fence.capture();
    expect(fence.accepts(first)).toBe(false);
    fence.set("first");
    expect(fence.accepts(first)).toBe(false);
    expect(fence.accepts(second)).toBe(false);
    expect(fence.accepts(fence.capture())).toBe(true);
  });

  test("explicit invalidation replaces custody without changing the context", () => {
    const fence = new ContextFence<string | null>(null);
    const ticket = fence.capture();
    fence.invalidate();
    expect(fence.capture().context).toBe(null);
    expect(fence.accepts(ticket)).toBe(false);
  });

  test("rejects tickets from another fence and structural copies", () => {
    const first = new ContextFence("same");
    const second = new ContextFence("same");
    expect(first.accepts(second.capture())).toBe(false);
    expect(first.accepts({ ...first.capture() })).toBe(false);
    expect(first.accepts(Object.freeze({ context: "same" }))).toBe(false);
  });

  test("uses Object.is context identity without deep-freezing caller data", () => {
    const context = { id: "first" };
    const fence = new ContextFence(context);
    const ticket = fence.capture();
    expect(Object.isFrozen(context)).toBe(false);
    fence.set(context);
    expect(fence.accepts(ticket)).toBe(true);
    fence.set({ id: "first" });
    expect(fence.accepts(ticket)).toBe(false);
    const numeric = new ContextFence(Number.NaN);
    const nan = numeric.capture();
    numeric.set(Number.NaN);
    expect(numeric.accepts(nan)).toBe(true);
    numeric.set(-0);
    const negativeZero = numeric.capture();
    numeric.set(0);
    expect(numeric.accepts(negativeZero)).toBe(false);
  });

  test("disposal is terminal, idempotent and releases all current custody", () => {
    const fence = new ContextFence("first");
    const ticket = fence.capture();
    fence.dispose();
    fence.dispose();
    expect(fence.accepts(ticket)).toBe(false);
    expect(() => fence.capture()).toThrow("ContextFence is disposed");
    expect(() => fence.set("second")).toThrow("ContextFence is disposed");
    expect(() => fence.invalidate()).toThrow("ContextFence is disposed");
    expect(fence.accepts(ticket)).toBe(false);
  });

  test("suppresses a resolved result after context switching, not the underlying operation", async () => {
    const fence = new ContextFence("first");
    const operation = createDeferred<string>();
    const ticket = fence.capture();
    const writes: string[] = [];
    const result = operation.promise.then((value) => {
      if (fence.accepts(ticket)) writes.push(value);
      return value;
    });
    fence.set("second");
    fence.set("first");
    operation.resolve("stale");
    expect(await result).toBe("stale");
    expect(writes).toEqual([]);
    const current = fence.capture();
    if (fence.accepts(current)) writes.push("current");
    expect(writes).toEqual(["current"]);
  });

  test("late completion after teardown cannot publish a result", async () => {
    const fence = new ContextFence("view");
    const operation = createDeferred<number>();
    const ticket = fence.capture();
    let applied = false;
    const completion = operation.promise.then(() => {
      if (fence.accepts(ticket)) applied = true;
    });
    fence.dispose();
    operation.resolve(1);
    await completion;
    expect(applied).toBe(false);
  });
});
