# Data Provenance — Cortex Lab Dashboard

Chaque donnée visible du dashboard est classée selon sa source réelle et sa fiabilité.

## Classification

- **LIVE** : fournie directement par le backend, runtime ou ledger via une API/SSE. Mise à jour en temps réel ou quasi-temps réel.
- **DERIVED** : calcul déterministe fondé **uniquement** sur des données LIVE. Exacte tant que les sources LIVE sont exactes.
- **ESTIMATED** : approximation fondée sur des données partielles ou imprécises. Confiance = 0.5.
- **PLACEHOLDER** : valeur illustrative, fallback fixe ou simulation sans source opérationnelle. Confiance = 0. À remplacer par des données réelles.

**Principes clés** :
- Une valeur issue d'un index de tableau, d'un fallback fixe ou d'une simulation n'est jamais classée DERIVED.
- Une section n'est classée LIVE que si **toutes** ses sous-valeurs viennent réellement d'une source opérationnelle. Si une seule sous-valeur bascule sur un fallback, la section (ou la sous-clé concernée) ne peut pas être LIVE.
- `null`/`undefined` ne peut jamais avoir `confidence: 1`. Une propriété explicitement fournie avec une valeur "vide" (`0`, `false`) reste LIVE si elle a été réellement transmise — la présence de la clé compte, pas sa "vérité" au sens JS.

---

## Sections du Dashboard

### `mission` (objet mission actif)

| Champ | Source | Catégorie | Confiance | Note |
|-------|--------|-----------|-----------|------|
| tout (structure complète) | `/api/missions` retourne `{ missions: [ ... ] }` ; sélection `missions.find(status='running'/'active')` ou `missions[0]` | **LIVE** si mission trouvée, **PLACEHOLDER** si absent | 1 (LIVE) / 0 (PLACEHOLDER) | La mission active vient directement du runtime. **Si aucune mission : `view.mission` reste `undefined`** (comportement Phase 1 préservé). Aucun objet fallback `{ id: 'MIS-UNKNOWN', ... }` n'est introduit — c'est `MissionHeader.jsx` qui affiche son propre texte de repli (`'Refonte plateforme RH multi-agent'`). |

```js
provenance.mission = {
  kind: missions.length > 0 ? "LIVE" : "PLACEHOLDER",
  source: missions.length > 0 ? "ledger.missions[0] via /api/missions" : "fallback (no active mission)",
  updatedAt: missions.length > 0 ? lastSync : null,
  confidence: missions.length > 0 ? 1 : 0
}
```

---

### `summary` (rail gauche)

#### `summary.progress`

| Champ | Source | Catégorie | Confiance | Note |
|-------|--------|-----------|-----------|------|
| progress | `mission.progress` **si c'est un `number`** (y compris `0`) OU fallback `62` | **LIVE** si `typeof mission.progress === 'number'`, **PLACEHOLDER** sinon | 1 (LIVE) / 0 (PLACEHOLDER) | La classification dépend de la présence effective d'un `progress` numérique sur la mission, pas de la simple présence d'une mission. `progress = 0` est une vraie valeur LIVE, elle ne déclenche jamais le fallback 62. |

```js
provenance["summary.progress"] = {
  kind: typeof activeMission?.progress === "number" ? "LIVE" : "PLACEHOLDER",
  source: hasNumericProgress ? "mission.progress from runtime" : "fallback (62)",
  updatedAt: hasNumericProgress ? lastSync : null,
  confidence: hasNumericProgress ? 1 : 0
}
```

#### `summary.budget` — provenance séparée par sous-champ

Le budget cost/limit/percent peut avoir des sources indépendantes (l'un LIVE, l'autre non), donc la provenance est suivie **séparément** pour chacun des trois sous-champs plutôt qu'au niveau section.

##### `summary.budget.cost`

