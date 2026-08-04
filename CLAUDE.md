# Cortex Lab — Claude Code Rules

Cortex Lab is a read-only supervision interface for an agentic runtime.
It is not a chat, not the primary mission entry point, and not a generic SaaS dashboard.

## Product invariants

- The execution graph is the visual priority.
- The dashboard observes missions started elsewhere: Hermes, Discord, terminal, mobile, or another interface.
- Preserve `useLedger` and the existing data flow.
- Do not touch `backend/` or `runtime/` during UI-only work unless explicitly requested.
- Never invent operational data without marking it as `PLACEHOLDER`, `ESTIMATED`, or `DERIVED`.
- Do not replace the approved three-column architecture without explicit approval.
- Prefer small, auditable diffs over broad rewrites.
- The browser screenshot produced by GitHub Actions is the visual source of truth.

## Approved dashboard architecture

- Left: mission summary.
- Center: execution canvas and lower dock.
- Right: selected-process inspector and system health.
- Lower dock: events, terminal, ledger, artifacts, decisions.

## Visual direction

- Light broken-white background.
- Jade, anthracite, neutral grays.
- Orange only for waiting, attention, or active intervention.
- Red only for actual failure or destructive action.
- No purple SaaS gradients.
- Minimal shadows, precise borders, strict spacing.
- The interface should feel like a professional instrument, not a collection of cards.

## Stable agent states

Use these exact semantic states everywhere:

- `running`
- `done`
- `waiting`
- `blocked`
- `failed`
- `queued`
- `idle`

A state must keep the same color, icon, label, and interaction behavior across the product.

## Working method

1. Read `docs/UI_HANDOFF_CLAUDE.md`.
2. Read `docs/UI_CURRENT_ITERATION.md`.
3. Inspect only files needed for the current phase.
4. Before coding, identify at most three defects and propose at most five actions.
5. Change only the current phase scope.
6. Run `npm run build` from `web/`.
7. Inspect `git diff` and `git diff --stat`.
8. Push a dedicated branch.
9. Wait for the `UI visual proof` GitHub Action.
10. Compare the real Chromium screenshot with the previous one.

## Economy rules

- Do not scan the whole repository without a concrete need.
- Do not produce long implementation summaries.
- Do not repeat project history already documented.
- Prefer targeted file reads and local patches.
- Stop and report if a phase unexpectedly requires more than 4 files or roughly 300 changed lines.

## Completion report

Keep the final report under 10 lines unless asked otherwise:

- files modified;
- build result;
- screenshot status;
- known regression;
- next verification.