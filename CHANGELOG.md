# Changelog

## 0.2.3

- Prepare public npm distribution with explicit registry and access metadata.
- Document exact registry-version checks while preserving older GitHub archive installation.
- No runtime, declaration, dependency implementation or public API changes.

## 0.2.2

- Add verified author email, Telegram and professional profile links to documentation and package metadata.
- No runtime, declaration, dependency or public API changes.


## 0.2.1

- Use verified download followed by local tarball installation in the quickstart, compatible with npm 12's default remote-dependency policy.
- No runtime or type API changes from 0.2.0.

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