| Source | Catégorie | Confiance |
|--------|-----------|-----------|
| `ledger.summary.budget_cost` (valeur explicitement fournie) | **LIVE** | 1 |
| absente | **PLACEHOLDER**, fallback Phase 1 = `12.45` | 0 |

```js
provenance["summary.budget.cost"] = {
  kind: summary.budget_cost != null ? "LIVE" : "PLACEHOLDER",
  source: isBudgetCostLive ? "ledger.summary.budget_cost via /api/missions" : "fallback (12.45)",
  updatedAt: isBudgetCostLive ? lastSync : null,
  confidence: isBudgetCostLive ? 1 : 0
}
```

##### `summary.budget.limit`

| Source | Catégorie | Confiance |
|--------|-----------|-----------|
| `ledger.summary.budget_limit` (valeur explicitement fournie, **y compris `0`**) | **LIVE** | 1 |
| absente | **PLACEHOLDER**, fallback Phase 1 = `25` | 0 |

```js
provenance["summary.budget.limit"] = {
  kind: summary.budget_limit != null ? "LIVE" : "PLACEHOLDER",
  source: isBudgetLimitLive ? "ledger.summary.budget_limit via /api/missions" : "fallback (25)",
  updatedAt: isBudgetLimitLive ? lastSync : null,
  confidence: isBudgetLimitLive ? 1 : 0
}
```

