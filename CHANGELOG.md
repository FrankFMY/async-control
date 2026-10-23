# Changelog

## 0.2.0

- Add `ContextFence` and typed, frozen context tickets for cooperative stale-result rejection.
- Reject cross-instance tickets, structural copies, old contexts and late results after disposal.
- Preserve all existing throttle, debounce, deferred, activity and boundary behavior.
- Document versioned GitHub package installation without assuming registry availability.
- Remove automatic registry release execution; verification and release remain separate operations.

## 0.1.0

- Initial public source release.
- Deferred promises, typed waits, error boundaries.
- Urgent and delayed throttle modes with fail-closed timer handling.
- Cancellable debounce with injectable scheduler.
- Overlap-safe activity tracking.
