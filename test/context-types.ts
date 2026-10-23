import { ContextFence, type ContextTicket } from "../src/index.js";

export const compile_context_contract = (): void => {
  const strings = new ContextFence("first");
  const valid: ContextTicket<string> = strings.capture();
  strings.accepts(valid);
  strings.set("second");

  // @ts-expect-error A mutable fence must not widen through a union alias.
  const wider: ContextFence<string | number> = strings;
  const union = new ContextFence<string | number>("first");
  // @ts-expect-error A mutable union fence must not narrow to a string-only fence.
  const narrower: ContextFence<string> = union;
  void wider;
  void narrower;

  // @ts-expect-error A string context cannot be replaced with a number.
  strings.set(1);
  // @ts-expect-error Context types remain part of the ticket contract.
  strings.accepts(new ContextFence(1).capture());
  // @ts-expect-error Ticket context cannot be reassigned.
  valid.context = "changed";
};
