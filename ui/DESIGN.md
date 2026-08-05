---
version: alpha
name: Cortex Console
description: Design system for the Cortex local observability console — watch, control and understand your agents, IA and Hermes in real time. Derived from 10 reference dashboards (Orchestra, Synqra, JunoMind, Agentic UI, Recent Executions, Agent Timestamp, Cost Breakdown, Logistics, +2).
colors:
  primary: "#0B725D"
  primary-hover: "#075344"
  success: "#16A34A"
  warning: "#D48A2C"
  error: "#D75252"
  info: "#5872C5"
  running: "#0B725D"
  bg: "#F6F8F6"
  sidebar: "#FBFCFB"
  surface: "#FFFFFF"
  sub-surface: "#F8FAF9"
  border: "#E3E8E4"
  border-strong: "#C8D2CB"
  text: "#17231E"
  text-muted: "#728078"
typography:
  # Six steps, four weights (400/500/600/700 — the only Inter static
  # weights actually loaded). No in-between values like 650 or 720:
  # arbitrary weights just snap to the nearest loaded one, so precision
  # there is fake. See web/src/styles/index.css :root for the --fs-* tokens.
  xl:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.03em"
  lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: 600
    lineHeight: 1.3
  base:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.5
  sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.5
  xs:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: 400
    lineHeight: 1.4
  eyebrow:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.05em"
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: 11px
    fontWeight: 400
rounded:
  xs: 6px
  sm: 8px
  md: 10px
  lg: 14px
  xl: 20px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
shadow:
  # Layered — a hairline plus a soft ambient blur, never a single flat
  # shadow and never a dark halo. See --shadow-* tokens.
  xs: "0 1px 2px rgba(23,35,30,.05)"
  sm: "0 1px 2px rgba(23,35,30,.04), 0 6px 16px rgba(23,35,30,.05)"
  md: "0 2px 4px rgba(23,35,30,.05), 0 14px 32px rgba(23,35,30,.08)"
  lg: "0 8px 16px rgba(23,35,30,.06), 0 28px 56px rgba(23,35,30,.12)"
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
    borderColor: "{colors.border}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: 20px
  sidebar:
    backgroundColor: "{colors.sidebar}"
    borderColor: "{colors.border}"
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

