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

**Note de correction (2026-08-04)** : Cette section intègre les corrections suivantes :
- **Constitution/Invariants/Contrôles** (INV-001 à INV-011, `CTRL-*`, autorité) appartiennent à `System` (zone utilitaire), pas aux espaces métier. Ils sont des fondations du système, pas du contenu opérationnel à superviser.
- **Memory** est redéfinie comme mémoire opérationnelle : ce qui s'est passé (episodic), ce qu'on en a tiré (semantic), comment on le fait maintenant (procedural). Pas de constitution ici.
- **Skills** est le catalogue des capacités exécutables et permissions du système, pas un mélange de contrôles et strengths.
- **Results** sont les artefacts concrets générés (code, docs, rapports), pas les données administratives de closure.
- **Evaluations** est une évaluation holistique de la qualité et de la fiabilité (rubrics, scores, tendances, diagnostics post-erreur), pas une simple synthèse de contrôles.
- **Automations** a un modèle objet clairement défini (trigger/action), en attente d'une décision produit préalable.

Pour chaque espace : objectif, vue par défaut, sous-vues, objet central, panneaux secondaires, données principales, actions autorisées, états (vide/loading/offline/erreur/PLACEHOLDER), ce qui existe déjà dans le repo, et ce qui dépend des phases suivantes.

---

#### 2.1 — Missions

**Objectif** — Superviser l'exécution des missions en cours et consulter l'historique des missions terminées.

**Vue par défaut** — Détail d'une mission (le cockpit : résumé, graphe, inspecteur, dock — c'est l'écran déjà construit en Phase 1/2b).

**Sous-vues**
- Détail d'une mission (vue actuelle, existante).
- Liste des missions (vue à construire : running en premier, puis triées par activité récente, avec sélection ouvrant le détail).

**Objet central** — Le graphe d'exécution de la mission sélectionnée (en vue détail) ; la liste des missions elle-même (en vue liste, à construire).

**Panneaux secondaires** — Résumé mission (budget, progression, agent actif), inspecteur du nœud sélectionné, dock inférieur (événements, terminal, ledger, artefacts, décisions), panneau santé système.

**Données principales** — Nom, statut, phase, progression, domaine, budget (coût/limite), agents assignés, checks (passés/violations/findings), closure, dernier événement.

**Actions autorisées** — Sélectionner une mission, sélectionner un nœud du graphe. À terme (gouvernance) : approuver/rejeter une étape, interrompre/reprendre, demander une preuve, relancer une étape échouée, escalader vers un humain, ouvrir un artefact.

**États**
- Vide : aucune mission dans le ledger → message explicite, pas de mission fictive affichée par défaut.
- Loading : ledger en cours de premier chargement.
- Offline : `connected = false` → bandeau non-bloquant, dernières données connues restent visibles.
- Erreur : échec d'appel `/api/missions` → message d'erreur explicite, pas de fallback silencieux.
- PLACEHOLDER : toutes les valeurs listées dans `docs/DATA_PROVENANCE.md` comme PLACEHOLDER (graph topology, inspector metrics, terminal, health) restent visuellement identifiables comme non opérationnelles.

**Existe déjà dans le repo** — Cockpit détail complet (Phase 1/2b) : `/api/missions`, `/api/events`, `/api/agents`, `/api/stream` (SSE), `runtime/mission-projection.mjs`, `useLedger()`, `dashboard-view-model.js` et composants associés. Données LIVE partielles : mission, événements, agents et budget partiellement disponibles. Données encore PLACEHOLDER : topologie du graphe, états réels par nœud, métriques par nœud (durée/coût/tokens), inspector (logs, métadonnées détaillées), terminal, health panel. **Liste des missions n'existe pas** — seul le cockpit détail existe.

**Dépend des phases suivantes** — Construire la vue liste des missions. Topologie réelle du graphe (Phase 2d : `/api/missions/{id}/topology`), états réels et métriques par nœud. Actions de gouvernance (nouveau, hors Phase 2).

---

#### 2.2 — Agents

**Objectif** — Voir qui sont les agents disponibles dans le système, leur rôle, leur charge et leur performance récente.

**Vue par défaut** — Liste des agents (registry), avec statut (actif/en pause), rôle, fournisseur/modèle.

**Sous-vues**
- Liste des agents.
- Détail d'un agent : historique d'activité, mandats récents, coût cumulé, violations.

**Objet central** — La liste des agents en vue par défaut ; la fiche agent en détail.

**Panneaux secondaires** — Historique des mandats de l'agent (via `agentActivity()` déjà présent dans `web/src/lib/ledger.js`), coûts, indices qualité/coût.

**Données principales** — id, name, tier (ceo/manager), provider, model, role, status (configuration LIVE), cost_index, quality_index, strengths, activité récente (DERIVED du ledger), charge/disponibilité runtime (partielle ou absente), performance historique (partielle).

**Actions autorisées** — Consulter le détail d'un agent. À terme : changer d'agent/modèle pour une étape (déjà listé comme action bornée possible dans `UI_HANDOFF_CLAUDE.md`).

**États**
- Vide : registry sans agents (cas anormal, à signaler comme erreur de configuration).
- Loading : premier appel `/api/agents` en cours.
- Offline : mêmes règles que Missions.
- Erreur : échec `/api/agents`.
- PLACEHOLDER : charge runtime, disponibilité, performance historique — données absentes ou non structurées.

**Existe déjà dans le repo** — Configuration LIVE : `/api/agents`, `registry/registry.json` (4 agents, 4 tiers, fournisseurs/modèles, rôles). Activité DERIVED : `agentActivity()` dans `web/src/lib/ledger.js` (calcule mandats, violations, coût par agent depuis les événements). Charge/performance : non structurées dans le ledger aujourd'hui.

