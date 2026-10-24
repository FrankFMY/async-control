# Async Control

Small, typed async-control primitives for TypeScript with explicit failure and concurrency semantics.

I built this library for application code that needs predictable throttling, debouncing, externally controlled promises, overlapping activity tracking, bounded delays, and narrow error boundaries without pulling in a utility framework.

## What is included

- `createDeferred()` — externally resolve or reject a typed promise;
- `wait()` — bounded delay with a typed `WaitError` rejection mode;
- `throttle()` — urgent or delayed execution with shared-promise semantics;
- `debounce()` — latest-arguments execution with explicit cancellation;
- `ActivityTracker` — accurate active/idle state across overlapping promises;
- `ContextFence` — same-instance tickets that reject stale results after context changes or disposal;
- `boundary()` — convert sync/async failures into a value or fallback function.

## Throttle semantics

### Urgent mode

- the first call captures and executes its own arguments;
- calls during execution/cooldown receive the same promise;
- the cooldown begins after success or failure;
- timer failure cannot leave the throttle permanently locked.

### Delay mode

- the first call starts one delay window;
- later calls update the arguments but receive the same promise;
- the operation executes once with the latest arguments;
- operation or timer failure rejects the shared promise and releases the throttle.

```ts
import { throttle } from "@frankfmy/async-control";

const save = throttle(
  async (value: string) => persist(value),
  { mode: "delay", ms: 250 },
);

const first = save("draft-1");
const second = save("draft-2");

first === second; // true
await second; // persists draft-2 once
```

## Debounce

```ts
import { debounce } from "@frankfmy/async-control";

const updateQuery = debounce((query: string) => runSearch(query), 200);
updateQuery("a");
updateQuery("ab");
updateQuery("abc");

updateQuery.cancel();
```

## Activity tracking

```ts
import { ActivityTracker } from "@frankfmy/async-control";

const tracker = new ActivityTracker((active) => {
  console.log(active ? "busy" : "idle");
});

tracker.track(fetch("/first"));
tracker.track(fetch("/second"));
await tracker.idle();
```

The tracker becomes idle only after every currently tracked promise settles. Observing a promise does not suppress its rejection for the original caller.

## Context freshness

```ts
import { ContextFence } from "@frankfmy/async-control";

const context = new ContextFence("document-a");
const ticket = context.capture();
const pending = Promise.resolve({ title: "Draft" });

context.set("document-b");
const result = await pending;
if (context.accepts(ticket)) {
  console.log(result); // Not reached: the result belongs to the earlier context.
}
context.dispose();
```

`capture()` returns a frozen ticket. `set(next)` compares contexts with `Object.is`:
an equal key keeps the current ticket, while changing away and back never revives an
old ticket. `invalidate()` creates a fresh ticket without changing the key. `accepts()`
requires the exact current object from the same fence; another fence's ticket or a
structural copy is rejected. `dispose()` is terminal and idempotent: it releases the
fence's context reference, rejects every ticket, and makes capture/set/invalidate throw.

Use stable primitive keys where possible. Object contexts are compared by identity and
held by reference: they are neither cloned nor deeply frozen, and mutating an object does
not invalidate its ticket. This is cooperative freshness coordination, not cancellation,
authentication, a wire protocol or a security capability. Check a ticket immediately
before applying a result; another `await` creates another opportunity for context change.
Existing async primitives retain their previous behavior.

## Testability

`throttle()` and `debounce()` accept injected timer/scheduler adapters. Tests can control timing without real sleeps or global fake timers.

## Install from npm

Version **0.2.3** is available as
[@frankfmy/async-control on npm](https://www.npmjs.com/package/@frankfmy/async-control).

```sh
npm install @frankfmy/async-control@0.2.3
```

The older, immutable **v0.2.2** archive remains an alternative in
[GitHub releases](https://github.com/FrankFMY/async-control/releases).
It is a different version from npm 0.2.3. Download and verify it before installing:

```bash
curl --fail --location --output frankfmy-async-control-0.2.2.tgz \
  https://github.com/FrankFMY/async-control/releases/download/v0.2.2/frankfmy-async-control-0.2.2.tgz &&
curl --fail --location --output SHA256SUMS \
  https://github.com/FrankFMY/async-control/releases/download/v0.2.2/SHA256SUMS &&
sha256sum --check SHA256SUMS &&
npm install ./frankfmy-async-control-0.2.2.tgz
```

As of npm 12, direct URL dependencies are disabled by default. Downloading the
archive and checking its SHA-256 first works without changing that policy.
Verify that the checksum command succeeds before installing. On platforms without
`sha256sum`, use an equivalent SHA-256 verifier against the downloaded listing.

Alternatively, clone the repository, build it using the commands below, then run
`npm pack` and install the resulting tarball in your own project. The package is
configured for public npm distribution; verification does not publish it.

## Development

```bash
git clone https://github.com/FrankFMY/async-control.git
cd async-control
bun install --frozen-lockfile
bun run verify
```

## Continuous integration

[CI runs](https://github.com/FrankFMY/async-control/actions/workflows/ci.yml) run on
pull requests, pushes to `main`, and manual dispatch. They use Node 24.20.0 and
Bun 1.4.2 for the full `bun run verify` gate, including independent installed
Node/Bun consumers and positive/negative types, plus a dependency audit.
Logs are retained for seven days. This workflow does not publish packages.

## Author and contact

Created and maintained by [Artem Prianishnikov (Артем Прянишников / FrankFMY)](https://github.com/FrankFMY).

- Email: [Pryanishnikovartem@gmail.com](mailto:Pryanishnikovartem@gmail.com)
- Telegram: [@FrankFMY](https://t.me/FrankFMY)
- Website: [frankfmy.com](https://frankfmy.com)
- Profiles: [GitHub](https://github.com/FrankFMY) · [LinkedIn](https://www.linkedin.com/in/frankfmy/) · [X](https://x.com/FrankFMY)


## License

MIT © 2026 Artem Prianishnikov. See [LICENSE](LICENSE).
