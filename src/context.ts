/** A frozen ticket minted by one ContextFence. Its context is held by reference. */
export interface ContextTicket<Context> {
  readonly context: Context;
}

/**
 * Rejects stale asynchronous results after a context switch, explicit invalidation,
 * or disposal. This coordinates freshness; it does not cancel work or authenticate
 * callers. Only the exact current ticket from this fence is accepted.
 */
export class ContextFence<in out Context> {
  #ticket: ContextTicket<Context> | undefined;

  constructor(context: Context) {
    this.#ticket = Object.freeze({ context });
  }

  /** Returns the current immutable ticket. Throws after disposal. */
  capture(): ContextTicket<Context> {
    const ticket = this.#ticket;
    if (ticket === undefined) throw new Error("ContextFence is disposed");
    return ticket;
  }

  /** Changes context by Object.is identity; an equal context retains its ticket. */
  set(context: Context): void {
    if (Object.is(this.capture().context, context)) return;
    this.#ticket = Object.freeze({ context });
  }

  /** Invalidates earlier results even when the context itself has not changed. */
  invalidate(): void {
    this.#ticket = Object.freeze({ context: this.capture().context });
  }

  /** Accepts only the exact current, same-instance ticket. Never throws. */
  accepts(ticket: ContextTicket<Context>): boolean {
    return this.#ticket !== undefined && ticket === this.#ticket;
  }

  /** Terminal and idempotent. Releases the fence's reference to its context. */
  dispose(): void {
    this.#ticket = undefined;
  }
}
