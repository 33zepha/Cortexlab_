# Cortex Lab

![state](https://img.shields.io/badge/state-WIP-yellow)
![tests](https://img.shields.io/badge/tests-13%2F13%20passing-brightgreen)
![node](https://img.shields.io/badge/node-%3E%3D18-9cf)

> 🚧 work-in-progress — an open workshop where AI agents stop improvising
> and start working as one disciplined team.

Cortex Lab is where AI agents stop improvising and start working as a
single disciplined team. The point isn't to tell them what to build —
it's to lay down, quietly, the guardrails that keep them aligned,
accountable, and trustworthy.

No magic. Just order, built patiently.

## what we're after

- agents that **respect the frame** instead of bending around it
- execution you can **trace** — every decision justified
- a clear line between *allowed* and *off-limits* — never blurry

## where we stand

| state | what's alive                          |
| ----- | ------------------------------------- |
| done  | the minimal core runs, its tests pass |
| wip   | interface + advanced guardrails       |
| next  | adaptive loop, then multi-team        |

## take a closer look

The lab is alive on this branch. To feel the engine without breaking
it open:

```bash
npm install
npm test     # the minimal contract is locked by tests
```

Curious minds will find design notes under `docs/` — though it's still
under construction.

## the console

A live dashboard watches Hermes work in real time — agents, missions,
budgets, closures — straight from the event ledger.

```bash
node server/index.mjs --port 4173   # backend: API + SSE + mission runner

cd web
npm install
npm run build                       # or `npm run dev` for hot reload (proxies /api to :4173)
```

Then open `http://localhost:4173`.

## build with us

Open an issue, send a PR, or just hang around. Fresh eyes welcome.

---

*cortex lab — a workshop, not a manifesto.*
