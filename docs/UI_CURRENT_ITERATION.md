# UI Current Iteration

## Phase

Phase 1 — component extraction and dashboard view-model.

## Objective

Refactor the current dashboard code into focused React components and introduce a stable dashboard view-model without intentionally changing the approved visual result.

## Required output

Create or move toward this structure:

```text
web/src/components/dashboard/
├── MissionHeader.jsx
├── MissionTabs.jsx
├── MissionSummary.jsx
├── ExecutionCanvas.jsx
├── ExecutionNode.jsx
├── ProcessInspector.jsx
├── EventDock.jsx
├── TerminalPanel.jsx
└── HealthPanel.jsx

web/src/lib/dashboard-view-model.js
```

The view-model should expose a stable shape similar to:

```js
{
  mission,
  summary,
  graph: {
    nodes,
    edges,
    selectedNodeId,
  },
  inspector,
  events,
  health,
}
```

## Allowed

- Extract existing JSX into components.
- Move static graph configuration out of `App.jsx`.
- Add small helpers and prop types or runtime guards.
- Normalize current ledger data into a view-model.
- Preserve current placeholder values where necessary, but centralize and label them.

## Forbidden

- Do not redesign the dashboard.
- Do not change typography, spacing, colors, node geometry, or layout intentionally.
- Do not touch backend or runtime files.
- Do not replace `useLedger`.
- Do not add a new graph library during this phase.
- Do not implement the UI audit recommendations yet.

## Acceptance criteria

- `App.jsx` becomes orchestration-only and substantially smaller.
- The dashboard remains visually equivalent at the reference desktop viewport.
- Existing node selection still works.
- Existing ledger events still populate the dock.
- `npm run build` passes from `web/`.
- GitHub Actions produces a real Chromium screenshot.
- No unintended visual regression is visible compared with the current `main` screenshot.

## Review checklist

- No UI redesign hidden inside the refactor.
- No operational data invented inside presentation components.
- No import cycles.
- Components have narrow responsibilities.
- The view-model is pure and testable.
- Diff remains local and auditable.