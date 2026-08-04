# Cortex Lab UI handoff for Claude Code

## Purpose of this document

This file explains the UI work currently merged through the `agent/dashboard-reference-rebuild` branch and the product constraints that must be preserved during the next iterations.

The current interface is an intentional baseline, not a finished design. It was rebuilt from the approved visual reference and should now be improved incrementally rather than replaced with another unrelated dashboard concept.

## Product definition

Cortex Lab is a **read-only supervision surface for an agentic operating system**.

It is not:

- a chat interface;
- the primary place where the user writes prompts;
- an n8n-style automation builder on the dashboard;
- a generic analytics dashboard;
- the execution runtime itself.

Commands originate elsewhere, for example Hermes, Discord, terminal, mobile, or another client. Cortex Lab observes the resulting missions, agents, decisions, evidence, budgets, artifacts, checks, and closures.

The separate future `Mission Blueprint` page may use a visual language inspired by n8n to present or design mission blueprints. That builder concept must not take over the main Dashboard.

## Approved dashboard architecture

The current desktop layout follows this structure:

1. Existing global sidebar.
2. Mission header with status, metadata, tabs, and bounded intervention actions.
3. Left mission summary rail.
4. Large central execution graph.
5. Right process inspector.
6. Bottom event ledger and terminal.
7. Bottom-right system-health panel.

The execution graph must remain the visual center of gravity.

## Files changed

### `web/src/App.jsx`

Rebuilt the application dashboard around the approved reference.

Main components currently defined in this file:

- `TopHeader`
- `MissionSummary`
- `SummaryMetric`
- `ExecutionCanvas`
- `Node`
- `Inspector`
- `InspectorText`
- `InspectorList`
- `BottomDock`
- `HealthPanel`

The current task graph is represented by the static `FLOW` and `CONNECTIONS` arrays. Nodes are selectable and update the inspector.

### `web/src/styles/reference-dashboard.css`

Contains the complete visual layer for this dashboard:

- layout;
- colors and design tokens;
- mission summary rail;
- graph canvas and connections;
- node styles and states;
- inspector;
- event dock;
- terminal;
- health panel;
- responsive fallback rules.

### `web/src/main.jsx`

Imports `reference-dashboard.css` after the existing styles so this new layer wins the cascade without deleting the previous styles.

## Existing data flow that must be preserved

The dashboard still uses the existing ledger client:

```js
const { agents, events, missions, summary, connected, lastSync } = useLedger()
```

It also uses:

```js
const now = useNow()
```

Do not replace this with a disconnected mock-only application.

Current dynamic data includes:

- missions;
- agents;
- event ledger;
- summary budget values;
- runtime connection state;
- last synchronization time.

## Important implementation limitation

The approved visual was reproduced before the backend exposed every required field. Several interface values are therefore currently fallback or demonstration values, including parts of:

- task graph topology;
- per-node progress;
- model labels;
- token counts;
- per-node cost and duration;
- evidence;
- dependencies;
- health metrics;
- terminal output.

Do not mistake these placeholders for the final data contract.

The preferred next architecture is to add a UI adapter that maps ledger/runtime events into a stable view model instead of spreading fallback logic through components.

Suggested shape:

```js
{
  mission,
  graph: {
    nodes,
    edges,
    selectedNodeId
  },
  inspector,
  ledger,
  health
}
```

## Interaction boundaries

Cortex Lab is read-only by default.

Allowed bounded controls may include:

- pause mission;
- stop mission;
- request review;
- approve or reject a gated step;
- change agent or model;
- adjust budget;
- inspect context, evidence, artifacts, and dependencies.

Do not add a large prompt box or primary chat composer to the Dashboard.

Sensitive actions must eventually use confirmation dialogs and show impact before execution.

## Visual proof workflow

The repository contains a GitHub Actions workflow named `UI visual proof`.

It:

