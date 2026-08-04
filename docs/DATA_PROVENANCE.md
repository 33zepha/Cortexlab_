# Data Provenance — Cortex Lab Dashboard

Chaque donnée visible du dashboard est classée selon sa source réelle et sa fiabilité.

## Classification

- **LIVE** : fournie directement par le backend, runtime ou ledger via une API/SSE. Mise à jour en temps réel ou quasi-temps réel.
- **DERIVED** : calcul déterministe fondé **uniquement** sur des données LIVE. Exacte tant que les sources LIVE sont exactes.
- **ESTIMATED** : approximation fondée sur des données partielles ou imprécises. Confiance < 1.0.
- **PLACEHOLDER** : valeur illustrative, fallback fixe ou simulation sans source opérationnelle. Confiance = 0. À remplacer par des données réelles.

**Principe clé** : une valeur issue d'un index de tableau, d'un fallback fixe ou d'une simulation n'est jamais classée DERIVED.

---

## Sections du Dashboard

### `mission` (objet mission actif)

| Champ | Source | Catégorie | Confiance | Note |
|-------|--------|-----------|-----------|------|
| tout (structure complète) | `/api/missions` retourne `{ missions: [ ... ] }` ; sélection `missions[0]` ou `missions.find(status='running')` | **LIVE** si mission trouvée, **PLACEHOLDER** si absent | 1.0 (LIVE) / 0 (PLACEHOLDER) | La mission active vient directement du runtime. Si ledger vide, fallback structural : `{ id: 'MIS-UNKNOWN', name: 'Aucune mission', ... }` |

**Métadonnée unique pour toute la section** :
```js
provenance.mission = {
  kind: missions.length > 0 ? "LIVE" : "PLACEHOLDER",
  source: missions.length > 0 ? "ledger.missions[0] via /api/missions" : "fallback (no active mission)",
  updatedAt: lastSync || null,
  confidence: missions.length > 0 ? 1 : 0
}
```

---

### `summary` (rail gauche)

#### `summary.progress`

| Champ | Source | Catégorie | Confiance | Note |
|-------|--------|-----------|-----------|------|
| progress | `mission.progress` du runtime OU `clamp(62)` fallback | **LIVE** si mission présente, **PLACEHOLDER** si fallback | 1.0 (LIVE) / 0 (PLACEHOLDER) | Le runtime Cortex estime la progression via `estimateProgress(closed, rules, checks, assignments, latestType)`. Si pas de mission : fallback 62%. |

```js
provenance["summary.progress"] = {
  kind: activeMission ? "LIVE" : "PLACEHOLDER",
  source: activeMission ? "mission.progress from runtime" : "fallback (62)",
  updatedAt: activeMission ? lastSync : null,
  confidence: activeMission ? 1 : 0
}
```

#### `summary.budget`

| Champ | Source | Catégorie | Confiance | Note |
|-------|--------|-----------|-----------|------|
| cost | `ledger.summary.budget_cost` OU fallback `2.5` | **LIVE** / **PLACEHOLDER** | 1.0 / 0 | /api/missions retourne summary.budget_cost. Si absent : fallback 2.5. |
| limit | `ledger.summary.budget_limit` OU fallback `5.0` | **LIVE** / **PLACEHOLDER** | 1.0 / 0 | Idem, fallback 5.0. |
| percent | Calcul `(cost/limit)*100` OU fallback `50` | **DERIVED** (si LIVE) / **PLACEHOLDER** | 1.0 (si LIVE) / 0 (si fallback) | Déterministe. Si les deux sources sont LIVE, c'est DERIVED. Si l'une est PLACEHOLDER, la pct est PLACEHOLDER. |

**Métadonnée mixte** (cost et limit peuvent avoir sources différentes) :
```js
const isBudgetCostLive = summary.budget_cost != null
const isBudgetLimitLive = summary.budget_limit != null
const isBudgetLive = isBudgetCostLive && isBudgetLimitLive

provenance["summary.budget"] = {
  kind: isBudgetLive ? "LIVE" : (isBudgetCostLive || isBudgetLimitLive ? "DERIVED" : "PLACEHOLDER"),
  source: isBudgetLive ? "ledger.summary.budget_* via /api/missions" : "fallback (2.5 / 5.0)",
  updatedAt: isBudgetLive ? lastSync : null,
  confidence: isBudgetLive ? 1 : 0
}
```

#### `summary.tokens`

| Champ | Source | Catégorie | Confiance | Note |
|-------|--------|-----------|-----------|------|
| used | Hardcoded `'1.24M'` | **PLACEHOLDER** | 0 | Aucune source opérationnelle. Sera exposée quand le runtime trackera les tokens. |
| limit | Hardcoded `'3M'` | **PLACEHOLDER** | 0 | Idem. |
| percent | Hardcoded `41` | **PLACEHOLDER** | 0 | Idem. |

```js
provenance["summary.tokens"] = {
  kind: "PLACEHOLDER",
  source: "hardcoded (no runtime source yet)",
  updatedAt: null,
  confidence: 0
}
```

