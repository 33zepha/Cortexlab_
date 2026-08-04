# Cortex Lab — UI Vision (UI-0 → UI-3)

## Statut de ce document

Ce document explore une refonte visuelle et structurelle complète de Cortex Lab, en parallèle du travail incrémental de traçabilité des données (Phase 2b/2c/2d, voir `docs/DATA_PROVENANCE.md`).

**Ce document coexiste avec le plan existant** (`UI_HANDOFF_CLAUDE.md`, `UI_CURRENT_ITERATION.md`, `UI_REVIEW_SCORECARD.md`, `UI_DECISIONS.md`) — il ne le remplace pas tant qu'une décision explicite n'est pas actée dans `UI_DECISIONS.md`.

Aucune ligne de code n'est modifiée par ce document. UI-0 est une phase de définition pure.

**Méthode de rédaction** : section par section, avec validation avant de poursuivre. Ce document grandit progressivement.

---

## UI-0 — Vision complète

### Section 1 : Structure globale

#### Principe directeur

Cortex Lab est une **surface supervision-first**. La création et le lancement libre des missions restent externes, notamment via Hermes. Cortex Lab peut toutefois proposer des actions de gouvernance explicites, contrôlées et auditables : approbation, rejet, reprise, interruption, escalade, demande de preuve ou relance ciblée. Il ne devient jamais un terminal libre ni une interface d'exécution arbitraire.

*(Correction du 2026-08-04 : remplace la formulation initiale "surface de supervision en lecture augmentée", qui enfermait Cortex Lab dans un read-only absolu incompatible avec les actions de gouvernance prévues à terme.)*

#### Le squelette applicatif

L'application repose sur trois couches empilées, chacune avec une responsabilité unique :

```
┌─────────────────────────────────────────────────────────┐
│ Topbar contextuelle                                      │
│ (mission active, statut, temps, connexion, commandes)    │
├──────────┬──────────────────────────────────────────────┤
│          │                                                │
│ Sidebar  │  Workspace                                     │
│  légère  │  (contenu de l'espace actif)                   │
│          │                                                │
│          │                                                │
└──────────┴──────────────────────────────────────────────┘
```

**Sidebar** — navigation entre espaces, en deux blocs distincts :

