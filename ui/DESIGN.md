---
version: alpha
name: Cortex Console
description: Design system for the Cortex local observability console — watch, control and understand your agents, IA and Hermes in real time. Derived from 10 reference dashboards (Orchestra, Synqra, JunoMind, Agentic UI, Recent Executions, Agent Timestamp, Cost Breakdown, Logistics, +2).
colors:
  primary: "#4F46E5"
  primary-hover: "#4338CA"
  success: "#16A34A"
  warning: "#D97706"
  error: "#DC2626"
  info: "#2563EB"
  running: "#0EA5E9"
  bg: "#F5F6F8"
  surface: "#FFFFFF"
  border: "#E5E7EB"
  text: "#111827"
  text-muted: "#6B7280"
typography:
  h1:
    fontFamily: Inter
    fontSize: 1.75rem
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  h2:
    fontFamily: Inter
    fontSize: 1.25rem
    fontWeight: 600
    lineHeight: 1.3
  body-md:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.04em"
  mono:
    fontFamily: "JetBrains Mono"
    fontSize: 0.8125rem
    fontWeight: 400
rounded:
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.sm}"
    padding: 10px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  badge-success:
    backgroundColor: "#DCFCE7"
    textColor: "{colors.success}"
    rounded: "{rounded.sm}"
  badge-warning:
    backgroundColor: "#FEF3C7"
    textColor: "{colors.warning}"
    rounded: "{rounded.sm}"
  badge-error:
    backgroundColor: "#FEE2E2"
    textColor: "{colors.error}"
    rounded: "{rounded.sm}"
  badge-running:
    backgroundColor: "#E0F2FE"
    textColor: "{colors.running}"
    rounded: "{rounded.sm}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: 20px
  sidebar:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-muted}"
  toggle-on:
    backgroundColor: "{colors.success}"
  toggle-off:
    backgroundColor: "{colors.border}"
  progress-track:
    backgroundColor: "{colors.border}"
  progress-fill:
    backgroundColor: "{colors.primary}"
---

# Overview

Cortex Console is the local observability surface for the Cortex governance runtime. It lets drix **watch, control, understand and audit** agents, IA and Hermes in real time — with full mission history.

Tone: *precise, calm, trustworthy.* Technical credibility without coldness. The console is not a toy; it is the window onto a governed runtime (bundles, checks, closure).

**Governance tie-in (the differentiator).** The 3 closure states of INV-006 map directly onto status colors, so the UI *means* something:
- `LIVRAISON_AUTONOME` → **success (green)**
- `AVEC_INFORMATION` → **warning (amber)**
- `ESCALADE_HUMAINE` → **error (red)**

Real-time data is fed by the existing NDJSON ledger (`runtime/event-store.mjs`) — no kernel change needed to "see live".

# Colors

- **Primary (#4F46E5):** Cortex indigo. The only high-emphasis interaction color (primary buttons, active nav, links).
- **Success (#16A34A):** autonomous delivery, agent active, complete.
- **Warning (#D97706):** needs human information, threshold 60–85%.
- **Error (#DC2626):** escalation required, failed, threshold >85%.
- **Info / Running (#2563EB / #0EA5E9):** navigation accents, in-progress states.
- **Neutrals:** bg `#F5F6F8` (light gray canvas), surface `#FFFFFF` (cards), border `#E5E7EB`, text `#111827`, muted `#6B7280`.

# Typography

Inter for everything (matches all 10 references). JetBrains Mono for ledger hashes, IDs, technical values. Large bold numbers for KPIs (the "big stat" pattern seen in JunoMind / Synqra / Agentic UI). Labels are uppercase tracked (`letterSpacing: 0.04em`) for section eyebrows and badge text.

# Layout

- **Left sidebar** (224px): logo + grouped nav in ALL-CAPS groups — `MONITOR` (Dashboard, Activity, Live, History), `ORCHESTRATE` (Agents, Missions, Playbooks), `DELEGATE` (Integrations, Events), `ANALYTICS` (Reports, Cost, Usage). Active item = light-gray pill + primary text.
- **Top bar:** page title left; search + Filters + primary `+ New` / `+ Run Mission` right.
- **Main:** KPI summary row (3–4 cards) → toolbar (view toggle grid/table, refresh) → content grid or table.
- **Content density:** cards max 3-up on desktop, table for dense agent lists (JunoMind pattern).

# Elevation & Depth

Single soft shadow language: `0 1px 3px rgba(17,24,39,0.08)` on cards; `0 4px 12px rgba(17,24,39,0.10)` on hover/overlays. No heavy drop shadows — flat, calm, "floating white cards on gray" (Agentic UI / Synqra look).

# Shapes

Rounded corners throughout: `lg` (12px) for cards/containers, `md` (8px) for inner blocks, `sm` (6px) for buttons/badges/toggles. Consistent radius = cohesive feel.

# Components

- **Sidebar nav group:** uppercase label + items; active = `surface` pill, primary text.
- **Card:** white, `lg` radius, 20px padding, soft shadow. Header (title + optional status badge), body (stats / description), footer (Last Run / integrations / toggle).
- **Stat:** label (muted, uppercase) + big number (h1 weight). Pairs laid out horizontally.
- **Badge:** pill, color-coded (success/warning/error/running). Maps to closure states.
- **Toggle:** `success` fill = on/active, `border` gray = off/paused.
- **Progress bar:** track `border`; fill color **threshold-coded** — green <60%, amber 60–85%, red >85% (Synqra token-balance pattern, reused for budget/cost).
- **Integration icons:** horizontal row of small brand glyphs.
- **Table:** columns checkbox · NAME · ROLE · STATUS(badge) · CONFIDENCE · LAST INPUT · ETA · PROJECT · actions. Row hover = subtle `bg`.
- **KPI summary card:** big metric + delta vs last week (green up / red down).
- **Execution history list:** time · icon+name · status badge (Recent Executions pattern), fed by `events.ndjson`.
- **Button primary:** indigo solid; hover = `primary-hover`.

# Do's and Don'ts

**Do**
- Map every status to the INV-006 closure color (green/amber/red) — never invent a 4th meaning.
- Use the ledger (`events.ndjson`) as the single live data source for Activity / History / Live.
- Keep cards white-on-gray, flat, rounded. Calm > busy.
- Show "Last Run" / live timestamps everywhere an agent is listed.

**Don't**
- Don't use red for anything other than escalation/failure (reserve error semantics).
- Don't overload a card: 1 status badge + 2 stat columns + 1 footer line max.
- Don't break the grid/table view toggle — dense lists need the table.
- Don't hardcode colors in components; always reference tokens so the palette stays single-source.