1. checks out the branch;
2. installs web dependencies;
3. builds the React application;
4. installs Chromium tooling;
5. starts the preview server;
6. captures a real browser screenshot;
7. uploads the screenshot as a workflow artifact.

Use this workflow after meaningful UI changes. Do not rely only on imagined or manually reconstructed previews.

The successful baseline capture was produced by run `#38` for commit:

```text
9fc69abce5039bf774dfad2573aa6eb67c554ca1
```

## Local validation

From the repository root:

```bash
cd web
npm install
npm run build
npm run dev
```

Validate at the intended desktop width first. The current CSS assumes a wide mission-control layout and needs a deliberate laptop adaptation later.

## Current UI/UX defects already identified

These defects are documented but intentionally not corrected in the baseline merge:

1. Typography is too small in several places.
2. Visual hierarchy is too flat.
3. Graph edges are too pale and do not communicate flow type or direction strongly enough.
4. Nodes lack a mature visual grammar for agent, tool, governance, human approval, and artifact types.
5. The inspector is fragmented by too many separators.
6. The dark terminal competes with the graph for attention.
7. The left mission summary repeats information and wastes vertical space.
8. Status colors and status labels are not fully normalized.
9. Health metrics and the health chart are insufficiently explained.
10. English and French labels are mixed.
11. Several values appear precise without identifying whether they are measured, estimated, scoped, or global.
12. The desktop layout is fragile below very wide resolutions.
13. Buttons and graph toolbar controls are partly decorative and not fully wired.
14. Accessibility, keyboard navigation, focus states, hit areas, and contrast still require a dedicated pass.
15. The visual identity is mainly color-based and needs stronger Cortex-specific node, edge, icon, and motion language.

## Non-negotiable direction

Keep the approved structure. Improve it surgically.

Do not:

- rebuild the product as a generic KPI dashboard;
- remove the central execution graph;
- turn the Dashboard into a workflow editor;
- turn it into a chatbot;
- replace the data hooks with static mocks;
- modify the backend or runtime merely to solve a styling issue;
- add decorative effects without a functional meaning.

## Recommended next sequence

### Phase 1: stabilize the UI architecture

- split `App.jsx` into focused components;
- introduce a dashboard view-model adapter;
- define explicit node, edge, event, evidence, dependency, and health types;
- remove scattered placeholder logic from rendering components;
- keep the current visual output stable during this refactor.

### Phase 2: typography and hierarchy

- establish a strict type scale;
- raise minimum readable text sizes;
- normalize weights and line heights;
- use monospace only for system data;
- make mission, graph, selected process, and alert state the dominant hierarchy.

### Phase 3: graph system

- define node variants;
- define ports;
- define edge variants;
- show direction;
- highlight the selected execution path;
- distinguish mandate, dependency, artifact transfer, blocked path, and approval gate;
- add restrained state animation.

### Phase 4: inspector and dock

- regroup inspector content into execution, work, and validation sections;
- reduce separator noise;
- make the lower dock resizable and collapsible;
- reduce terminal dominance;
- wire event, artifact, ledger, and decision tabs.

### Phase 5: interaction and safety

- wire hover, selected, focus, loading, empty, blocked, and failure states;
- add confirmation flows for sensitive intervention actions;
- add keyboard navigation and accessible labels;
- ensure color is never the only state signal.

### Phase 6: responsive behavior

- wide desktop: three-column mission control;
- laptop: compact sidebar and collapsible inspector;
- tablet/mobile: simplified graph with inspector and ledger in drawers or tabs.

### Phase 7: Cortex identity

- create one coherent icon system;
- create proprietary node and connection language;
- define meaningful motion tokens;
- refine logo treatment and visual signatures without reducing clarity.

## Definition of done for each iteration

Every meaningful UI iteration should include:

- `npm run build` passing;
- real Chromium screenshot from `UI visual proof`;
- comparison with the previous screenshot;
- verification at target desktop width;
- no regression to ledger data flow;
- no new prompt/chat entry surface on the Dashboard;
- explicit note of placeholders that remain.