**Dépend des phases suivantes** — Vue détail agent (aucun composant dédié n'existe actuellement). Métriques runtime (charge, disponibilité, latence). Performance historique (score, tendance). Action "changer d'agent/modèle" (gouvernance).

---

#### 2.3 — Memory

**Objectif** — Accéder à la mémoire opérationnelle du système : expérience accumulée (ce qui s'est passé), apprentissages tirés (ce qu'on en a appris), procédures établies (comment on le fait maintenant).

**Vue par défaut** — Trois onglets : **Historique** (episodic), **Apprentissages** (semantic), **Procédures** (procedural), avec filtres optionnels par domaine et niveau de confiance.

**Sous-vues**
- **Historique** (episodic) : log structuré des événements importants du système, groupés par domaine/mission, avec contexte.
- **Apprentissages** (semantic) : ce qu'on a tiré des événements — patterns identifiés, confiance progressive (faible/intermédiaire/élevée/établie selon INV-007), cas limites documentés, tendances.
- **Procédures** (procedural) : comment on exécute maintenant, en fonction de ce qu'on a appris — étapes, conditions, domaines applicables, taux de succès historique.

**Objet central** — Le tab actif (Historique / Apprentissages / Procédures).

**Panneaux secondaires** — Détail d'un événement historique (mission, agent, outcome, impact), d'un apprentissage (evidence), ou d'une procédure (conditions, linked_events).

**Données principales** — Par onglet :
- **Historique** : ts, event_type, domain, mission_id, outcome, agent_involved, cost_impact.
- **Apprentissages** : domain, pattern_description, confidence_level (faible/intermédiaire/élevée/établie), supporting_events_count, trend_indicator (↑↓→), linked_procedures.
- **Procédures** : procedure_id, description, applicable_domains (list), conditions (when/how to trigger), steps, success_rate (%), last_used_ts.

**Actions autorisées** — Consulter uniquement. Aucune édition manuelle : l'expérience et les apprentissages se construisent par l'exécution réelle, jamais par saisie UI.

**États**
- Vide : système neuf, aucun historique accumulé.
- Loading : agrégation de l'historique et des apprentissages en cours.
- Offline : mêmes règles que Missions.
- Erreur : échec d'agrégation ou de lecture du ledger.
- PLACEHOLDER : Entièrement PLACEHOLDER à ce stade. Aucun endpoint n'expose ce concept (`/api/memory`, `/api/learning`, `/api/procedures` n'existent pas). Les concepts "apprentissages" et "procédures" n'ont aucune donnée structurée existante. Seuls les événements bruts du ledger (via `/api/events`) pourraient alimenter l'onglet Historique.

**Existe déjà dans le repo** — Événements bruts du ledger (via `/api/events`), `agentActivity()` dans `web/src/lib/ledger.js` (pour l'historique par agent). Rien d'autre.

**Dépend des phases suivantes** — Nouveaux endpoints `/api/memory/history`, `/api/memory/learning`, `/api/memory/procedures`. Nouvelle logique d'agrégation et d'inférence pour transformer l'historique brut en apprentissages (probablement un nouveau module runtime). Notion de "confiance" des apprentissages et lien avec INV-007. Données statiques/gérées pour les procédures canoniques. Vue détail + drill-down entre onglets.

---

#### 2.4 — Skills

**Objectif** — Voir le catalogue des capacités exécutables, outils, connecteurs, adapters et procédures du système : qui peut faire quoi, avec quelles permissions.

**Vue par défaut** — Registre des skills disponibles : liste des capacités exécutables, outils et connecteurs, avec agents et modèles compatibles, permissions, historique d'usage.

**Sous-vues**
- **Skills exécutables** : capacités, outils, connecteurs, adapters disponibles.
- **Compatibilité agent** : pour chaque skill, agents/modèles qui peuvent l'exécuter.
- **Historique d'usage** : taux de réussite, coût, durée, tendance d'utilisation par skill.
- **Procédures versionnées** : procédures opérationnelles, conditions d'exécution, modifié par (audit trail).

**Objet central** — Le registre des skills en vue par défaut.

**Panneaux secondaires** — Détail d'un skill (description, agents compatibles, historique d'usage, coût moyen), détail d'une procédure versionnée.

**Données principales** — Skills et Procédures :
- **Skill** : id, name, category (tool/connector/adapter/capability), description, agents_capable (list), models_compatible (list), permissions_required (list), executable.
- **Usage history** : success_rate (%), calls_count, avg_duration, avg_cost, trend (↑↓→), failures_recent.
- **Procédure versionnée** : procedure_id, version, description, conditions, steps (ordered), updated_at, updated_by (audit).

**Actions autorisées** — Consulter uniquement. Aucune édition (source canonique = `registry/registry.json` et mises à jour via CI/CD, INV-009). À terme : historique de versioning, audit trail des modifications.

**États**
- Vide : registry vide/corrompu (cas anormal).
- Loading : chargement du registre.
- Offline : n/a si statique.
- Erreur : registry illisible.
- PLACEHOLDER : véritables skills, permissions détaillées, historique d'usage, procédures versionnées — données non structurées ou absentes.

**Existe déjà dans le repo** — Configuration : `registry/registry.json` (4 agents + tags `strengths`, tiers). Identité et configuration LIVE. Historique d'usage, permissions détaillées, procédures versionnées : non structurés. Aucun endpoint `/api/skills`.