- **Sept espaces métier** (le cœur de l'application) : Missions, Agents, Memory, Skills, Automations, Results, Evaluations.
- **Zone utilitaire système**, séparée visuellement en bas de sidebar, hors du décompte des sept espaces métier :
  - `System` — connexion, services, gateways, santé, quotas.
  - `Settings` — préférences, apparence, configuration non opérationnelle.

Persistante, mais volontairement discrète : pas de gros logo, pas de bannière, pas de zone promotionnelle. Un jeu d'icônes précis + labels courts. Elle ne porte aucune donnée de mission — uniquement de la navigation. La séparation visuelle entre bloc métier et bloc utilitaire doit être nette (espacement, pas de bordure lourde) pour qu'on ne confonde jamais "où on travaille" et "comment le système va".

**Topbar** — contexte de la mission ou de l'espace actif. C'est ici que vit l'état temporel et connectif (running/offline, durée, dernière synchro), pas dans la sidebar ni dispersé dans le workspace. Elle porte aussi les commandes secondaires (partage, plein écran, options) sans jamais devenir une barre d'action encombrée.

**Workspace** — la zone qui change selon l'espace actif. Pour l'espace "Missions" en vue détail, c'est le cockpit (résumé, graphe, inspecteur, dock) déjà esquissé dans votre message. Pour "Agents", "Memory", "Skills", etc., ce sera une structure adaptée à ce contenu (définie en UI-3), mais qui respecte la même logique : une zone dominante + un ou des panneaux secondaires, jamais une grille de cartes homogènes.

#### Ce qui ne change pas de l'existant

- Trois zones fonctionnelles (nav / contexte / contenu), pas une réinvention du concept.
- Aucune barre de saisie de prompt en position dominante.
- Le graphe d'exécution reste l'élément à plus forte densité d'attention **dans l'espace Missions**, pas nécessairement dans les autres espaces.

#### Ce qui change structurellement

- La sidebar actuelle est une sidebar d'application générique (probablement liée à un shell existant hors dashboard). Elle est remplacée par une sidebar dédiée aux 7 espaces métier listés, avec un langage visuel propre (UI-1).
- Le dashboard n'est plus le seul écran : c'est désormais un espace parmi sept, tous construits sur le même squelette topbar + workspace.
- La notion de "colonnes fixes" (gauche/centre/droite) qui structurait l'ancien dashboard devient une règle **locale à l'espace Missions**, pas une règle globale de l'application. Chaque espace peut avoir sa propre disposition interne du workspace, tant qu'elle respecte les principes de densité et de calme définis dans la direction artistique.

#### Ce qui reste à définir dans les sections suivantes

- La liste exacte des vues et leur contenu (UI-0 §2).
- Le modèle de navigation : comment on passe d'un espace à l'autre, comment l'état de la mission active suit ou non l'utilisateur d'un espace à l'autre (UI-0 §3).
- La hiérarchie de l'information à l'intérieur de chaque espace (UI-0 §4).

---

### Section 2 : Vues

Cette section couvre uniquement les sept espaces métier. `System` et `Settings` (zone utilitaire) seront définis dans une section ultérieure.

Pour chaque espace : objectif, vue par défaut, sous-vues, objet central, panneaux secondaires, données principales, actions autorisées, états (vide/loading/offline/erreur/PLACEHOLDER), ce qui existe déjà dans le repo, et ce qui dépend des phases suivantes.

---

#### 2.1 — Missions

**Objectif** — Superviser l'exécution des missions en cours et consulter l'historique des missions terminées.

**Vue par défaut** — Liste des missions (running en premier, puis triées par activité récente), avec sélection d'une mission ouvrant le cockpit détail.

**Sous-vues**
- Liste des missions (vue actuelle du dashboard, généralisée).
- Détail d'une mission (le cockpit : résumé, graphe, inspecteur, dock — c'est l'écran déjà construit en Phase 1/2b).

**Objet central** — Le graphe d'exécution de la mission sélectionnée (en vue détail) ; la liste des missions elle-même (en vue liste).

**Panneaux secondaires** — Résumé mission (budget, progression, agent actif), inspecteur du nœud sélectionné, dock inférieur (événements, terminal, ledger, artefacts, décisions), panneau santé système.

**Données principales** — Nom, statut, phase, progression, domaine, budget (coût/limite), agents assignés, checks (passés/violations/findings), closure, dernier événement.

**Actions autorisées** — Sélectionner une mission, sélectionner un nœud du graphe. À terme (gouvernance) : approuver/rejeter une étape, interrompre/reprendre, demander une preuve, relancer une étape échouée, escalader vers un humain, ouvrir un artefact.

**États**
- Vide : aucune mission dans le ledger → message explicite, pas de mission fictive affichée par défaut.
- Loading : ledger en cours de premier chargement.
- Offline : `connected = false` → bandeau non-bloquant, dernières données connues restent visibles.
- Erreur : échec d'appel `/api/missions` → message d'erreur explicite, pas de fallback silencieux.
- PLACEHOLDER : toutes les valeurs listées dans `docs/DATA_PROVENANCE.md` comme PLACEHOLDER (graph topology, inspector metrics, terminal, health) restent visuellement identifiables comme non opérationnelles.

**Existe déjà dans le repo** — `/api/missions`, `/api/events`, `/api/agents`, `/api/stream` (SSE), `runtime/mission-projection.mjs`, `useLedger()`, tout le cockpit Phase 1/2b (`dashboard-view-model.js` et composants associés).

**Dépend des phases suivantes** — Topologie réelle du graphe (Phase 2d : `/api/missions/{id}/topology`), états réels par nœud, métriques par nœud (durée/coût/tokens), actions de gouvernance (nouveau, hors Phase 2, à spécifier).

---

#### 2.2 — Agents

**Objectif** — Voir qui sont les agents disponibles dans le système, leur rôle, leur charge et leur performance récente.

**Vue par défaut** — Liste des agents (registry), avec statut (actif/en pause), rôle, fournisseur/modèle.

**Sous-vues**
- Liste des agents.
- Détail d'un agent : historique d'activité, mandats récents, coût cumulé, violations.

**Objet central** — La liste des agents en vue par défaut ; la fiche agent en détail.

**Panneaux secondaires** — Historique des mandats de l'agent (via `agentActivity()` déjà présent dans `web/src/lib/ledger.js`), coûts, indices qualité/coût.

**Données principales** — id, name, tier (ceo/manager), provider, model, role, status, cost_index, quality_index, strengths.

**Actions autorisées** — Consulter le détail d'un agent. À terme : changer d'agent/modèle pour une étape (déjà listé comme action bornée possible dans `UI_HANDOFF_CLAUDE.md`).

**États**
- Vide : registry sans agents (cas anormal, à signaler comme erreur de configuration plutôt qu'état vide neutre).
- Loading : premier appel `/api/agents` en cours.
- Offline : mêmes règles que Missions.
- Erreur : échec `/api/agents`.
- PLACEHOLDER : aucun placeholder connu actuellement — les données agents sont LIVE dès que le registry est chargé.

**Existe déjà dans le repo** — `/api/agents`, `registry/registry.json` (4 agents actifs), `agentActivity()` dans `web/src/lib/ledger.js` (calcule mandats, violations, coût par agent depuis les événements).

**Dépend des phases suivantes** — Action "changer d'agent/modèle" (gouvernance, non spécifiée). Vue détail agent (aujourd'hui aucun composant dédié n'existe, seule la fonction de calcul existe).

---

#### 2.3 — Memory

**Objectif** — Donner accès à la mémoire institutionnelle de Cortex : invariants, politiques, apprentissages visuels gradués par domaine.

**Vue par défaut** — Liste des invariants actifs (INV-001 à INV-011), groupés par domaine (orchestration, autonomy, communication, verification, closure, learning, post-error, versioning, budget).

**Sous-vues**
- Invariants (règles constitutionnelles).
- Apprentissages (confiance graduée par domaine — faible/intermédiaire/élevée/établie, selon INV-007).

**Objet central** — La liste des invariants/politiques actifs.

**Panneaux secondaires** — Détail d'un invariant sélectionné (statement complet, source, contrôles associés).

**Données principales** — id, type, authority, domain, status, version, source, statement, controls associés.

**Actions autorisées** — Consulter. Aucune action d'écriture prévue : la mémoire constitutionnelle n'est pas éditable depuis l'UI (source canonique = YAML dans `constitution/`, conformément à INV-009).

**États**
- Vide : n'existe pas en pratique (les invariants sont statiques et toujours présents), mais à prévoir si le registry est vide/corrompu.
- Loading : chargement du registry.
- Offline : n/a si servi statiquement, à clarifier selon l'implémentation retenue.
- Erreur : registry.json illisible ou invalide.
- PLACEHOLDER : la totalité de cet espace est PLACEHOLDER à ce stade — aucun endpoint API ne sert `registry.json` ou `constitution/` au frontend aujourd'hui.

**Existe déjà dans le repo** — `registry/registry.json` (11 invariants, 2 controls, 4 agents, classes d'autorité définies), `constitution/core.yaml`, `constitution/agents.yaml`, `manifests/invariants.json`. Tout ceci est lu côté serveur (`server/index.mjs` ne l'expose pas encore) ou en fichiers statiques, jamais via une route `/api/*` dédiée.

**Dépend des phases suivantes** — Création d'un endpoint `/api/memory` ou `/api/registry` (nouveau travail backend, hors périmètre UI). Définition de la vue "Apprentissages" (INV-007) qui n'a aucune donnée structurée existante à ce jour — à spécifier entièrement.

---

#### 2.4 — Skills

**Objectif** — Voir quels contrôles/compétences vérifiables sont actifs dans le système, et quels agents savent faire quoi.

**Vue par défaut** — Liste des contrôles actifs (`CTRL-*`), avec leur domaine d'application et leur statut.

**Sous-vues**
- Contrôles (checks automatisés, ex. `CTRL-NO-DEBUG-LOG`, `CTRL-NO-LABEL-UPPERCASE`).
- Compétences par agent (les tags `strengths` du registry — ex. "code", "orchestration-agents", "raisonnement").

**Objet central** — Liste des contrôles en vue par défaut.

**Panneaux secondaires** — Détail d'un contrôle (pattern, cible, message de blocage), liste des agents possédant une compétence donnée.

**Données principales** — id, domain, source (fichier yaml), applies_when, check.type/target/pattern/on_match/message.

**Actions autorisées** — Consulter uniquement. Aucune édition de contrôle depuis l'UI (source canonique = `schemas/*.yaml`, INV-009).

**États**
- Vide : aucun contrôle actif (cas anormal).
- Loading : chargement du registry/manifests.
- Offline : n/a si statique.
- Erreur : fichier de contrôle illisible.
- PLACEHOLDER : totalité de l'espace, même raison que Memory — pas d'endpoint API existant.

**Existe déjà dans le repo** — `manifests/controls.json` (2 contrôles), `schemas/ctrl-no-debug-log.yaml`, `schemas/ctrl-no-label-uppercase.yaml`, tags `strengths` dans `registry/registry.json`.

**Dépend des phases suivantes** — Endpoint `/api/skills` ou `/api/controls` (nouveau travail backend). Lien entre contrôles et résultats de `check.run` réels du ledger (les événements `check.run` existent déjà mais ne sont pas croisés avec la définition du contrôle dans l'UI actuelle).

---

#### 2.5 — Automations

**Objectif** — Voir les règles ou déclencheurs qui lancent des actions sans intervention humaine directe (hors périmètre "lancement de mission").

**Vue par défaut** — À définir : aucune automatisation n'existe dans le repo actuellement.

**Sous-vues** — Aucune connue à ce jour.

**Objet central** — À définir.

**Panneaux secondaires** — À définir.

**Données principales** — Aucune donnée réelle disponible.

**Actions autorisées** — À définir. Probablement : activer/désactiver une automatisation (action de gouvernance), jamais en créer librement depuis Cortex Lab (cohérent avec le principe directeur : pas d'exécution arbitraire).

**États** — À définir une fois le concept backend clarifié. Par défaut, cet espace devrait afficher un état "vide structurel" assumé (pas de fausse donnée), avec un message clair du type "Aucune automatisation configurée" plutôt qu'un PLACEHOLDER trompeur.

**Existe déjà dans le repo** — Rien. Aucun fichier, endpoint, ou concept d'automatisation n'existe dans le codebase actuel (ni `server/`, ni `runtime/`, ni `registry/`).

**Dépend des phases suivantes** — Cet espace dépend d'une décision produit non encore prise : qu'est-ce qu'une "automatisation" dans Cortex (déclencheur sur événement ? règle de routing automatique ? autre) ? Cette définition doit être clarifiée avec vous avant toute maquette, au-delà des phases 2c/2d de traçabilité des données.

---

#### 2.6 — Results

**Objectif** — Consulter les livrables et verdicts de clôture des missions terminées, indépendamment du suivi temps réel (qui reste dans Missions).

**Vue par défaut** — Liste des missions closes, avec leur closure (`LIVRAISON_AUTONOME` / `AVEC_INFORMATION` / `ESCALADE_HUMAINE`), triée par date de clôture.

**Sous-vues**
- Liste des résultats.
- Détail d'un résultat : rapport de mission complet (rationale de closure, controls appliqués, escalation reasons le cas échéant).

**Objet central** — Le rapport de closure de la mission sélectionnée.

**Panneaux secondaires** — Liste des checks passés/violations associés, budget final consommé.

**Données principales** — closure, rationale, budget final (`{ explorations, reworks, cost, limits }`), controls (liste complète avec verifiable/violation/findings/message), escalations, ruled_count.

**Actions autorisées** — Consulter, ouvrir un artefact lié. À terme : demander une nouvelle preuve, escalader vers un humain (actions de gouvernance sur un résultat déjà clos, ex. contester une clôture autonome).

**États**
- Vide : aucune mission encore close.
- Loading : chargement des missions terminées.
- Offline : mêmes règles que Missions.
- Erreur : échec de récupération.
- PLACEHOLDER : aucun connu — les données de closure sont entièrement dérivées du ledger réel (`runtime/chief-of-staff.mjs`, `finalizeMission()` dans `mission-projection.mjs`).

**Existe déjà dans le repo** — La donnée existe intégralement : `runtime/chief-of-staff.mjs` produit le rapport de closure (`closure`, `rationale`, `budget`, `controls`, `escalations`), `runtime/mission-projection.mjs` le projette dans `finalizeMission()`. Servi par `/api/missions` (chaque mission fermée porte déjà `closure`, `checks`, `budget`). **Aucune vue dédiée "Results" n'existe côté frontend** — c'est un nouvel espace à construire sur une donnée déjà disponible.

**Dépend des phases suivantes** — Aucune dépendance backend nouvelle : c'est le premier espace candidat à être entièrement LIVE dès sa construction, la donnée existe déjà de bout en bout.

---

#### 2.7 — Evaluations

**Objectif** — Donner une vue agrégée de la qualité et de la fiabilité du système : taux de violation, tendances par contrôle, niveaux d'escalade (N1/N2/N3 selon INV-008).

**Vue par défaut** — Tableau de synthèse par contrôle (`CTRL-*`) : nombre d'exécutions, taux de violation, dernière violation.

**Sous-vues**
- Synthèse par contrôle.
- Historique des diagnostics post-erreur (niveaux N1/N2/N3, selon INV-008).

**Objet central** — Le tableau de synthèse par contrôle en vue par défaut.

**Panneaux secondaires** — Détail d'un contrôle : historique des `check.run` associés, tendance dans le temps.

**Données principales** — Agrégations calculées à partir des événements `check.run` du ledger (rule, violation, findings) — actuellement disponibles événement par événement, jamais agrégées.

**Actions autorisées** — Consulter uniquement dans un premier temps.

**États**
- Vide : aucun `check.run` dans le ledger.
- Loading : agrégation en cours.
- Offline : mêmes règles que Missions.
- Erreur : échec d'agrégation ou de lecture ledger.
- PLACEHOLDER : la totalité des agrégations (taux, tendances) est PLACEHOLDER tant qu'aucune fonction d'agrégation n'existe.

**Existe déjà dans le repo** — Les événements bruts `check.run` existent dans le ledger (`{ rule, matched, violation, findings }`) et sont lisibles via `/api/events`. **Aucune agrégation, aucun calcul de taux, aucune vue "Evaluations" n'existe.**

**Dépend des phases suivantes** — Nouvelle logique d'agrégation (probablement un nouveau module runtime, similaire à `mission-projection.mjs` mais pour les contrôles plutôt que les missions). Définition du lien avec INV-008 (niveaux de diagnostic post-erreur) qui n'a aujourd'hui aucune trace structurée dans le ledger — seuls `check.run` et `agent.result` existent, sans notion de "niveau d'escalade du diagnostic".

---

### Résumé — maturité des données par espace

| Espace | Donnée LIVE existante | Vue frontend existante | Travail restant |
|---|---|---|---|
| Missions | Oui (complète) | Oui (cockpit Phase 1/2b) | Généraliser en liste + détail, gouvernance |
| Agents | Oui (complète) | Non (aucun composant dédié) | Construire liste + détail |
| Results | Oui (complète, non exploitée) | Non | Construire — candidat le plus rapide à livrer en LIVE |
| Skills | Partielle (2 contrôles, pas d'API) | Non | Endpoint API + vue |
| Memory | Partielle (fichiers statiques, pas d'API) | Non | Endpoint API + vue + concept "apprentissages" à spécifier |
| Evaluations | Partielle (événements bruts, pas d'agrégation) | Non | Nouveau module d'agrégation + vue |
| Automations | Aucune | Non | Décision produit préalable requise |

---

*Fin de la Section 2. En attente de validation avant de poursuivre avec la Section 3 (Navigation) ou la Section 4 (Hiérarchie de l'information), selon votre choix.*
