# Async Control

Small, typed async-control primitives for TypeScript with explicit failure and concurrency semantics.

I built this library for application code that needs predictable throttling, debouncing, externally controlled promises, overlapping activity tracking, bounded delays, and narrow error boundaries without pulling in a utility framework.

## What is included

- `createDeferred()` — externally resolve or reject a typed promise;
- `wait()` — bounded delay with a typed `WaitError` rejection mode;
- `throttle()` — urgent or delayed execution with shared-promise semantics;
- `debounce()` — latest-arguments execution with explicit cancellation;
- `ActivityTracker` — accurate active/idle state across overlapping promises;
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

## Testability

`throttle()` and `debounce()` accept injected timer/scheduler adapters. Tests can control timing without real sleeps or global fake timers.

## Package status

The GitHub repository is public. Registry publication is intentionally deferred; the npm package remains marked private until a separate release gate is completed.

## Development

```bash
git clone https://github.com/FrankFMY/async-control.git
cd async-control
bun install --frozen-lockfile
bun run verify
```

## Author

**Artem Prianishnikov**

- GitHub: https://github.com/FrankFMY
- Website: https://frankfmy.com
- Email: Pryanishnikovartem@gmail.com

## License

MIT © 2026 Artem Prianishnikov. See [LICENSE](LICENSE).
