# Contributing

Async Control is maintained by Artem Prianishnikov.

Behavior changes require a RED then GREEN test covering promise identity, argument ownership, failure propagation, reset semantics, and timer behavior where applicable. Run `bun run verify` before submitting a change.
