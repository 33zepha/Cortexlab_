# Cortex Lab UI Decisions

This file records durable product and visual decisions. Keep entries concise. Do not use it as a task list.

## 2026-08-04 — Cortex Lab role

Cortex Lab is a read-only supervision surface. Missions are initiated from external interfaces such as Hermes, Discord, terminal, mobile, or another client.

## 2026-08-04 — Approved dashboard structure

The accepted desktop structure is:

- persistent application sidebar;
- mission header and local tabs;
- left mission summary;
- central execution graph;
- right process inspector;
- lower event/terminal dock;
- right system-health panel.

This structure may be refined but must not be replaced without explicit approval.

## 2026-08-04 — Visual source of truth

The `UI visual proof` GitHub Action builds the React application and captures a real Chromium screenshot. That screenshot, not a mockup or CSS inspection, is the visual proof used for review.

## 2026-08-04 — Current UI baseline

The dashboard rebuilt from the approved reference was merged into `main` through PR #7. The previous `agent/clinical-agentic-dashboard` direction was closed as superseded and must not be used as a base.

## 2026-08-04 — Improvement strategy

Improvements are incremental:

1. component architecture and view-model;
2. live versus placeholder data separation;
3. typography and readability;
4. node grammar;
5. edge grammar;
6. inspector simplification;
7. lower dock behavior;
8. mission summary;
9. system health semantics;
10. interaction safety and accessibility;
11. responsive behavior;
12. Cortex-specific visual identity.

Only one defect family should be intentionally changed per visual iteration.