#### `summary.activeAgent`

| Champ | Source | Catégorie | Confiance | Note |
|-------|--------|-----------|-----------|------|
| premier agent actif ou fallback | `ledger.agents[0]` OU `{ name: 'unknown', role: 'unassigned' }` | **LIVE** si agents[], **PLACEHOLDER** si fallback | 1.0 / 0 | /api/agents retourne la liste. Affiche le premier. Si vide : fallback. |

```js
provenance["summary.activeAgent"] = {
  kind: agents.length > 0 ? "LIVE" : "PLACEHOLDER",
  source: agents.length > 0 ? "ledger.agents[0] via /api/agents" : "fallback",
  updatedAt: agents.length > 0 ? lastSync : null,
  confidence: agents.length > 0 ? 1 : 0
}
```

---

### `graph` (canvas d'exécution)

#### FLOW (9 nœuds statiques) et CONNECTIONS

| Champ | Source | Catégorie | Confiance | Note |
|-------|--------|-----------|-----------|------|
| FLOW array (hermes, planner, research, ...) | Hardcoded dans dashboard-view-model.js | **PLACEHOLDER** | 0 | Topologie statique. Le runtime n'expose pas la structure graphique de la mission. Phase 2d : implémenter `/api/missions/{id}/topology`. |
| CONNECTIONS array (12 edges) | Hardcoded | **PLACEHOLDER** | 0 | Idem. |

#### Nodes (states et progressLabels)

| Champ | Source | Catégorie | Confiance | Note |
|-------|--------|-----------|-----------|------|
| `nodes[].state` (done/running/waiting/queued) | Fonction `statusFor(nodeId, index, selectedNodeId)` : déterministe basée sur index + sélection | **PLACEHOLDER** | 0 | Simulation pure. Node 3 est "running" si sélectionné, sinon état par index. Aucun lien avec l'exécution réelle. Phase 2d : mapper événements → états vrais. |
| `nodes[].progressLabel` (100%, 80%, 40%, En attente) | Fonction `progressLabelFor(state)` : pure, basée sur état factice | **PLACEHOLDER** | 0 | Dépend de statusFor. Simulation. |

```js
provenance.graph = {
  kind: "PLACEHOLDER",
  source: "hardcoded FLOW/CONNECTIONS arrays + statusFor simulation",
  updatedAt: null,
  confidence: 0
}
```

---

### `inspector` (panneau droit, détails du nœud sélectionné)

| Champ | Source | Catégorie | Confiance | Note |
|-------|--------|-----------|-----------|------|
| item | Nœud sélectionné de FLOW array | **PLACEHOLDER** | 0 | Topologie PLACEHOLDER. |
| state | Hardcoded `'running'` | **PLACEHOLDER** | 0 | Simulation. |
| progress | Hardcoded `80` | **PLACEHOLDER** | 0 | Simulation. |
| duration | Hardcoded `'1h 24m 17s'` | **PLACEHOLDER** | 0 | Pas de source opérationnelle. |
| cost | Hardcoded `'€0.18'` | **PLACEHOLDER** | 0 | Pas de cost per-node dans runtime. |
| tokens | Hardcoded `'243,672'` | **PLACEHOLDER** | 0 | Pas de tokens per-node. |
| model | Hardcoded `'Claude 3.5 Sonnet'` | **PLACEHOLDER** | 0 | Devrait venir de `mission.agents[].model` ou événement. |
| mandate | Hardcoded long French text | **PLACEHOLDER** | 0 | Pas structuré. |
| context (3 items) | Hardcoded tuples | **PLACEHOLDER** | 0 | Pas dans runtime. |
| contextTokens | Hardcoded `'3,240 tokens'` | **PLACEHOLDER** | 0 | Pas exposé. |
| evidence (3 items) | Hardcoded | **PLACEHOLDER** | 0 | Pas dans runtime (checks existent mais pas structurés comme preuve). |
| dependencies (2 items) | Hardcoded | **PLACEHOLDER** | 0 | Pas exposé. |

**Total: 11 champs + 6 array items, tous PLACEHOLDER.**

```js
provenance.inspector = {
  kind: "PLACEHOLDER",
  source: "hardcoded values in view-model (no per-node runtime data)",
  updatedAt: null,
  confidence: 0
}
```

---

### `events` (journal inférieur)

| Champ | Source | Catégorie | Confiance | Note |
|-------|--------|-----------|-----------|------|
| events array (5 derniers, triés) | `/api/events` retourne ledger.events OU fallback 5 demo events | **LIVE** si ledger[], **PLACEHOLDER** si fallback | 1.0 / 0 | SSE stream `/api/stream` envoie nouveaux événements en temps réel. Si ledger vide : fallback demo array hardcoded. |