**Dépend des phases suivantes** — Endpoint `/api/skills` pour servir le registre. Structuration de "véritables skills" (au-delà des `strengths` tags) avec descriptions, permissions, agents/modèles compatibles. Historique et stats d'utilisation calculées depuis le ledger. Procédures versionnées et leur audit trail. Matrice des permissions (qui peut faire quoi sous quelles conditions).

**Note** : Les **contrôles vérifiables** (`CTRL-*`) n'appartiennent pas à cet espace. Ils font partie de la zone utilitaire `System` (Governance / Controls). Les contrôles peuvent être référencés comme **politiques applicables** à un skill, mais ne définissent pas une compétence.

---

#### 2.5 — Automations

**Objectif** — Catalogue des automatisations et templates de workflow : règles de déclenchement et actions qui s'exécutent sans intervention humaine directe, restant conformes au principe directeur (pas d'exécution arbitraire, actions de gouvernance contrôlées et auditables).

**Vue par défaut** — Liste des automatisations actives, avec état (enabled/disabled), dernier déclenchement, résultat (success/failure/pending).

**Sous-vues**
- **Catalogue des automatisations** : liste des rules/templates disponibles, groupées par type (event-based, scheduled, condition-based).
- **Détail d'une automatisation** : définition complète (trigger, actions, conditions), historique d'exécution, taux de succès, audit trail.

**Objet central** — La liste des automatisations en vue par défaut.

**Panneaux secondaires** — Détail d'une automatisation sélectionnée (trigger + actions développées, logs d'exécution récents, performance metrics).