- **Primary (#0B725D):** Cortex jade. The only high-emphasis interaction color (primary buttons, active nav, links, running state). No purple, no indigo — jade is the single accent.
- **Success (#16A34A):** autonomous delivery, agent active, complete.
- **Warning (#D48A2C):** needs human information, waiting for intervention — orange is reserved for this meaning only.
- **Error (#D75252):** escalation required, failed, destructive action — red is reserved for this meaning only.
- **Info (#5872C5):** discreet navigation/informational accents only, never a dominant color.
- **Neutrals — a layered stack, not one flat wash.** Four surface values that must stay
  distinguishable: canvas `#F6F8F6` (broken-white, slightly mineral) → sidebar `#FBFCFB` → surface `#FFFFFF` (cards) →
  sub-surface `#F8FAF9` (blocks nested *inside* a card). Borders carry the separation:
  `#DDE4DF` default, `#C8D2CB` for emphasis (hover, selected, dividers that must read).
  Text `#17231E` (graphite), muted `#728078` — muted stays legible, never a pale gray.
  No black backgrounds anywhere, including technical/terminal surfaces.

# Typography

Inter for everything (matches all 10 references), loaded at exactly four static weights (400/500/600/700) — never specify a weight outside that set, it will just snap to the nearest one. System monospace stack (`ui-monospace, SFMono-Regular, Menlo`) for ledger hashes, IDs, technical values — no extra webfont for it. Large bold numbers for KPIs (the "big stat" pattern seen in JunoMind / Synqra / Agentic UI). Uppercase tracking (`letterSpacing: 0.05em`, the `eyebrow` step) is for section labels and badges only — navigation and other reading text stay sentence-case, since micro-uppercase labels are hard to scan.

# Layout

- **Left sidebar** (224px), grouped by daily task, not by concept — `Control` (Overview,
  Missions, Agents, Approvals), `Observe` (Activity, Ledger, Usage), `System` (Rules,
  Connections, Settings). Every item carries an icon; counts sit right-aligned on the
  items that have one. Group labels are sentence-case and legible, never micro-uppercase.
  Active item = white surface pill with border + primary text and icon.
  **Only render destinations that are built** — a nav of dead links reads as a template.
  The full IA lives in the nav config behind a `built` flag; flip it when the view ships.
- **Sidebar header:** wordmark + live runtime state (`● Runtime online`, driven by the SSE
  connection). **Footer:** live readouts (missions 24h, pending approvals, last run) —
  state, visually distinct from navigation.
- **Top bar:** page title left; search + Filters right. Missions start elsewhere (Hermes,
  Discord, terminal) — the Console observes, so there is no "+ Run Mission" action here.
- **Main:** KPI summary row (3–4 cards) → toolbar (view toggle grid/table, refresh) → content grid or table.
- **Content density:** cards max 3-up on desktop, table for dense agent lists (JunoMind pattern).

# Elevation & Depth

**Borders do the work, shadows are a whisper.** Every card, panel and nested block
carries a 1px `border` — that is what creates the cut. Shadows are layered (a 1px
hairline plus a soft ambient blur) instead of one flat blur, and stay nearly invisible
at rest: `shadow.xs` (`0 1px 2px rgba(23,35,30,.05)`) on resting cards. Floating
elements (canvas toolbar, node cards, dropdowns) step up to `shadow.sm`/`shadow.md`.
Only true overlays (drawer, mobile sheet) use `shadow.lg`. Never a dark halo. Hover
raises the *border* to `border-strong` before it grows the shadow.

# Shapes

One consistent radius scale, no one-off values: `xl` (20px) for large overlays/sheets,
`lg` (14px) for cards/panels/containers, `md` (10px) for node cards and nested blocks,
`sm` (8px) for buttons/inputs/badges, `xs` (6px) for tiny chips and dots. Every
component maps to one of these five — that consistency is what reads as "finished"
rather than "template".

# Components

- **Sidebar nav group:** sentence-case label + icon-led items with optional count; active =
  `surface` pill with border, primary text and icon.
- **Card:** white, `lg` radius, 20px padding, soft shadow. Header (title + optional status badge), body (stats / description), footer (Last Run / integrations / toggle).
- **Stat:** label (muted, uppercase) + big number (h1 weight). Pairs laid out horizontally.
- **Badge:** pill, color-coded (success/warning/error/running). Maps to closure states.
- **Toggle:** `success` fill = on/active, `border` gray = off/paused.
- **Progress bar:** track `border`; fill color **threshold-coded** — green <60%, amber 60–85%, red >85% (Synqra token-balance pattern, reused for budget/cost).
- **Integration icons:** horizontal row of small brand glyphs.
- **Table:** columns checkbox · NAME · ROLE · STATUS(badge) · CONFIDENCE · LAST INPUT · ETA · PROJECT · actions. Row hover = subtle `bg`.
- **KPI summary card:** big metric + delta vs last week (green up / red down).
- **Execution history list:** time · icon+name · status badge (Recent Executions pattern), fed by `events.ndjson`.
- **Button primary:** jade solid; hover = `primary-hover`.

# Do's and Don'ts

**Do**
- Map every status to the INV-006 closure color (green/amber/red) — never invent a 4th meaning.
- Use the ledger (`events.ndjson`) as the single live data source for Activity / History / Live.
- Keep cards white-on-gray, flat, rounded. Calm > busy.
- Give every card, panel and nested block a visible 1px border — separation comes from
  edges, not from haze.
- Show "Last Run" / live timestamps everywhere an agent is listed.

**Don't**
- Don't use red for anything other than escalation/failure (reserve error semantics).
- Don't overload a card: 1 status badge + 2 stat columns + 1 footer line max.
- Don't break the grid/table view toggle — dense lists need the table.
- Don't hardcode colors in components; always reference tokens so the palette stays single-source.
- Don't lean on diffuse shadows to separate surfaces, and don't let canvas / sidebar /
  surface collapse into the same value — that flattens the whole console.