```js
provenance.events = {
  kind: events.length > 0 ? "LIVE" : "PLACEHOLDER",
  source: events.length > 0 ? "ledger.events via /api/events + /api/stream SSE" : "demo fallback array",
  updatedAt: events.length > 0 ? lastSync : null,
  confidence: events.length > 0 ? 1 : 0
}
```

---

### `terminal` (dock inférieur, onglet Terminal)

| Champ | Source | Catégorie | Confiance | Note |
|-------|--------|-----------|-----------|------|
| output (56-char template) | Hardcoded multi-line string | **PLACEHOLDER** | 0 | Le runtime n'expose pas les logs/stdout. Phase 2d : implémenter `/api/stream?type=logs`. |

```js
provenance.terminal = {
  kind: "PLACEHOLDER",
  source: "hardcoded template (no runtime logs)",
  updatedAt: null,
  confidence: 0
}
```

---

### `health` (panneau droit, santé système)

| Champ | Source | Catégorie | Confiance | Note |
|-------|--------|-----------|-----------|------|
| status | Hardcoded `'Tout est opérationnel'` | **PLACEHOLDER** | 0 | Pas de health check runtime. |
| agents.online | Hardcoded `12` | **PLACEHOLDER** | 0 | Pas de statut système. |
| agents.total | Hardcoded `12` | **PLACEHOLDER** | 0 | Idem. |
| services.online | Hardcoded `8` | **PLACEHOLDER** | 0 | Idem. |
| services.total | Hardcoded `8` | **PLACEHOLDER** | 0 | Idem. |
| memory | Hardcoded `78` (pourcentage) | **PLACEHOLDER** | 0 | Idem. |

```js
provenance.health = {
  kind: "PLACEHOLDER",
  source: "hardcoded values (no runtime health metrics)",
  updatedAt: null,
  confidence: 0
}
```

---

### `connected` (indicateur en haut, Running/Offline)

| Champ | Source | Catégorie | Confiance | Note |
|-------|--------|-----------|-----------|------|
| boolean | EventSource connection state + `/api/missions` success | **LIVE** | 1 | État réel de la liaison backend. Vrai signal opérationnel. |

```js
provenance.connected = {
  kind: "LIVE",
  source: "EventSource /api/stream connection state",
  updatedAt: lastSync,
  confidence: 1
}
```

---

### `lastSync` (horodatage du dernier événement)

| Champ | Source | Catégorie | Confiance | Note |
|-------|--------|-----------|-----------|------|
| timestamp ISO | `ledger.summary.latest_activity` OU `event.ts` de SSE | **LIVE** | 1 | Timestamp du dernier événement reçu du ledger. Fiable. |

```js
provenance.lastSync = {
  kind: "LIVE",
  source: "latest event timestamp from ledger",
  updatedAt: lastSync,
  confidence: 1
}
```

---

## Résumé par Catégorie

| Catégorie | Sections | Raison | Confiance | Action Future |
|-----------|----------|--------|-----------|----------------|
| **LIVE** | mission, summary.progress (si mission), summary.budget (complet), summary.activeAgent, events, connected, lastSync | Source directe ledger/backend | 1.0 | Maintenir et mettre à jour |
| **DERIVED** | summary.budget.percent (si cost+limit LIVE) | Calcul (cost/limit)*100 | 1.0 | OK, pas d'action |
| **ESTIMATED** | summary.progress (fallback 62 si pas mission) | Approximation structurelle | 0.5 | Phase 2c : tester bascule LIVE |
| **PLACEHOLDER** | graph (FLOW, states, progressLabels), inspector (11 champs), terminal, health, summary.tokens | Pas de source opérationnelle | 0 | Phase 2d : exposer au runtime |

---

## Données Critiques Pour Phase 2c (Tester les bascules)

### Cas 1 : Mission active présente
```
ledger.missions = [ { id, name, status: 'running', progress: 72, ... } ]
→ mission.LIVE, summary.progress.LIVE, summary.budget.LIVE (si filled)
```

### Cas 2 : Aucune mission
```
ledger.missions = []
→ mission.PLACEHOLDER, summary.progress.PLACEHOLDER (62), summary.budget.PLACEHOLDER (2.5/5.0)
```

### Cas 3 : Budget partiellement exposé
```
ledger.summary = { budget_cost: 1.5, budget_limit: null }
→ summary.budget.kind = "DERIVED" (cost LIVE, limit PLACEHOLDER)
→ provenance.confidence = 0.5 (ESTIMATED)
```

### Cas 4 : Événements en flux SSE
```
SSE /api/stream émet → events.LIVE, lastSync.LIVE (mise à jour continue)
```

### Cas 5 : Ledger null
```
ledger = null
→ tout bascule fallback PLACEHOLDER
```

---

## Intégrité et Audit

La provenance est le socle d'observabilité du frontend :
- Elle traçabilise chaque donnée.
- Elle permet au support/audit de distinguer fait réel vs fallback.
- Elle guide les phases futures pour savoir quoi remplacer.

Aucune donnée n'est "magique" ; toute valeur affichée explique d'où elle vient.
