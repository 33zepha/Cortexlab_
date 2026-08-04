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

**Objectif** — Voir le catalogue des capacités opérationnelles exécutables du système : qui peut faire quoi, avec quelles permissions, et quel niveau de maîtrise.

**Vue par défaut** — Registre des compétences par agent : matrice ou liste montrant chaque agent et ses `strengths` (tags de capacité : "code", "orchestration-agents", "raisonnement", etc.), avec le niveau associé.

**Sous-vues**
- **Compétences par agent** : qui possède quelle capacité, niveau de maîtrise, contrôles associés.
- **Matrice des permissions** : qui a le droit de faire quoi, associé aux levels d'autorité (ceo/manager/worker selon `registry.json`).
- **Capacités par domaine** : quelles opérations sont disponibles dans chaque domaine (frontend, backend, etc.), qui peut les exécuter.

**Objet central** — La matrice compétences × agents en vue par défaut.

**Panneaux secondaires** — Détail d'une capacité (qui peut l'exécuter, au quel niveau d'autorité, contrôles appliqués), détail d'un agent (ses capacités, ses restrictions de permission par domaine).

**Données principales** — Registre :
- **Capacité** : id, name, domain, description, agents_capable (list with levels), controls_apply (list).
- **Agent skills** : agent_id, agent_name, agent_tier (ceo/manager/worker), capabilities (list), permissions_by_domain (dict with restrictions).

**Actions autorisées** — Consulter uniquement. Aucune édition (source canonique = `registry/registry.json`, INV-009). À terme : historique d'utilisation d'une compétence (stats de succès/échec).

**États**
- Vide : registry vide/corrompu (cas anormal, à signaler).
- Loading : chargement du registry et matrice de permissions.
- Offline : n/a si statique.
- Erreur : registry illisible.
- PLACEHOLDER : aucun placeholder connu — le registre et ses données sont complètement LIVE une fois chargés.

**Existe déjà dans le repo** — `registry/registry.json` (4 agents + tags `strengths` + tiers ceo/manager/worker), `manifests/controls.json` (2 contrôles, pas encore croisés avec les compétences). Pas d'endpoint `/api/skills`.

**Dépend des phases suivantes** — Endpoint `/api/skills` ou `/api/capabilities` pour servir le registre complet. Concept et donnée pour la "matrice des permissions" (levels d'autorité croisés avec domaines et capacités) — actuellement inexistant structurellement. Lien explicite entre contrôles et capacités (qui s'applique à quelle opération). Historique et stats d'utilisation par compétence.

**Note** : Les **contrôles vérifiables** (`CTRL-*`) n'appartiennent pas à cet espace ; ils font partie de la zone utilitaire `System` avec le reste de la Constitution.

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
- Vide : aucune automatisation configurée (état normal d'un système sans besoins d'automatisation, pas une erreur).
- Loading : chargement du catalogue.
- Offline : n/a si triggers sont locaux au ledger.
- Erreur : échec du catalogue ou du ledger.
- PLACEHOLDER : Structure entièrement PLACEHOLDER. Aucun concept, aucune donnée backend n'existe. Les conteneurs à définir sont : ce qui constitue un trigger valide, ce qui constitue une action valide, qui approuve quoi.

**Existe déjà dans le repo** — Rien. Aucun concept d'automatisation n'existe (ni `server/`, ni `runtime/`, ni `registry/`).

**Dépend des phases suivantes** — **Décision produit préalable requise** (à documenter dans `UI_DECISIONS.md`) :
- Quels types de triggers sont permis ? (événements du ledger, horaires cron, conditions manuelles, autre ?)
- Quels types d'actions ? (notify, log, escalate, retry, pause, créer une mission ?, autre ?)
- Qui crée/gère les automatisations ? (admin only, utilisateurs autorisés, système auto-créé ?)
- Comment l'approbation fonctionne-t-elle pour les actions sensibles ? (INV-005)
- Quel est le cycle de vie d'une automatisation ? (draft, active, disabled, archived ?)

Une fois cette décision prise : nouveau module runtime pour l'exécution des triggers + actions. Nouveaux endpoints `/api/automations`. Éventuellement un builder UI (future phase), ou saisie manuelle de définitions YAML/JSON avec validation stricte.

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

**Existe déjà dans le repo** — À clarifier : le ledger trace-t-il les artefacts ? Y a-t-il un événement `artifact.created` ? Actuellement, `/api/missions` sert la clôture et le budget, pas un endpoint `/api/artifacts`. Aucun frontend n'explore les artefacts aujourd'hui.

**Dépend des phases suivantes** — Clarification : comment les artefacts sont-ils tracés dans le ledger ? Formats ? Métadonnées minimales ? Endpoint `/api/artifacts` ou extension de `/api/missions/{id}` avec une section `artifacts`. Logique de preview/visionning par type (syntax highlight pour code, rendu pour markdown, etc.). Possible intégration avec des stockages externes (repos, Figma, Docs). Version history et diffing optionnel.

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

| Espace | Donnée LIVE existante | Vue frontend existante | Travail restant | Priorité candidat |
|---|---|---|---|---|
| Missions | Oui (complète) | Oui (cockpit Phase 1/2b) | Généraliser en liste + détail, gouvernance | Généraliser Phase 2d |
| Agents | Oui (complète) | Non (aucun composant dédié) | Construire liste + détail | Rapide (données prêtes) |
| Results | Oui (complète, non exploitée) | Non | Construire vue des artefacts | **Plus rapide** (données existantes) |
| Skills | Partielle (registry + tags, pas d'API) | Non | Endpoint API + matrice permissions + vue | Moyen (données prêtes, API manquante) |
| Memory | Aucune structure | Non | Endpoints `/api/memory/*`, agrégation episodic/semantic/procedural | Long (invention data + agrégation) |
| Evaluations | Partielle (check.run brutes, pas d'agrégation) | Non | Module agrégation + carte rubriques qualité + vue | Long (agrégation + concept rubriques) |
| Automations | Aucune | Non | Décision produit (qu'est-ce qu'une automation ?) + runtime | **Bloqué** (décision requise) |

---

*Fin de la Section 2. En attente de validation avant de poursuivre avec la Section 3 (Navigation).*

*Notes de maturité* :
- **Missions** : Les données et cockpit Phase 1/2b existent. Travail : généraliser en liste + détail, intégrer gouvernance.
- **Results** : Données (artefacts) vraisemblablement tracées, candidate la plus rapide si tracé clarifié (pas d'API existante, construire UI uniquement).
- **Skills** : Données registry complètes. Travail : endpoint API + concept matrice des permissions (non existant) + UI.
- **Memory** : Aucune data structure. À inventer entièrement : episodic (historique agrégé), semantic (apprentissages inférés), procedural (procédures canoniques).
- **Evaluations** : Briques exists (`check.run` raw) mais aucune agrégation ni concept de "rubrique qualité". Travail backend significant.
- **Automations** : Aucune donnée, aucun concept. Bloqué par décision produit (qu'est-ce qu'une automation Cortex ?). À formaliser dans `UI_DECISIONS.md` avant tout travail.