**Données principales** — Modèle Automation :
- **Identification** : id, name, description, enabled (boolean), created_at, created_by, owner.
- **Trigger** : type (event / schedule / condition), specification (ex: "on check.run with violation", ou "every 6h", ou "when budget exceeds 80%").
- **Actions** (ordered list) :
  - action_type (notify, log, escalate, retry_mission, pause_mission, other).
  - target (qui/quoi reçoit l'action : agent, user, system, mission_id).
  - parameters (dict spécifique à l'action).
  - condition (optionnel : si l'action ne s'exécute que sous certaines conditions).
- **Governance** :
  - requires_approval (boolean : l'action a-t-elle besoin d'une approbation avant exécution ?)
  - approval_authority (ceo / manager / admin, ou absent si auto-approval).
  - audit_enabled (boolean : action auditée ?).
- **Performance** : success_rate (%), last_execution_ts, execution_count, failure_count.

**Actions autorisées** — Consulter, activer/désactiver une automatisation existante. À terme (gouvernance) : créer une nouvelle automatisation (probablement via un builder de workflow avec templates pré-approuvés, jamais librement). Jamais exécuter une action arbitraire — cohérent avec INV-005 et le principe directeur.

**États**
- Vide : aucune automatisation configurée (état normal d'un système sans besoins d'automatisation).
- Loading : chargement du catalogue.
- Offline : n/a si triggers sont locaux au ledger.
- Erreur : échec du catalogue ou du ledger.
- PLACEHOLDER : Aucune implémentation existante — le concept et le modèle sont définis (voir ci-dessus), mais aucun backend ne l'expose.

**Existe déjà dans le repo** — Rien. Aucun concept d'automatisation n'existe (ni `server/`, ni `runtime/`, ni `registry/`).

**Dépend des phases suivantes** — **Implémentation bloquée par les décisions techniques suivantes** (à documenter dans `UI_DECISIONS.md`) :
- Quels types de triggers sont permis ? (événements du ledger, horaires cron, conditions manuelles, autre ?)
- Quels types d'actions ? (notify, log, escalate, retry, pause, créer une mission ?, autre ?)
- Qui crée/gère les automatisations ? (admin only, utilisateurs autorisés, système auto-créé ?)
- Comment l'approbation fonctionne-t-elle pour les actions sensibles ? (INV-005)
- Quel est le cycle de vie d'une automatisation ? (draft, active, disabled, archived ?)

Une fois ces décisions prises : nouveau module runtime pour l'exécution des triggers + actions. Nouveaux endpoints `/api/automations`. Éventuellement un builder UI (future phase), ou saisie manuelle de définitions YAML/JSON avec validation stricte.

---

#### 2.6 — Results

**Objectif** — Consulter les livrables et artefacts concrets générés par les missions : ce qui a été créé, produit, généré (code, documentation, rapports, décisions, réalisables), indépendamment de la métadonnée administrative de clôture.

**Vue par défaut** — Galerie/catalogue des artefacts générés, groupé par mission (ou par type : code/doc/report/decision/deliverable), trié par date de création, avec filtres (domaine, agent créateur, type).

**Sous-vues**
- **Catalogue des artefacts** : vue par défaut, explorable par mission ou par type.
- **Détail d'un artefact** : contenu prévisualisé (ou lecteur natif pour le type), métadonnées complètes, version history le cas échéant, liens vers les événements qui l'ont produit, lien vers la mission parent.

**Objet central** — La galerie/liste des artefacts en vue par défaut.

**Panneaux secondaires** — Détail d'un artefact sélectionné (preview + metadata), possibilité d'ouvrir, télécharger, visionner l'historique des versions.

**Données principales** — Modèle Artifact :
- **Identification** : artifact_id, mission_id, type (code / doc / report / decision / deliverable / other), title, description.
- **Metadata** : created_at, created_by (agent_id + agent_name), size (bytes), format (extension).
- **Content** : content_preview (résumé ou aperçu du contenu), external_link (si stocké ailleurs : repo, Figma, GDoc, Slack thread, etc.).
- **Traceability** : event_ids (les événements qui ont produit cet artefact), mission_phase (ou étape du graphe).
- **Versioning** (optionnel) : version (ex. 1.0, 1.1), version_history (list of { version, created_at, changes_summary }).

**Actions autorisées** — Consulter, ouvrir/télécharger un artefact, explorer les versions antérieures. À terme (gouvernance) : demander une révision d'un artefact, ajouter des annotations/approbations, archiver/dépublier un artefact.

**États**
- Vide : aucun artefact généré (mission trop jeune, ou aucune mission complétée).
- Loading : chargement du catalogue d'artefacts.
- Offline : mêmes règles que Missions.
- Erreur : échec de récupération du catalogue.
- PLACEHOLDER : Aucun placeholder connu si les artefacts sont tracés dans le ledger. Les données seraient entièrement LIVE dès que l'événement `artifact.created` (ou équivalent) passe par le ledger.

**Existe déjà dans le repo** — Closure/rapport de mission : données partiellement disponibles via `/api/missions`. Artefacts structurés (Artifact model) : **aucune structure confirmée**. Événement `artifact.created` : **non confirmé**. Endpoint `/api/artifacts` : **n'existe pas**. Le ledger trace les événements mission mais ne catégorise pas les artefacts comme catalogue distinct.

**Dépend des phases suivantes** — Clarification critique : quels artefacts génère le système ? Comment sont-ils tracés/stockés ? Contrat Artifact à définir (structure, métadonnées, format). Aucune donnée ne confirme que les artefacts sont actuellement produits et tracés. Hypothèse : closure et résultats de mission existent, mais pas un catalogue d'artefacts distinct. À confirmer avant de construire cette vue.

---

#### 2.7 — Evaluations

**Objectif** — Évaluation holistique de la qualité, de la fiabilité et de la confiance du système : synthèse de conformité (contrôles), scores de qualité multi-rubrique, tendances historiques, et diagnostics post-erreur.

**Vue par défaut** — Tableau de bord d'évaluation avec trois sections principales :
1. **Synthèse de conformité** : par contrôle (`CTRL-*`), nombre d'exécutions, taux de respect, tendance (↑↓→), dernière violation.
2. **Scores de qualité** : par domaine (code, orchestration, communication, etc.), note agrégée (ex. 8/10), rubrique justifiant chaque score, domaines en régression.
3. **Diagnostics post-erreur** : distribution des niveaux N1/N2/N3 (INV-008), causes récurrentes, recommandations résultantes.

**Sous-vues**
- **Conformité détaillée** : liste complète des contrôles avec stats (executions, violations, trend), drill-down dans les `check.run` associés.
- **Scores de qualité** : détail par rubrique, evidence (quelles exécutions soutiennent ce score), historique du score dans le temps.
- **Diagnostics post-erreur** : historique des incidents par niveau N1/N2/N3, causes groupées, actions correctives proposées/appliquées.

**Objet central** — Le tableau de synthèse en vue par défaut (les trois sections visibles ou en onglets).

**Panneaux secondaires** — Détail d'un contrôle sélectionné, d'une rubrique qualité, ou d'un diagnostic ; drill-down dans les événements sous-jacents.

**Données principales** — Agrégations (à calculer) :
- **Par contrôle** : control_id, executions_count, violations_count, violation_rate (%), last_violation_ts, trend_indicator (↑↓→), linked_check_runs (IDs).
- **Par domaine** : domain, quality_score (0–100), rubric_scores (dict de sous-scores avec poids), evidence_count (nombre d'exécutions soutenant le score), regression_indicator (boolean).
- **Diagnostics N1/N2/N3** : level (1/2/3 per INV-008), count_per_level, causes_by_frequency (top 5), linked_controls (quels contrôles ont échoué), recommended_actions (list).

**Actions autorisées** — Consulter uniquement dans un premier temps. À terme (gouvernance) : demander une ré-évaluation manuelle d'un domaine (ex. révision humaine du score de "code"), explorer les actions correctives proposées, marquer une action comme appliquée (audit).

**États**
- Vide : aucun `check.run` ou donnée de qualité accumulée (système neuf).
- Loading : agrégation des contrôles et calcul des scores de qualité.
- Offline : mêmes règles que Missions.
- Erreur : échec de l'agrégation ou de la lecture du ledger.
- PLACEHOLDER : Les agrégations (taux, scores, tendances, niveaux N1/N2/N3) sont PLACEHOLDER tant qu'aucune logique d'agrégation n'existe. Les événements bruts `check.run` sont LIVE. Le concept de "rubrique qualité" n'a aucune donnée ou définition structurée.

**Existe déjà dans le repo** — Événements bruts `check.run` dans le ledger (via `/api/events`), contenant `rule`, `matched`, `violation`, `findings`. Aucune logique d'agrégation. INV-008 (niveaux de diagnostic post-erreur) existe mais n'a aucune trace structurée dans le ledger : seuls `check.run` et `agent.result` existent, sans champs pour "niveau d'escalade du diagnostic". Aucune notion de "rubrique qualité" ou de "score de qualité" n'existe.

**Dépend des phases suivantes** — Nouveau module runtime pour l'agrégation des `check.run` et le calcul des rates/tendances (similaire à `mission-projection.mjs`). Définition d'une **carte des rubriques de qualité** : quels domaines évaluer, critères, poids, comment scorer chacun (probablement hors du ledger, dans une configuration ou schema canonique). Liaison entre `check.run` du ledger et les niveaux de diagnostic N1/N2/N3 (INV-008) — actuellement, aucun événement ne marque son niveau. Éventuellement, des données externes (human feedback, post-mortems annotés) pour enrichir les scores.

---

### Résumé — maturité des données par espace

| Espace | Statut maturité | Vue frontend | Travail UI restant | Travail backend |
|---|---|---|---|---|
| Missions | Partielle : cockpit détail existant, liste absente | Oui (cockpit Phase 1/2b) | Construire liste des missions | Topologie réelle, états nœuds, métriques |
| Agents | Partielle : configuration LIVE, runtime incomplet | Non | Construire liste + détail | Métriques runtime, performance historique |
| Skills | Partielle : tags disponibles, skills réels non structurés | Non | Construire registre + historique | Endpoint `/api/skills`, matrice permissions, historique usage |
| Memory | Faible : historique brut seulement | Non | À inventer (episodic/semantic/procedural) | Endpoints `/api/memory/*`, agrégation, inférence |
| Results | Faible/non confirmée : closure existe, artefacts absents | Non | À clarifier (contrat Artifact ?) | Définir traçage des artefacts, `/api/artifacts` ? |
| Evaluations | Partielle : événements bruts, pas d'agrégation | Non | Construire synthèse + diagnostics | Module d'agrégation, scores, rubriques qualité |
| Automations | Aucune implémentation : vision définie, backend absent | Non | (design attend backend) | Triggers, actions, approbations, cycle de vie |

---

*Fin de la Section 2. En attente de validation avant de poursuivre avec la Section 3 (Navigation).*

*Notes de maturité* :
- **Missions** : Cockpit détail (Phase 1/2b) complètement existant. Données LIVE partielles (mission, événements, agents, budget). Données PLACEHOLDER (topologie, états nœuds, inspector, terminal, health). Liste de missions n'existe pas.
- **Agents** : Configuration LIVE (registry.json). Activité DERIVED (via ledger). Charge/performance : partielles ou absentes. Candidat rapide pour une liste + détail.
- **Skills** : Tags `strengths` LIVE. Véritables skills, permissions, historique d'usage : non structurés. Pas d'endpoint.
- **Memory** : Aucune structure. À inventer entièrement.
- **Results** : Structure Artifact non confirmée. Pas d'`artifact.created` confirmé. Clarification requise avant de construire cette vue.
- **Evaluations** : Événements `check.run` LIVE. Agrégations, scores, rubriques : non existants.
- **Automations** : Vision complètement définie (modèle Automation, trigger/actions, governance). Implémentation bloquée par décisions techniques sur ce qui constitue un trigger/action valide et les processus d'approbation.

---

## UI-0 — Section 3 : Navigation

Cette section couvre les modèles et règles de navigation dans Cortex Lab, traversant les sept espaces métier et les deux zones utilitaires. Aucun style, couleur, typographie détaillée n'est défini ici — seules structures, routes, hiérarchies et comportements.

### 3.1 — Navigation globale entre espaces

**Structure de la sidebar**

La sidebar persiste sur tous les écrans. Elle contient deux blocs distincts, visuellement séparés :

**Bloc métier** (7 espaces, toujours disponibles, dans cet ordre) :
1. Missions
2. Agents
3. Memory
4. Skills
5. Automations
6. Results
7. Evaluations

**Bloc utilitaire** (2 espaces, en bas de sidebar, visuellement séparé du bloc métier) :
- System (connexion, services, gateways, santé, quotas, constitution/invariants, contrôles)
- Settings (préférences utilisateur, apparence, configuration non opérationnelle)

**Interaction avec la sidebar**

- Cliquer sur un élément de la sidebar change d'espace et affiche sa vue par défaut.
- L'élément actif est marqué (visual indicator : contraste, marker, ou autre, définition typographique en UI-1).
- Survoler un élément (desktop) ou maintenir appuyé (mobile) ne doit pas changer d'espace.
- La sidebar ne doit jamais afficher de badge de notification ou de compteur opérationnel (elle est une navigation structurelle, pas un tableau de bord).

### 3.2 — Bloc System vs bloc métier : séparation comportementale

**Bloc métier** — Espaces dédiés à la supervision de missions et à l'observation des agents, skills, memory. L'utilisateur y explore des données opérationnelles, des missions en cours ou terminées, de l'historique.

**Bloc System** — Espace dédiée à la configuration, la constitution, la governanc et le suivi technique du système lui-même. La séparation visuelle (espacement, bordure optionnelle, position en bas) signale à l'utilisateur : "ce que je fais ici affecte comment le système fonctionne, pas une mission spécifique."

Règle : Une mission active (si elle existe) **ne persiste pas** en traversant de bloc métier vers bloc System. Entrée dans System réinitialise le contexte de mission actuelle. Sortie de System restaure la mission active précédente (si elle existait).

### 3.3 — Persistance de la mission active

**Concept de mission active**

Une mission "active" est un contexte partagé entre les espaces métier. Elle représente la mission ou l'objet que l'utilisateur est en train d'explorer prioritairement.

**Règles de persistance**

- Naviguer entre Missions → Agents → Memory → Skills → Automations → Results → Evaluations : la mission active persiste.
- La mission active n'est affichée que si elle est pertinente à l'espace actuel (ex. dans Agents, on peut voir "agents assignés à la mission active", mais ce n'est pas obligatoire).
- Entrée dans System : mission active est **temporairement suspendue** (pas oubliée).
- Sortie de System : mission active est restaurée si elle existait.
- Fermeture de la mission (clôture, annulation, ou expiration) : mission active est réinitialisée ; si elle était affichée dans le cockpit Missions, l'utilisateur revient à la liste des missions.
- Sélection d'une nouvelle mission (depuis liste Missions, ou deep link) : nouvelle mission devient la mission active.

**Indicateur visuel de mission active**

La topbar contient le nom de la mission active et son statut (si mission active existe). Ceci permet à l'utilisateur de toujours savoir quel est le contexte partagé, sans le chercher dans le workspace.

### 3.4 — Trois niveaux de navigation UI : changer d'espace vs ouvrir un objet vs ouvrir un panneau

**Niveau 1 : Changer d'espace**

Cliquer sur un élément sidebar = changer d'espace, afficher la vue par défaut de cet espace (ex. liste Agents, tableau Evaluations, etc.). Ceci est la navigation à plus gros grain.

**Niveau 2 : Ouvrir un objet**

Depuis une vue liste ou tableau, sélectionner une ligne, une card, ou cliquer sur un lien d'objet = ouvrir le détail de cet objet dans le même espace. Le workspace change de contenu, passant de liste/tableau à détail, mais on reste dans le même espace. Exemple :
- Liste Agents → cliquer sur "Claude" → Détail de Claude, même espace Agents.
- Tableau Evaluations → cliquer sur "CTRL-NO-DEBUG-LOG" → Historique complet de ce contrôle.

**Niveau 3 : Ouvrir un panneau contextuel**

Depuis un détail ou une vue liste, ouvrir un panneau secondaire **sans quitter l'objet/espace actuel** :
- Panneau d'infobulle (hover, clic d'info), panneau de détail enrichi (sidebar ou overlay modal léger).
- Panneau d'actions (ex. "approuver cette étape" depuis le cockpit Missions).
- Panneau de relations (ex. "agents impliqués dans cette mission").

Règle clé : Un panneau doit **toujours** pouvoir se fermer avec un escape key ou un X button, sans perte de contexte. Fermer le panneau restaure la vue antérieure.

**Navigation croisée : de l'objet A à l'objet B**

Si un utilisateur est en détail Agent et veut voir les Résultats produits par cet agent (Résultats de missions où Agent a participé) :
- Soit : cliquer sur un lien "Voir les résultats" depuis le détail Agent. Ceci ouvre la vue Results **ET change d'espace** (Agents → Results). La mission active peut être préservée si pertinente.
- Soit : ouvrir un panneau "Résultats de cet agent" depuis le détail Agent, restant dans l'espace Agents.

Le choix (panneau vs changement d'espace) dépend du volume de données et de l'importance du lien. À décider au cas par cas en phase UI-3 (détails des compositions).

### 3.5 — Routes et deep links proposés

Cortex Lab fonctionne sur une application React/SPA. Les routes suivantes sont proposées pour permettre des deep links et de la navigation directe :

```
/                                    → Missions, liste (vue par défaut si aucune mission active)
/missions                            → Missions, liste
/missions/:id                        → Missions, détail du cockpit pour mission :id
/missions/:id/graph/:nodeId          → Missions, détail du cockpit, nœud :nodeId sélectionné

/agents                              → Agents, liste
/agents/:id                          → Agents, détail de l'agent :id

/memory                              → Memory, onglet Historique
/memory/history                      → Memory, onglet Historique (explicite)
/memory/learning                     → Memory, onglet Apprentissages
/memory/procedures                   → Memory, onglet Procédures

/skills                              → Skills, registre (liste)
/skills/:id                          → Skills, détail du skill :id

/automations                         → Automations, liste
/automations/:id                     → Automations, détail de l'automatisation :id

/results                             → Results, catalogue (liste)
/results/:artifactId                 → Results, détail de l'artefact :artifactId

/evaluations                         → Evaluations, tableau synthèse (vue par défaut)
/evaluations/conformity              → Evaluations, synthèse de conformité
/evaluations/quality                 → Evaluations, scores de qualité
/evaluations/diagnostics             → Evaluations, diagnostics post-erreur

/system                              → System, vue par défaut (connexion/santé)
/system/constitution                 → System, invariants/contrôles
/system/health                       → System, santé du système

/settings                            → Settings, préférences utilisateur
```

**Paramètres query optionnels** (pour filtres et persistance) :

```
?filter=:fieldName::value            → Filtre appliqué à la liste/tableau actuel
?sort=:fieldName                     → Tri appliqué
?page=:n                             → Pagination (si applicable)
?view=:viewName                      → Vue alternative dans l'espace (ex. ?view=compact)
?highlightId=:objectId               → Mettre en évidence un objet dans la liste (pour retour arrière)
```

Exemples :
- `/agents?filter=status:active&sort=name` → Liste agents, filtrés par statut actif, triés par nom.
- `/missions/:id?view=timeline` → Cockpit mission avec vue timeline (si existe).
- `/results?filter=type:code&highlightId=artifact-123` → Catalogue résultats, filtrés, artifact-123 mis en évidence.

### 3.6 — Breadcrumbs

**Affichage des breadcrumbs**

Les breadcrumbs apparaissent dans la topbar, juste en dessous du titre de la mission active (si elle existe).

Modèle : `[Espace] > [Objet sélectionné] > [Sous-objet optionnel]`

Exemples :
- Missions > Mission-001 > Nœud "Frontend Agent"
- Agents > Claude > Activité récente
- Memory > Apprentissages > Domaine: Orchestration
- Results > Artifact-2024-001

**Comportement des breadcrumbs**

- Cliquer sur un élément breadcrumb navigue vers cet objet/niveau.
- Le dernier élément (objet actuel) n'est pas cliquable (il représente la position actuelle).
- Si on est à la vue liste (ex. liste Agents), les breadcrumbs affichent seulement `[Espace]`, non cliquable.
- Naviguer via breadcrumb ne ferme pas les panneaux ouverts, mais peut changer le contenu principal du workspace.

### 3.7 — Navigation chaîne : Mission → Agent → Result → Evaluation → Memory

L'une des tâches communes en supervision est de suivre une chaîne de causalité/responsabilité : "cette mission a eu ce problème, qui a impliqué cet agent, qui a produit ce résultat, dont l'évaluation de qualité montre cet apprentissage."

**Routes de liaison proposées**

- **Depuis Missions détail** : lien vers les agents assignés (ouvre détail Agent ou panneau d'agents).
- **Depuis Agents détail** : lien vers les résultats produits par cet agent (ouvre Results, filtrés par agent).
- **Depuis Results détail** : lien vers la mission qui a produit l'artefact (ouvre Missions détail).
- **Depuis Results détail** : lien vers l'évaluation de qualité associée (ouvre Evaluations, filtrée par artifact/mission).
- **Depuis Evaluations détail** : lien vers les apprentissages associés (ouvre Memory, filtré par domaine/pattern).

Ces liens apparaissent comme :
- Texte cliquable inline dans le contenu détail.
- Boutons "voir en détail" dans les panneaux secondaires.
- Relations listées dans un panneau "Connexions" ou similaire.

**Pas de navigation forcée** : l'utilisateur ne doit jamais être forcé de quitter un détail pour en explorer un autre. Il clique sur un lien si ça l'intéresse, sinon il reste où il est.

### 3.8 — Retour arrière et conservation du contexte

**Bouton retour du navigateur**

Le bouton retour du navigateur doit restaurer la route précédente **ET** tous les filtres, tris, sélections, et état des panneaux qui existaient avant.

Pour cela, l'état de l'UI (filtres appliqués, objet sélectionné, onglet actif) doit être codifié dans l'URL (via params query) chaque fois qu'il change, afin que le retour arrière soit exact.

**Historique de navigation côté application**

Un historique application-level local (non le historique HTML natif) peut aussi être maintenu pour proposer une navigation "retour" plus intelligente (ex. "Retour à la liste d'agents" quand on est en détail agent, plutôt que "retour à la page précédente du navigateur").

**Règle de conservation du contexte**

Quand l'utilisateur navigue vers Agents, puis vers Memory, puis revient à Agents (via breadcrumb, sidebar, ou retour), il devrait retrouver :
- La même liste (même filtres/tris/pagination).
- L'agent précédemment sélectionné mis en évidence (paramètre `?highlightId=`).
- Les panneaux ouverts dans la vue Agents antérieure restaurés.

### 3.9 — Persistance des filtres et sélection

**Filtres**

Les filtres appliqués à une liste/tableau (ex. "statut: active" dans Agents, "domaine: code" dans Results) doivent **persister** quand on quitte et revient à cet espace. Ceci est réalisé par :
- Encodage des filtres en paramètres query (`?filter=...`).
- Restauration des filtres depuis l'URL au chargement de la page ou du retour à l'espace.

**Sélection et tri**

Le tri appliqué (ascendant/descendant) doit aussi persister (`?sort=fieldName:asc/desc`).

La sélection d'une ligne ou card dans une liste persiste aussi (`?highlightId=objectId`), plaçant à sa position lors du retour.

**Remise à zéro**

Un bouton "Réinitialiser les filtres" dans la vue liste restaure la configuration par défaut (pas de filtres, tri par défaut, première page).

### 3.10 — Recherche globale

**Champ de recherche**

Un champ de recherche global apparaît dans la topbar (disponible depuis tout écran). Il offre une recherche cross-space rapide.

Interaction :
- Cliquer sur le champ ou commencer à taper active la recherche.
- Une liste de résultats suggérés apparaît (dropdown ou overlay), groupée par type d'objet : Missions, Agents, Skills, Memory terms, Results, etc.
- Taper continue de filtrer les résultats.
- Cliquer sur un résultat navigue vers le détail de cet objet (changement d'espace si nécessaire) ou ouvre un panneau détail.
- Appuyer sur Entrée navigue vers le premier résultat ou ouvre une page de résultats de recherche complets (si plusieurs résultats).

**Portée de la recherche**

Par défaut, la recherche explore :
- Noms de missions, domaines, statuts.
- Noms et rôles d'agents.
- Noms de skills et capacités.
- Termes de Memory (historique, apprentissages, procédures).
- Artefacts par titre ou description.
- Scores d'Evaluations et domaines.

**Paramétrage optionnel**

Une option "Affiner la recherche" peut permettre de filtrer par type d'objet (ex. "Agents seulement") ou domaine.

### 3.11 — Command palette (optionnel, UI-2+)

**Concept**

Un command palette global (activé par Ctrl+K ou Cmd+K, ou via un bouton dans la topbar) permet une navigation par commande textuelle :

Exemples de commandes :
- "Ouvrir la mission MIS-2024-001"
- "Aller aux agents"
- "Voir l'historique de X"
- "Réinitialiser les filtres"
- "Basculer hors ligne" (mode offline simulé, si applicable)

Le palette fonctionne comme une barre de commande : l'utilisateur tape une requête, voit des suggestions, et sélectionne.

**Note** : Cette fonctionnalité est optionnelle pour UI-0. Elle peut être ajoutée en UI-2 ou plus tard si elle apporte une vraie valeur par rapport à la navigation sidebar + recherche globale.

### 3.12 — Liens vers un nœud précis du graphe d'exécution

**Deep link vers un nœud**

Depuis une autre partie de l'application (Results, Memory, Evaluations) ou un lien externe, on peut créer un lien vers une mission + un nœud spécifique du graphe.

Route : `/missions/:missionId/graph/:nodeId`

Comportement :
- Navigation vers le cockpit Missions pour la mission `:missionId`.
- Nœud `:nodeId` est automatiquement sélectionné (its highlighted/marked).
- L'inspecteur affiche les détails du nœud sélectionné.
- Optionnellement, la vue peut scroller/zoom vers le nœud dans le graphe.

**Exemple** : Un lien depuis Results vers "le nœud qui a produit cet artefact" navigue vers `/missions/MIS-001/graph/nodeId-frontend`, mettant en évidence automatiquement le nœud Frontend Agent dans le cockpit.

### 3.13 — États offline et données obsolètes

**Détection de l'état offline**

Cortex Lab surveille la connexion via `/api/stream` (SSE) ou un heartbeat HTTP. Quand la connexion se perd, un indicateur s'affiche dans la topbar : "Offline — dernière synchro : 14h47" (ou heure du dernier update succès).

**Comportement offline**

- Les listes et détails affichent les **dernières données connues** (cachetées en local).
- Les données non actualisées sont marquées visuellement comme "stales" ou "à jour à [timestamp]".
- Aucune action d'écriture (approuver, escalader, etc.) n'est permise offline. Si l'utilisateur tente, un message explique pourquoi.
- Les filtres continuent de fonctionner (ils filtrent les données locales cachetées).
- Dès que la connexion revient, un refresh automatique met à jour les données, et l'indicateur offline disparaît.

**Rétention des données**

Les données en cache local persisten à travers les changements d'onglet et de navigateur (localStorage ou sessionStorage), pour permettre une consultation même après une déconnexion prolongée (bien que les données soient évidemment stale).

### 3.14 — Adaptation desktop, tablette, mobile

**Desktop (≥1024px de largeur)**

- Sidebar persiste à gauche (ou peut être réduite à icônes seulement si choix utilisateur).
- Topbar reste en haut.
- Workspace occupe le reste, ≥3 colonnes possibles (ex. résumé, contenu, inspecteur dans Missions).
- Panneaux secondaires s'ouvrent en overlay ou en sous-colonnes (layout flexible).
- Recherche et command palette visibles dans topbar.

**Tablette (768px–1024px)**

- Sidebar peut être en vue compactée (icônes seulement, ou togglable via hamburger).
- Topbar reste en haut.
- Workspace adapté à 2 colonnes max.
- Panneaux secondaires en overlay modal léger (plutôt qu'en sous-colonne).
- Recherche toujours accessible (champ compact ou bouton recherche dans topbar).

**Mobile (<768px)**

- Sidebar en hamburger menu (caché par défaut, ouvert au tap).
- Topbar restante compacte : titre mission (1 ligne) + bouton hamburger + bouton recherche.
- Workspace full-width, contenu stacké verticalement (1 colonne).
- Panneaux secondaires en modal fullscreen ou drawer depuis le bas (swipe down pour fermer).
- Breadcrumbs simplifiés : seulement l'espace + objet, pas de sous-détails.
- Command palette : déclenchable via bouton search ou Ctrl+K (mobile n'a pas Ctrl+K natif, donc via bouton).
- Listes à scroll vertical, recherche en champ collant en haut.

**Règles générales responsive**

- Aucun contenu ne doit jamais exiger un scroll horizontal.
- Les panneaux doivent se réadapter fluidement quand on rotate un appareil (landscape/portrait).
- Les interactions au survol (desktop) deviennent des interactions au tap/appui long (mobile).

### 3.15 — Règles de non-perte d'utilisateur dans les panneaux imbriqués

**Prévention de l'enfouissement**

Cortex Lab peut avoir plusieurs niveaux de panneaux ouverts (ex. cockpit Missions + panneau "agents de cette mission" + panneau "détails d'un agent" + panneau "résultats de cet agent"). L'utilisateur doit **jamais se sentir "perdu"** dans cette imbrication.

**Règles appliquées**

1. **Fermeture en cascade** : Fermer le panneau le plus interne (via Escape ou X button) ferme seulement ce panneau, restaurant le panneau précédent. On peut revenir niveau par niveau.

2. **Breadcrumbs visuels** : La topbar affiche la chaîne complète d'emboîtement (ex. "Missions > Mission-001 > Agents > Claude > Activité"), permettant de sauter à n'importe quel niveau.

3. **Fermeture complète** : Un bouton "Fermer tous les panneaux" dans la topbar ramène directement à la vue principale.

4. **Limite de profondeur** : Les panneaux imbriqués ne doivent jamais dépasser 3 niveaux d'imbrication (ex. vue principale + 2 panneaux max). Si un 4e niveau est nécessaire, il remplace le panneau le plus superficiel au lieu de s'empiler (ou s'ouvre en full-screen modal).

5. **Largeur des panneaux** : Sur desktop, chaque panneau occupe une zone clairement délimitée (sidebar ou colonne). Sur mobile, chaque panneau remplace le précédent (pile linéaire), avec possibilité de retour via breadcrumb ou bouton retour.

6. **Contraste et hiérarchie** : Les panneaux imbriqués sont visuellement graduées en profondeur (ex. contraste, teinte de fond légèrement différente), pour que l'utilisateur sache toujours "à quel niveau je suis".

7. **Sauvegarde du contexte** : Quand on ferme un panneau d'imbrication profonde, le contexte du panneau précédent (scroll position, sélection, contenu) est restauré automatiquement.

8. **Bouton "En arrière" intelligent** : Un bouton "← Retour" dans chaque panneau (si pas au niveau racine) remet en avant le panneau précédent. Ce n'est pas un retour arrière navigateur global, mais une navigation au sein de la pile de panneaux de l'espace actuel.

---

*Fin de la Section 3. En attente de validation avant de poursuivre.*
