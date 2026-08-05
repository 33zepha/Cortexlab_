# Architecture — Séparer organisation Cortex et modèles IA

**Statut :** analyse lecture seule — **aucune modification de code**  
**Date :** 2026-08-05T17:23Z  
**Branche lue :** `feat/remove-antigravity` @ `64624a1`  
**Main distante :** `9f0d415` (contient déjà PR #13 mergée)  
**PR #14 open :** `feat/remove-antigravity` (suppression Antigravity, non mergée)  
**Tests locaux au moment de l’analyse :** 46/46 green  

---

## ⚠️ Constat bloquant (à lire avant tout)

1. **La PR #13 est déjà mergée dans `main`** (2026-08-05T17:10:04Z, squash `9f0d415`).  
   Consigne « ne merge pas la PR #13 » = **trop tard pour bloquer le merge**.  
   On ne peut plus « ne pas merger » : on peut **fermer conceptuellement**, **réécrire l’autorité**, ou **remplacer** par une nouvelle PR de séparation rôles/modèles.

2. **La confusion rôles ↔ modèles est réelle et structurelle**, pas cosmétique.  
   Dans le registre live, l’identité d’un agent **est** le nom d’un modèle/famille (`AG-CODEX`, `AG-CLAUDE`, `AG-KIMI`, `AG-LUNA`) avec un champ `model` collé dessus. Le router choisit **cette identité**, pas un rôle métier + un moteur cognitif.

3. **La PR #14 (remove-antigravity) est saine dans son intention**, mais elle consolide encore le modèle « managers = noms de modèles ».  
   La merger telle quelle **avant** la séparation rôles/modèles ancre plus profondément le mauvais concept.  
   Recommandation : **ne pas merger #14 tant que le plan de séparation n’est pas validé** — ou la rebaser/réécrire pour redistribuer vers des **managers métier**, pas vers Claude/Codex/Kimi-as-roles.

4. **Aucune implémentation n’a été faite dans cette session.** Lecture seule uniquement.

---

# État actuel du registre des agents

Source canonique : `constitution/agents.yaml`  
Dérivation : `manifests/agents.json` → `generate-registry.mjs` → `registry/registry.json`  
Règle piège connue : **le `tier` du manifeste prime** sur le YAML.

| id | name | tier | reports_to | provider | model | reasoning_effort | rôle affiché | cost | quality | ratio q/c |
|---|---|---|---|---|---|---|---|---|---|---|
| AG-HERMES | Hermes | ceo | — | nous | hy3 | — | CEO / orchestration / closure | 0.4 | 0.90 | 2.25 |
| AG-CODEX | Codex | manager | AG-HERMES | openai | gpt-5.6-luna | **max** (collé à l’agent) | Chief Engineer | 0.7 | 0.98 | 1.40 |
| AG-CLAUDE | Claude | manager | AG-HERMES | anthropic | claude-opus-4-8 | — | produit / UX / critique / spec | 1.7 | 0.95 | 0.56 |
| AG-KIMI | Kimi | manager | AG-HERMES | moonshot | kimi-k3 | — | recherche / long contexte | 0.8 | 0.88 | 1.10 |
| AG-LUNA | Luna Max | worker | AG-CODEX | openai | gpt-5.6-luna | — (effort implicite « Max » dans le nom) | exécutant ingénierie | 0.6 | 0.93 | 1.55 |

**Absent du registre live (branche actuelle) :** `AG-ANTIGRAVITY` (retiré dans #14 locale).  
**Toujours présent dans l’historique immuable :** ledger `events.ndjson` et certains bundles historiques mentionnent encore Antigravity — normal, append-only.

**Chief of Staff :** n’est **pas** une entrée `type: agent`. C’est le runtime `runtime/chief-of-staff.mjs` (gouvernance : checks, budget, closure). Aligné partiellement avec la cible « CoS ≠ modèle ».

**Router live (`runtime/router.mjs`) :**
- candidats = `tier === 'manager' && status === 'active'` uniquement ;
- score = intersection `strengths` ∩ `requiredStrengths(domain)` puis ratio `quality/cost` ;
- **un seul agent** par règle/control ;
- pas de sélection de modèle distincte ;
- pas de niveau d’effort dynamique ;
- pas d’agents spécialisés sous un manager ;
- Hermes jamais candidat (correct).

**Événements ledger aujourd’hui :**
`mission.start` · `agent.assigned` · `agent.result` · `check.run` · `budget.eval` · `mission.closure`

Shape de `agent.assigned` actuelle :
```json
{
  "agent": "AG-CODEX",
  "name": "Codex",
  "model": "gpt-5.6-luna",
  "rule": "CTRL-…",
  "cost": 0.07,
  "rationale": "aptitude « code » → Codex : …",
  "alternatives": [{ "id": "AG-CLAUDE", "name": "Claude", "ratio": 0.56 }]
}
```
→ confond agent, modèle, et rationnel de routage dans un seul objet nommé d’après le modèle.

**UI demo (`web/src/lib/demo.js`) :** même confusion (Claude/Codex/Kimi/Hermes comme « managers » avec model collé). Luna absente du demo agents. Kimi marqué `paused` en demo seulement.

---

# Confusions actuelles entre rôles et modèles

| Confusion | Preuve terrain | Conséquence |
|---|---|---|
| **Identité agent = nom de modèle** | ids `AG-CLAUDE`, `AG-CODEX`, `AG-KIMI`, `AG-LUNA` | Impossible de faire tourner le même rôle avec un autre moteur demain sans changer l’organigramme |
| **Modèle collé à l’entité** | champ `model:` dans `agents.yaml` + propagé au registre | Changer de variante = « changer d’agent » |
| **Effort collé à l’entité** | `reasoning_effort: max` sur AG-CODEX ; « Max » dans le nom Luna | Pas d’escalade/réduction d’effort par mandat |
| **Manager métier = marque IA** | Claude = UX, Codex = engineering, Kimi = research | Tendances initiales figées en loi de routage |
| **Worker = variante marketing** | AG-LUNA « Luna Max » = même `gpt-5.6-luna` que Codex | Doublon d’identité modèle ; le worker n’est pas un rôle (Frontend Engineer) mais une marque |
| **Routage 1 étape** | `selectAgent(rule)` → un manager nommé modèle | Manque étapes A (org) / B (modèle) / C (effort) |
| **Strengths = proxy du métier ET du modèle** | tokens `code`/`analyse-ux` attachés à Claude/Codex | Aptitudes du rôle mélangées aux biais du fournisseur |
| **Ledger dit « agent: Codex »** | `agent.assigned.agent = AG-CODEX` | Observabilité incapable de séparer qui / quel moteur / quel effort |
| **INV-011 texte** | `core.yaml` parle de « managers (ex. Claude/Codex/Kimi) » | La constitution elle-même enseigne le mélange |
| **Skills Hermes** | roster « Codex Chief Engineer, Claude UX, Kimi research, Luna worker » | La mémoire opératoire des sessions répète le mélange |
| **PR #13 intention** | « Codex devient Chief Engineer » | Promotion utile d’autorité technique, mais sur une identité-modèle |
| **PR #14 intention** | retire Antigravity, donne UX à Claude, engineering à Codex | Redistribution correcte des *domaines*, mauvaises *identités cibles* |

### Ce qui n’est PAS confus (à préserver)

- Séparation **gouvernance vs exécution** (CoS/Hermes closure vs managers).
- `tier: ceo | manager | worker` comme couches.
- `reports_to` machine (ajout PR #13 — réutilisable).
- `strengths` = tokens machine vs `capabilities` = prose (piège documenté, bon).
- `cost_index` / `quality_index` + alternatives dans le ledger (base d’un vrai routeur).
- Historique ledger/bundles immuable (ne pas réécrire).

---

# Organigramme organisationnel proposé

```
Boss
 └── Hermes                          (entrée conversationnelle + closure)
      └── Chief of Staff             (orchestration mission — runtime / rôle org, PAS un modèle)
           ├── MGR-ENGINEERING              Engineering Manager
           │     ├── AGENT-ARCHITECTURE
           │     ├── AGENT-FRONTEND-ENGINEER
           │     ├── AGENT-BACKEND-ENGINEER
           │     ├── AGENT-TEST-ENGINEER
           │     ├── AGENT-DEBUGGING
           │     ├── AGENT-SECURITY-REVIEWER
           │     └── AGENT-RELEASE-REVIEWER
           ├── MGR-PRODUCT-EXPERIENCE       Product & Experience Manager
           │     ├── AGENT-PRODUCT-ANALYST
           │     ├── AGENT-UX-ANALYST
           │     ├── AGENT-INTERFACE-DESIGNER
           │     ├── AGENT-INTERACTION-DESIGNER
           │     ├── AGENT-VISUAL-REVIEWER
           │     └── AGENT-ACCESSIBILITY-REVIEWER
           ├── MGR-RESEARCH                 Research Manager
           │     ├── AGENT-RESEARCH
           │     ├── AGENT-SOURCE-VERIFIER
           │     ├── AGENT-LONG-CONTEXT-READER
           │     ├── AGENT-SYNTHESIS
           │     └── AGENT-FACT-CHECKER
           └── MGR-LEARNING-EVALUATION      Mnémosyne
                 ├── AGENT-MISSION-EVALUATOR
                 ├── AGENT-MODEL-EVALUATOR
                 ├── AGENT-ROUTING-EVALUATOR
                 ├── AGENT-EVIDENCE-AUDITOR
                 ├── AGENT-LESSONS
                 └── AGENT-PEDAGOGY
```

**Règle d’or :** aucun nœud de cet organigramme ne s’appelle Claude, Codex, Kimi, Luna, HY3, Gemini.

**Chaîne d’exécution d’une session :**
```
rôle org (manager + agent_role)
  → modèle (family + variant + provider)
    → effort (low|medium|high|max)
      → outils + workspace + budget
        → preuves + ledger
          → retour manager → CoS → closure Hermes
```

---

# Catalogue des managers persistants

| manager_id | Nom | Domaine | Responsabilités | Ne fait pas |
|---|---|---|---|---|
| `MGR-ENGINEERING` | Engineering Manager | ingénierie logicielle | constituer l’équipe tech, mandats code/test/debug/release, vérifier preuves techniques | closure globale ; choix figé d’un seul modèle |
| `MGR-PRODUCT-EXPERIENCE` | Product & Experience Manager | produit, UX, UI | analyser besoin, spec, design, revue visuelle/a11y | implémenter le code front (sauf mandat joint avec engineering) |
| `MGR-RESEARCH` | Research Manager | recherche, sources, synthèse | exploration documentaire, vérif sources, longs contextes | décisions d’autorité produit/tech |
| `MGR-LEARNING-EVALUATION` | **Mnémosyne** | apprentissage & évaluation | débriefs, scores routing, missed items, pédagogie Boss | modifier seule Constitution / router / scores d’autorité |

**Chief of Staff** (`ROLE-CHIEF-OF-STAFF`, pas forcément un id `AG-*`) :
- décompose mission, choisit managers, budgets, preuves, stop conditions ;
- coordonne, escalade, prépare closure ;
- **n’est pas** un modèle.

**Hermes** (`ROLE-HERMES` / aujourd’hui `AG-HERMES` à migrer conceptuellement) :
- unique face Boss, crée mission, closure finale ;
- ne fait pas le travail technique direct.

---

# Catalogue des agents spécialisés

## Engineering (`MGR-ENGINEERING`)

| agent_role_id | Fonction |
|---|---|
| `AGENT-ARCHITECTURE` | découpage, contrats, impacts transverses |
| `AGENT-FRONTEND-ENGINEER` | UI implémentation, CSS/JS/React, worktree front |
| `AGENT-BACKEND-ENGINEER` | API, runtime server, adapters |
| `AGENT-TEST-ENGINEER` | tests, harness, non-régression |
| `AGENT-DEBUGGING` | root cause, repro, fix ciblé |
| `AGENT-SECURITY-REVIEWER` | revue sécu code/config |
| `AGENT-RELEASE-REVIEWER` | readiness, rollback, checklist ship |

## Product & Experience

| agent_role_id | Fonction |
|---|---|
| `AGENT-PRODUCT-ANALYST` | problème, scope, critères de succès |
| `AGENT-UX-ANALYST` | flux, frictions, priorités UX |
| `AGENT-INTERFACE-DESIGNER` | structure écrans, hiérarchie |
| `AGENT-INTERACTION-DESIGNER` | états, micro-interactions |
| `AGENT-VISUAL-REVIEWER` | cohérence visuelle, captures, mobile |
| `AGENT-ACCESSIBILITY-REVIEWER` | a11y, contraste, clavier |

## Research

| agent_role_id | Fonction |
|---|---|
| `AGENT-RESEARCH` | investigation large |
| `AGENT-SOURCE-VERIFIER` | validation sources |
| `AGENT-LONG-CONTEXT-READER` | gros volumes / multi-fichiers lecture |
| `AGENT-SYNTHESIS` | synthèse actionnable |
| `AGENT-FACT-CHECKER` | contradictions, claims |

## Learning & Evaluation (Mnémosyne)

| agent_role_id | Fonction |
|---|---|
| `AGENT-MISSION-EVALUATOR` | qualité mission globale |
| `AGENT-MODEL-EVALUATOR` | perf famille/variante |
| `AGENT-ROUTING-EVALUATOR` | pertinence org + modèle + effort |
| `AGENT-EVIDENCE-AUDITOR` | preuves manquantes / faibles |
| `AGENT-LESSONS` | extrait apprentissages durables |
| `AGENT-PEDAGOGY` | débrief Boss concis + détail optionnel |

**Migration depuis l’existant (mapping conceptuel, pas rename aveugle) :**

| Ancien id | Devient |
|---|---|
| AG-CODEX comme « Chief Engineer » | `MGR-ENGINEERING` (+ éventuellement charter d’autorité technique **sur le manager**, pas sur le modèle Codex) |
| AG-CLAUDE comme manager UX | `MGR-PRODUCT-EXPERIENCE` |
| AG-KIMI comme manager research | `MGR-RESEARCH` |
| AG-LUNA worker | **supprimé comme identité** ; ses tâches → `AGENT-*-ENGINEER` avec variante modèle `luna-max` si choisie |
| AG-HERMES | reste face Boss / closure ; séparer clairement de HY3 (modèle par défaut possible, pas identité) |
| AG-ANTIGRAVITY | **pas de remplaçant nommé modèle** ; domaines UI/UX → Product & Experience + agents UX/UI + Visual Reviewer ; implémentation front → Engineering |

---

# Catalogue des familles de modèles

**Règle :** aucun Gemini dans l’architecture active.

| family_id | Provider(s) / chemins | Usages tendances (non-lois) | Notes |
|---|---|---|---|
| `claude` | anthropic CLI / abo | analyse, critique, archi, produit, UX, spec, revue, long raisonnement | Inclure **toutes** variantes réellement accessibles |
| `codex` | OpenAI Codex CLI / abo | exploration repo, implémentation, shell, tests, debug, refactor, migration | Famille d’exécution outillée |
| `kimi` | moonshot CLI / abo | long contexte, lecture massive, synthèse, recherche, extraction | Ne pas enfermer si perf observée ailleurs |
| `hy3-free` | nous / Hermes default | classification, petits résumés, prep mandat, tâches low-risk | Gratuit, lent possible, contexte limité — **jamais** mission critique « parce que free » |

**Interdit actif :** `gemini`, `antigravity` comme famille routable.

---

# Représentation des variantes de modèles

Les variantes vivent dans un **catalogue modèles**, pas dans `agents.yaml` org.

```yaml
# concept — models/catalog.yaml (cible, pas encore créé)
families:
  claude:
    variants:
      - id: claude-opus-4-8
        context_window: …
        tools: [… ]
        cost_class: high
        quality_prior: 0.95
      - id: claude-sonnet-…
      - id: claude-haiku-…
  codex:
    variants:
      - id: gpt-5.6-luna
        aliases: [luna, luna-base]
      - id: luna-max
        # variante effort/contexte élevé dans l'écosystème Codex/OpenAI
        # hypothèse avantage long contexte / multi-fichiers — À MESURER
        cost_class: medium
        long_context_prior: high
  kimi:
    variants:
      - id: kimi-k3
  hy3-free:
    variants:
      - id: hy3
```

**Luna Max** = `family: codex` + `variant: luna-max` (ou effort max sur variante luna), **pas** `AG-LUNA`.

Champs utiles par variante : `context_window`, `tool_profile`, `multimodal`, `stability_score`, `quota_pool`, `avg_latency`, `success_rate_by_role` (appris).

---

# Représentation des niveaux d’effort

Enum indépendant du modèle :

| effort | Quand | Objectif |
|---|---|---|
| `low` | rename, formatage, classification, petite lecture, vérif mécanique | économiser tokens/quota/latence |
| `medium` | bug localisé, petit composant, doc, test ciblé | **défaut majoritaire** |
| `high` | multi-fichiers, archi, debug complexe, sécu, migration, multi-discipline | profondeur |
| `max` | critique, irréversible, échecs répétés, forte incertitude | **jamais défaut** |

Stockage session :
```yaml
effort_requested: high
effort_actual: max          # si escalade
effort_changes:
  - from: high
    to: max
    reason: "3 corrections + preuve visuelle manquante"
    at: ISO-8601
```

Aujourd’hui : seul `reasoning_effort: max` statique sur AG-CODEX — **à déplacer** vers le contrat de session.

---

# Contrat d’une session rôle + modèle + effort

```yaml
mission_id: MIS-1042
manager_id: MGR-ENGINEERING
agent_role_id: AGENT-FRONTEND-ENGINEER
session_id: ses_…

model:
  family: codex
  variant: luna-max
  provider: openai-subscription   # chemin d’accès réel

effort: high

selection:
  reasons:
    - refactorisation multi-fichiers
    - besoin shell + tests
    - contexte estimé élevé
    - variante potentiellement économique sur long contexte (hypothèse)
  alternatives:
    - family: claude
      variant: available-claude
      effort: high
      rejected_because: [coût/quota estimé supérieur, shell moins adapté ici]
    - family: kimi
      variant: kimi-k3
      effort: high
      rejected_because: [meilleur lecture que édition autonome ici]
    - family: hy3-free
      effort: medium
      rejected_because: [contexte insuffisant, risque trop haut]

tools: [filesystem, shell, tests, chromium]
permissions: { write: worktree, network: limited }
workspace: worktree/mis-1042/frontend

budget:
  token_limit: 180000
  time_limit_minutes: 40
  retry_limit: 1
  correction_limit: 2

proofs_expected:
  - type: tests
  - type: visual-proof
    viewport: [mobile, desktop]
stop_conditions: […]
resume_strategy: { prefix_stable: true, session_resume: true }
```

**Différence avec aujourd’hui :** le ledger ne dirait plus `agent: Codex`, mais  
`manager_id + agent_role_id + model.family/variant + effort + session_id`.

---

# Algorithme de routage organisationnel

**Étape A — org (Chief of Staff)**

Entrées : objectif Boss, risque, domaine(s), contraintes, historique missions similaires.

```
1. classifier mission → domaines (engineering, product_experience, research, learning, …)
2. pour chaque domaine actif → assigner manager_id
3. pour chaque manager → proposer agent_role_id[] nécessaires (pas « un Claude »)
4. ordonner + dépendances (ex: UX Analyst avant Frontend Engineer)
5. définir preuves attendues, budgets globaux, stop conditions
6. émettre mission.decomposed + manager.assigned + agent_role.assigned
```

Exemple « Corrige Mission Control et rends le mobile meilleur » :
```
MGR-PRODUCT-EXPERIENCE → UX Analyst, Interface Designer
MGR-ENGINEERING        → Frontend Engineer, Test Engineer
MGR-LEARNING-EVALUATION→ Visual Reviewer, Mission Evaluator
```

**Interdit :** `if domain==frontend return AG-CODEX`.

---

# Algorithme de sélection du modèle

**Étape B — modèle (par agent_role, après A)**

```
pour chaque agent_role_id:
  candidates = variants autorisées (pas Gemini) ∩ disponibles (quota>0, tools OK)
  score = f(
    fit_role_historique,           # perf passée rôle×family
    fit_task_type,                 # implémentation vs synthèse vs critique
    complexity,
    context_size_est,
    cost_est, quota_remaining,
    latency_need, multimodal_need,
    tool_stability_recent,
    privacy, risk_level,
    cache_friendliness
  )
  choisir family+variant+provider
  enregistrer reasons + alternatives rejetées
  émettre model.selected
```

**Tendances initiales (priors faibles, pas des lois) :**

| Prior faible | family |
|---|---|
| implémentation / shell / tests | codex |
| critique / spec / UX writing | claude |
| lecture massive / synthèse | kimi |
| trivial low-risk | hy3-free |

Le système **doit pouvoir** donner raison aux données contre le prior.

---

# Algorithme de sélection de l’effort

**Étape C — effort (après B, ou conjoint mais champ séparé)**

```
base = medium
si tâche mécanique / locale / déterministe → low
si multi-fichiers / archi / sécu / multi-discipline → high
si critique / irréversible / incertitude extrême → max
clamp selon budget restant et quota
émettre effort.selected
```

Effort et modèle sont orthogonaux : `claude + low` et `codex + max` sont tous deux valides.

---

# Règles d’escalade et de réduction

| Transition | Déclencheurs |
|---|---|
| low → medium | résultat incertain, contexte insuffisant, 1er test rouge, ambiguïté, outil échoué |
| medium → high | multi-fichiers liés, contradiction archi, multi-corrections, risque sous-estimé, preuve insuffisante |
| high → max | blocage complexe, décision irréversible, échecs répétés, plusieurs approches plausibles |
| high/medium → down | tâche plus simple que prévu, problème localisé, plan déterministe, contexte additionnel inutile |

Toute transition → événement `effort.escalated` / `effort.reduced` + `reason` + acteur (manager | CoS | policy).

---

# Gestion des quotas et abonnements

Aujourd’hui : **aucune** machine de quota dans le runtime Cortex (cost_index abstrait seulement).

Cible minimale :

```yaml
quota_pools:
  - id: anthropic-sub
    family: claude
    remaining: unknown|number
    reset_at: …
  - id: openai-codex-sub
    family: codex
  - id: moonshot-kimi
    family: kimi
  - id: nous-hy3
    family: hy3-free
    note: free tier constraints
```

Règles :
- sélection modèle lit `remaining` + `cost_est` ;
- si pool saturé → alternative ou report, **pas** silence ;
- HY3 free : eligible seulement si risk≤low et context≤limit ;
- ne jamais choisir un modèle uniquement parce qu’il reste du quota sur un pool inadapté au risque.

---

# Mesure des coûts et économies

Séparer :

| Type | Champ |
|---|---|
| tokens | `tokens_in`, `tokens_out`, `tokens_cached` |
| temps | `duration_ms` |
| quota | unités provider |
| coût API | si connu, sinon `null` + `cost_measurement: estimated` |
| cache | économie liée au prefix stable |
| évitement sur-modèle | delta vs alternative rejected high-end |
| délégation | économie vs tout faire sur un seul max effort |
| pertes | retries + corrections + mauvais routing |

Tant que N missions < seuil de confiance :
```yaml
estimated_savings:
  tokens: 42000
  time_seconds: 310
  confidence: 0.58
  compared_to:
    model_family: claude
    effort: high
```
**Interdit** d’afficher des économies « certaines » sans mesure provider réelle.

Aujourd’hui : `cost = cost_index * 0.1` purement symbolique — utile comme squelette, pas comme finance.

---

# Mesure des éléments manqués

Post-mission (Mnémosyne / Evidence Auditor) :

```yaml
missed:
  - type: visual-proof
    description: première passe sans test mobile
  - type: scope
    description: fichier lié non inspecté
  - type: routing
    description: effort too_low | model_mismatch | wrong_manager
  - type: tests
  - type: constraint
  - type: misunderstanding
  - type: budget_misestimate
```

Alimente : scores rôle×modèle×effort, priors de routage, pédagogie Boss.

---

# Architecture de Mnémosyne

| Attribut | Valeur |
|---|---|
| id | `MGR-LEARNING-EVALUATION` |
| nom | Mnémosyne |
| nature | **manager organisationnel**, pas un modèle |
| moteurs possibles | claude / codex / kimi / hy3 selon mandat d’éval |
| sorties | evaluation report, estimated_savings, missed[], lessons[], pedagogy_brief |
| droits | **propose** seulement |
| interdits | modifier Constitution seule ; changer router seule ; auto-promotion ; closure ; conclusion définitive sur 1 mission |

Flux :
```
mission.closed
  → Mnémosyne reçoit ledger + preuves + contrats de session
  → évalue org / rôles / modèles / efforts / combo
  → mission.evaluated + improvement.proposed
  → CoS + Hermes arbitrent
  → Boss valide changements d’autorité structurants
```

---

# Événements ledger nécessaires

**Conserver (compat) :** `mission.start`, `check.run`, `budget.eval`, `mission.closure`  
**Étendre / renommer progressivement :**

| Event | Données clés |
|---|---|
| `mission.created` | mission_id, goal, risk |
| `mission.decomposed` | managers[], deps, budgets |
| `manager.assigned` | manager_id, scope |
| `agent_role.assigned` | agent_role_id, manager_id |
| `model.selected` | family, variant, provider, reasons, alternatives |
| `effort.selected` | effort, reasons |
| `effort.escalated` / `effort.reduced` | from, to, reason |
| `session.started` / `session.resumed` | session_id, workspace, contrat complet |
| `tool.called` | tool, ok, ms |
| `agent.result` | **role + model + effort**, pas seulement name modèle |
| `evidence.produced` | type, path/uri |
| `check.started` / `check.completed` | |
| `correction.requested` | |
| `mission.evaluated` | scores, missed, savings |
| `improvement.proposed` | |
| `mission.closed` | closure, pedagogy_ref |

**Migration shape `agent.assigned` :**
```json
{
  "mission_id": "MIS-1042",
  "manager_id": "MGR-ENGINEERING",
  "agent_role_id": "AGENT-FRONTEND-ENGINEER",
  "model_family": "codex",
  "model_variant": "luna-max",
  "provider": "openai-subscription",
  "effort_requested": "high",
  "effort_actual": "high",
  "session_id": "ses_…",
  "workspace": "…",
  "rationale": { "org": "…", "model": "…", "effort": "…" },
  "alternatives": […],
  "budget": { "token_limit": 180000, "time_limit_minutes": 40 }
}
```
Compat lecture : les lecteurs UI doivent tolérer l’ancien shape (`agent`, `name`, `model`) pendant la transition.

---

# Impact exact sur la PR #13

**État git :** MERGÉE dans `main` (`9f0d415`).  
8 fichiers, +368/−13.

| Fichier PR #13 | Effet |
|---|---|
| `constitution/agents.yaml` | ajoute AG-CODEX manager + AG-LUNA worker ; recentre Antigravity sur UI |
| `manifests/agents.json` | tier Codex → manager |
| `generate-registry.mjs` | propage reports_to, reasoning_effort, capabilities, domain_expertise |
| `registry/registry.json` | dérivé |
| `runtime/router.mjs` | domaines engineering → tokens code/tests/correction |
| `test/authority.test.mjs` | **nouveau** — tests registre réel |
| `test/router.test.mjs` | assertions domaines |
| `AGENTS.md` | chaîne d’autorité documentée |

**Impact conceptuel :** ancre « Codex = Chief Engineer », « Luna = worker », modèles = nœuds d’org. Utile pour l’autorité technique **à court terme**, **hostile** à la séparation cible.

**On ne « unmerge » pas sans décision Boss.** On traite #13 comme **dette conceptuelle mergée** à amortir.

---

# Éléments de la PR #13 réutilisables

| Élément | Pourquoi garder |
|---|---|
| `reports_to` machine | hiérarchie affichable et testable |
| propagation générateur (whitelist fields) | pattern correct pour nouveaux champs session/model |
| séparation manager/worker via `tier` | socle des couches org |
| `domain_expertise` + `capabilities` hors scoring | bonne hygiène |
| `strengths` = tokens machine | à **déplacer** vers rôles, pas jeter |
| tests `authority.test.mjs` sur registre **réel** | pattern d’or (pas fixtures seules) |
| justification + `alternatives` dans routing | base étape B |
| cost/quality indices | priors / ranking |
| distinction autorité technique ≠ closure | INV-006 préservé |
| non-overlap de domaines d’autorité | principe sain (à appliquer aux **managers métier**) |

---

# Éléments de la PR #13 à abandonner

| Élément | Pourquoi abandonner |
|---|---|
| `AG-CODEX` comme rôle organisationnel permanent | c’est une famille de modèles |
| `AG-CLAUDE` / `AG-KIMI` comme managers métier nommés modèle | idem |
| `AG-LUNA` comme worker persistant nommé variante | Luna Max = variant, pas salarié |
| `model:` obligatoire sur l’identité agent org | casse la sél. dynamique |
| `reasoning_effort` sur l’entité agent | doit être session/mandat |
| strengths « de marque » collées au modèle-agent | strengths du **rôle** |
| routage domaine → nom de modèle | domaine → manager → role → (plus tard) modèle |
| narrative docs/skills « Codex Chief Engineer / Claude UX / Kimi research » comme loi | priors seulement |
| promotion Codex = fin de l’architecture | c’était une étape, pas la cible |

---

# Impact sur la suppression d’Antigravity

**PR #14 open** (`feat/remove-antigravity`) fait déjà :
- retrait registre/manifest/tests/demo CSS ;
- redistribution domaines ui/ux → Claude tokens ; prototypage → Codex ;
- 46 tests green localement.

**Compatible avec la cible ?** Partiellement.
- ✅ Antigravity doit disparaître (pas de Gemini).
- ❌ Redistribuer vers **Claude/Codex-as-managers** renforce le mauvais modèle.
- ✅ Ne pas créer de manager nommé remplaçant modèle — bon instinct de #14 sur « pas d’alias ».
- 🎯 Cible : redistribuer vers `MGR-PRODUCT-EXPERIENCE` + agents UX/UI + `MGR-ENGINEERING` + Frontend Engineer + Visual Reviewer + CoS.

**Recommandation suppression Antigravity :**
1. Valider d’abord ce document (séparation).
2. Soit **retarget #14** pour retirer Antigravity **sans** figer Claude/Codex comme org finale (ids org neutres si déjà prêts),  
   soit **merger #14 comme cleanup mécanique** puis enchaîner **immédiatement** la PR de séparation (fenêtre courte, skills/docs à jour).  
3. Préférence architecte : **ne pas merger #14 telle quelle** ; la fondre dans l’étape 1 de migration ci-dessous (retrait Antigravity + introduction managers métier en même temps) pour éviter deux bascules UI/router.

Ne pas réécrire ledger/bundles historiques.

---

# Plan de migration en 5 étapes maximum

### Étape 1 — Socle conceptuel + schémas (pas encore de cutover runtime)
- Introduire catalogues : `managers`, `agent_roles`, `model_families/variants`, `effort_levels`.
- Étendre générateur/registre pour **coexister** anciennes entrées `AG-*` (deprecated) et nouvelles.
- Documenter mapping de transition.
- Tests de schéma + non-régression router actuel.
- **Retirer Antigravity** ici si #14 non mergée (un seul bang).

### Étape 2 — Contrat de session + ledger v2 (écriture duale)
- Émettre nouveaux champs (`manager_id`, `agent_role_id`, `model_*`, `effort_*`) **en plus** de l’ancien `agent/name/model`.
- UI tolère dual-read.
- Pas encore de sélection modèle réelle : map temporaire rôle → ancien AG-* (adapter).

### Étape 3 — Router en 3 étapes (org → modèle → effort)
- Remplacer `selectAgent` unique par `routeOrganization` + `selectModel` + `selectEffort`.
- Priors initiaux = tendances actuelles (pour ne pas casser le comportement overnight).
- Tests : déterminisme, pas de Gemini, workers non candidats org, Hermes non exécutant.

### Étape 4 — Cutover identités
- Désactiver ids `AG-CODEX/CLAUDE/KIMI/LUNA` comme managers/workers org.
- Activer `MGR-*` + `AGENT-*`.
- Adapters CLI (codex/claude/kimi/hy3) deviennent **backends de family**, plus des agents.
- Demo UI + skills Hermes + AGENTS.md + INV-011 wording.

### Étape 5 — Mnémosyne + mesures
- Manager learning, missed[], estimated_savings, pedagogy brief.
- Boucle d’apprentissage sur scores rôle×modèle×effort (propositions only).

**Branche porteuse recommandée :**  
`feat/role-model-separation` coupée depuis `main` **après** décision sur #14 :
- Option A (préférée) : base = `main` + cherry-pick cleanup Antigravity sans figer Claude/Codex org.
- Option B : base = `feat/remove-antigravity` rewritée pour managers métier, puis une seule PR.

**Ne pas** continuer à empiler sur `feat/codex-chief-engineer` (déjà mergée).  
**Ne pas** traiter `dev/sync` comme base d’autorité (locale, divergente UI).

---

# Fichiers concernés

## Noyau identité / routage
- `constitution/agents.yaml` → à scinder conceptuellement (org vs models)
- `constitution/core.yaml` (INV-011 wording)
- `manifests/agents.json` (+ futurs `manifests/managers.json`, `agent_roles.json`, `models.json`)
- `generate-registry.mjs`
- `registry/registry.json` (généré)
- `runtime/router.mjs`
- `runtime/chief-of-staff.mjs`
- `runtime/event-store.mjs` (shapes)
- `runtime/mission-projection.mjs`

## UI / demo
- `web/src/lib/demo.js`
- `web/src/lib/ledger.js`
- `web/src/lib/dashboard-view-model.js`
- `web/src/lib/console-view-model.js`
- `web/src/components/AgentDrawer.jsx`
- éventuellement pages Mission Control / table agents

## Docs & bootstrap
- `AGENTS.md`
- `docs/ARCHITECTURE.md`, `docs/PRODUCT.md`
- skills hors repo : `cortex-orchestration/SKILL.md`, `drix-communication` roster banners, `references/agent-authority-model.md`, `agent-decommissioning-audit.md`

## Tests
- `test/authority.test.mjs`
- `test/router.test.mjs`
- `test/antigravity-absent.test.mjs`
- nouveaux : `test/session-contract.test.mjs`, `test/model-catalog.test.mjs`, `test/effort-routing.test.mjs`, `test/mnemosyne.test.mjs`

## Hors scope immédiat mais touchés plus tard
- adapters CLI (`hermes-adapter` s’il est restauré), `runtime/codex/*` si réintroduit
- bundles historiques : **lecture seule**, pas de rewrite

---

# Tests nécessaires

| Zone | Tests |
|---|---|
| Schémas | managers/roles/models/effort valides ; ids sans noms de marques modèles |
| Générateur | whitelist champs session ; dual entries ; verify |
| Router A | domaine → manager métier ; multi-managers ; deps |
| Router B | sélection family/variant ; rejection Gemini ; alternatives journalisées |
| Router C | effort défaut medium ; max jamais défaut ; escalade reasons |
| Autorité | aucun worker candidat org ; Hermes non exécutant ; pas de cycle reports_to |
| Ledger | dual-write ancien/nouveau ; projection UI ; verifyChain intact |
| Antigravity | absence registre + pas de route + pas de demo |
| Mnémosyne | propose only ; pas de mutation constitution |
| Non-régression | 46 tests actuels restent green pendant dual-run |
| Propriétés | déterminisme ordre input ; strengths tokens matchables sur **rôles** |

---

# Risques

| Risque | Sévérité | Mitigation |
|---|---|---|
| Réécrire l’histoire ledger pour « nettoyer » les noms modèles | P0 | append-only ; dual-read UI |
| Big-bang rename sans dual-run | P0 | étapes 2–4 ; feature flag |
| Merger #14 puis séparation = double churn UI/router | P1 | fondre ou enchaîner serré |
| Hardcoder à nouveau Claude=UX dans le nouveau router | P1 | tests anti-loi ; priors faibles + Mnémosyne |
| Luna Max perdu comme capacité faute d’identité AG-LUNA | P1 | catalog variant explicite + tests présence family codex |
| Quota réel inconnu → mauvaises économies affichées | P1 | `estimated_*` + confidence |
| Skills Hermes / mémoire agents encore sur ancien roster | P1 | update skills **dans** l’étape cutover |
| Confusion Boss pendant transition (deux vocabulaires) | P2 | pédagogie Mnémosyne + banner UI « rôle ≠ modèle » |
| Scope creep policy/cache dans la PR de séparation | P1 | hygiène de scope (leçon PR #13 policies) |
| Implémenter avant validation Boss | P0 | **cette session s’arrête au plan** |

---

# Recommandation finale

### PR #13
**Remplacer conceptuellement** (pas « fermer » au sens GitHub : déjà mergée).  
- Ne pas tenter un revert brutal de `9f0d415` sans plan : ça casserait autorité technique + tests + chaîne reports_to utiles.  
- **Amortir** #13 : garder mécanique hiérarchie/tests/générateur ; **abandonner** l’identité modèle-as-agent comme modèle mental et comme schéma cible.  
- Formule : **« PR #13 = étape d’autorité technique acceptée ; PR de séparation rôles/modèles = correctif d’architecture qui la supersede. »**

### PR #14 (remove-antigravity)
**Ne pas merger telle quelle** tant que ce plan n’est pas tranché.  
Soit retarget vers managers métier, soit cleanup mécanique immédiatement suivi de la PR séparation sur la même ligne de branches.

### Branche de migration
**`feat/role-model-separation`** (nouvelle), base `main` @ `9f0d415` (+ décision Antigravity).  
Pas de merge vers `main` tant que :
1. catalogues org/modèles/effort spécifiés en schéma,
2. dual-write ledger,
3. tests anti-mélange (aucun manager_id ∈ {claude,codex,kimi,luna,hy3,gemini}),
4. validation Boss de ce document.

### Implémentation
**Aucune** avant feu vert explicite du Boss sur ce rapport.

---

## Annexe A — Preuves terrain (commandes)

```text
branche: feat/remove-antigravity @ 64624a1
main:    9f0d415  # PR #13 squash-merged
PR #13:  closed merged 2026-08-05T17:10:04Z  head=feat/codex-chief-engineer
PR #14:  open            head=feat/remove-antigravity
npm test: 46/46 pass
registre agents: AG-HERMES, AG-CODEX, AG-CLAUDE, AG-KIMI, AG-LUNA (no AG-ANTIGRAVITY on this branch)
```

## Annexe B — Exemple d’ordre cible (rappel)

```
Boss: « Corrige Mission Control et rends le mobile meilleur. »
Hermes → crée mission → CoS
CoS → MGR-PRODUCT-EXPERIENCE + MGR-ENGINEERING + MGR-LEARNING-EVALUATION
chaque manager → agent_roles
Cortex → model.family/variant + effort par rôle
exécution → preuves → contrôles
Mnémosyne → éval + pédagogie
Hermes → closure Boss
```

---

*Fin du rapport. Lecture seule. En attente de validation Boss.*