`limit = 0` explicitement fourni est bien **LIVE** (c'est une vraie donnée), mais déclenche un traitement spécial pour le pourcentage (voir ci-dessous) afin d'éviter une division par zéro.

##### `summary.budget.percent`

| Cas | Catégorie | Confiance | Note |
|-----|-----------|-----------|------|
| cost LIVE + limit LIVE + limit > 0 | **DERIVED** | 1 | Calcul `(cost/limit)*100`, fondé uniquement sur deux données LIVE. |
| cost LIVE + limit LIVE + **limit = 0** | **PLACEHOLDER** | 0 | Pas de division ; `percent = 0` est un repli visuel explicite, pas un vrai calcul. |
| un seul des deux champs LIVE | **ESTIMATED** | 0.5 | Approximation fondée sur une donnée partielle. |
| aucun champ LIVE | **PLACEHOLDER** | 0 | Fallback fixe `49` (valeur Phase 1). |

```js
provenance["summary.budget.percent"] =
  isBudgetLimitZero
    ? { kind: "PLACEHOLDER", source: "visual fallback because live budget limit is zero", updatedAt: null, confidence: 0 }
  : isBudgetCompleteLive
    ? { kind: "DERIVED", source: "(budget_cost / budget_limit) * 100, both LIVE", updatedAt: lastSync, confidence: 1 }
  : (isBudgetCostLive || isBudgetLimitLive)
    ? { kind: "ESTIMATED", source: "partial budget: only one of cost/limit is LIVE", updatedAt: lastSync, confidence: 0.5 }
    : { kind: "PLACEHOLDER", source: "fallback (49)", updatedAt: null, confidence: 0 }
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
| premier agent actif ou fallback | `ledger.agents[0]` OU `{ name: 'Hermes', role: 'Chief of Staff' }` (fallback Phase 1) | **LIVE** si `agents.length > 0`, **PLACEHOLDER** si fallback | 1 / 0 | `/api/agents` retourne la liste. Affiche le premier. Si vide : fallback Phase 1 restauré (pas `unknown/unassigned`). |

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
| CONNECTIONS array (10 edges) | Hardcoded | **PLACEHOLDER** | 0 | Idem. |

#### Nodes (states et progressLabels)

| Champ | Source | Catégorie | Confiance | Note |
|-------|--------|-----------|-----------|------|
| `nodes[].state` (done/running/waiting/queued) | Fonction `statusFor(nodeId, index, selectedNodeId)` : déterministe basée sur index + sélection | **PLACEHOLDER** | 0 | Simulation pure. Aucun lien avec l'exécution réelle. Ce n'est **pas** DERIVED : la fonction ne dépend d'aucune donnée LIVE, seulement de la position dans un tableau hardcodé et de la sélection UI locale. |
| `nodes[].progressLabel` (100%, 80%, 40%, En attente) | Fonction `progressLabelFor(state)` : pure, basée sur état factice | **PLACEHOLDER** | 0 | Dépend de statusFor, donc PLACEHOLDER également. |

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

**Total : 11 champs scalaires/objet + 8 items de tableau (3 context + 3 evidence + 2 dependencies), tous PLACEHOLDER.**

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
| events array (5 derniers, triés) | `/api/events` retourne ledger.events OU fallback 5 demo events | **LIVE** si `events.length > 0`, **PLACEHOLDER** si fallback | 1 / 0 | SSE stream `/api/stream` envoie nouveaux événements en temps réel. Si ledger vide : fallback demo array hardcoded. |

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
| output (template multi-lignes) | Hardcoded string | **PLACEHOLDER** | 0 | Le runtime n'expose pas les logs/stdout. Phase 2d : implémenter `/api/stream?type=logs`. |

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
| agents.online / agents.total | Hardcoded `12/12` | **PLACEHOLDER** | 0 | Pas de statut système. |
| services.online / services.total | Hardcoded `8/8` | **PLACEHOLDER** | 0 | Idem. |
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
| boolean | Présence explicite de la clé `connected` dans `ledgerData` | **LIVE** si la clé existe (que sa valeur soit `true` ou `false`), **PLACEHOLDER** si `ledgerData` absent ou clé absente | 1 / 0 | `true` et `false` sont **tous deux** des valeurs LIVE valides — c'est la présence de la clé qui détermine la provenance, pas sa "vérité" JS. |

```js
provenance.connected = {
  kind: hasLedgerData && Object.prototype.hasOwnProperty.call(ledgerData, "connected") ? "LIVE" : "PLACEHOLDER",
  source: isConnectedLive ? "EventSource /api/stream connection state" : "fallback (no ledgerData.connected key)",
  updatedAt: isConnectedLive ? (lastSync ?? null) : null,
  confidence: isConnectedLive ? 1 : 0
}
```

---

### `lastSync` (horodatage du dernier événement)

| Champ | Source | Catégorie | Confiance | Note |
|-------|--------|-----------|-----------|------|
| timestamp ISO | `ledger.lastSync`, valeur réellement non-null | **LIVE** si non-null, **PLACEHOLDER** si `null`/absent | 1 / 0 | Une valeur `null` ne reçoit **jamais** `confidence: 1`, même si `ledgerData` existe par ailleurs. |

```js
provenance.lastSync = {
  kind: lastSync != null ? "LIVE" : "PLACEHOLDER",
  source: isLastSyncLive ? "latest event timestamp from ledger" : "fallback (no sync recorded)",
  updatedAt: isLastSyncLive ? lastSync : null,
  confidence: isLastSyncLive ? 1 : 0
}
```

---

## Résumé par Catégorie

| Catégorie | Sections | Raison | Action Future |
|-----------|----------|--------|----------------|
| **LIVE** | mission (si présente), summary.progress (si numérique), summary.budget.cost (si fourni), summary.budget.limit (si fourni), summary.activeAgent (si agents[]), events (si ledger[]), connected (si clé présente), lastSync (si non-null) | Source directe ledger/backend | Maintenir et mettre à jour |
| **DERIVED** | summary.budget.percent (si cost + limit LIVE et limit > 0) | Calcul `(cost/limit)*100` fondé uniquement sur du LIVE | OK, pas d'action |
| **ESTIMATED** | summary.budget.percent (si un seul de cost/limit est LIVE) | Approximation fondée sur donnée partielle | Phase 2c : encourager l'exposition complète du budget côté backend |
| **PLACEHOLDER** | mission (si absente), summary.progress (si non-numérique), summary.budget.* (si absent ou limit=0), summary.tokens, summary.activeAgent (si absent), graph, inspector, events (si vide), terminal, health, connected (si absent), lastSync (si null) | Pas de source opérationnelle ou fallback fixe | Phase 2d : exposer les sections manquantes au runtime |

---

## Données Critiques Pour Phase 2c (Tester les bascules)

### Cas 1 : Mission active avec progress numérique
```
ledger.missions = [ { id, name, status: 'running', progress: 72, ... } ]
→ mission.LIVE, summary.progress.LIVE (72)
```

### Cas 2 : Mission active sans champ progress
```
ledger.missions = [ { id, name, status: 'running' /* pas de progress */ } ]
→ mission.LIVE, summary.progress.PLACEHOLDER (fallback 62)
```

### Cas 3 : progress = 0
```
ledger.missions = [ { id, name, status: 'running', progress: 0 } ]
→ summary.progress.LIVE, valeur affichée = 0 (pas de fallback)
```

### Cas 4 : Aucune mission
```
ledger.missions = []
→ mission reste undefined (comportement Phase 1), summary.progress.PLACEHOLDER (62)
```

### Cas 5 : Budget complet
```
ledger.summary = { budget_cost: 10, budget_limit: 20 }
→ cost.LIVE, limit.LIVE, percent.DERIVED (50)
```

### Cas 6 : Budget cost seul
```
ledger.summary = { budget_cost: 10 }
→ cost.LIVE, limit.PLACEHOLDER, percent.ESTIMATED (confidence 0.5)
```

### Cas 7 : Budget limit seul
```
ledger.summary = { budget_limit: 20 }
→ cost.PLACEHOLDER, limit.LIVE, percent.ESTIMATED (confidence 0.5)
```

### Cas 8 : Budget limit = 0 (réel)
```
ledger.summary = { budget_cost: 10, budget_limit: 0 }
→ cost.LIVE, limit.LIVE (0 est une vraie valeur), percent.PLACEHOLDER (pas de division, source explicite)
```

### Cas 9 : Budget absent
```
ledger.summary = {}
→ cost.PLACEHOLDER (12.45), limit.PLACEHOLDER (25), percent.PLACEHOLDER (49)
```

### Cas 10 : Ledger null
```
ledger = null
→ tout bascule PLACEHOLDER, y compris connected et lastSync
```

### Cas 11 : connected explicitement false
```
ledgerData = { connected: false, ... }
→ connected.LIVE (la clé existe, même si sa valeur est false)
```

### Cas 12 : connected absent
```
ledgerData = { agents: [], events: [], missions: [], summary: {} } // pas de clé connected
→ connected.PLACEHOLDER
```

### Cas 13 : lastSync null explicite
```
ledgerData = { ..., lastSync: null }
→ lastSync.PLACEHOLDER, confidence: 0 (jamais 1 pour une valeur null)
```

---

## Fallbacks visuels préservés (Phase 1)

Ces valeurs de repli restent strictement identiques à la Phase 1 — Phase 2b n'a modifié que la métadonnée `.provenance`, jamais le texte affiché par défaut :

| Donnée | Valeur de repli |
|--------|------------------|
| `summary.budget.cost` | `€12,45` |
| `summary.budget.limit` | `€25,00` |
| `summary.budget.percent` | `49` |
| `summary.activeAgent` | `{ name: 'Hermes', role: 'Chief of Staff' }` |
| `summary.progress` | `62` |
| `mission` | `undefined` (aucun objet fallback introduit ; le composant `MissionHeader` gère son propre texte de repli) |

---

## Intégrité et Audit

La provenance est le socle d'observabilité du frontend :
- Elle traçabilise chaque donnée.
- Elle permet au support/audit de distinguer fait réel vs fallback.
- Elle guide les phases futures pour savoir quoi remplacer.
- Elle ne modifie jamais la valeur affichée par défaut : Phase 2b superpose la traçabilité sans toucher au rendu visuel.

Aucune donnée n'est "magique" ; toute valeur affichée explique d'où elle vient.
