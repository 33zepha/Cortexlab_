# Cortex — Définition produit (1 page)

## 1. Quel problème Cortex résout-il ?
Quand plusieurs IA/agents travaillent sur une mission, chacun choisit son modèle,
son contexte et ses droits arbitrairement. Résultat : doublons, perte de preuves,
décisions non auditable, et aucune garantie que la mission reste dans ses limites.
Cortex existe déjà comme runtime minimal et **fonctionnel** — le risque n'est plus
« du code mauvais » mais « une dérive sans frontière conceptuelle nette ».

## 2. Quelle est la promesse fondamentale ?
**Cortex organise le travail IA au lieu de l'exécuter aveuglément.** À chaque mission
il compile un *bundle immuable* de règles (invariants, politiques, contrôles
vérifiables), le confie à un Chief of Staff qui gouverne l'exécution, et clôt avec une
décision tracée. L'agent ne lit **jamais** le repo : il reçoit uniquement son bundle.

## 3. Quel est le flux d'exécution ?
```
Intent → Chief of Staff → Bundle immuable → Checks → Closure
                                              (LIVRAISON_AUTONOME /
                                               AVEC_INFORMATION /
                                               ESCALADE_HUMAINE)
```
- **Intent** : mission (objectif, domaine, risque, budget).
- **Chief of Staff** : charge le bundle, applique les contrôles, suit le budget.
- **Bundle immuable** : seule source de règles (compilé depuis `registry/` + `schemas/`).
- **Checks** : contrôles vérifiables exécutés contre le workspace cible.
- **Closure** : autonome (calibré/réversible/contrôlé), info (règle non auto-vérifiable),
  ou escalade (violation / budget dépassé).

## 4. Qu'est-ce qui appartient au Core ?
- `constitution/core.yaml` — 10 invariants canoniques (autorité 1).
- `registry/registry.json` — index machine des règles (ID, domaine, autorité, statut).
- `schemas/*.yaml` — contrôles vérifiables (ex : anti-slop uppercase).
- `compile-bundle.mjs` — compile registre + schémas en bundle immuable (hash stable).
- `runtime/` (`chief-of-staff.mjs`, `checks.mjs`) — le moteur de gouvernance.
- `bundles/` — bundles générés (artefacts immuables par mission).
- `test/` — les tests qui figent le contrat actuel.

## 5. Qu'est-ce qui est explicitement hors Core ?
- **`cortex.lab/`** — interface personnelle + adaptateur ChatGPT (pont gateway locale).
  Outil de travail, **pas Cortex Core**. Supprimable (`rm -rf cortex.lab`) sans casser le cœur.
- `scripts/cortex-vps-bootstrap.sh` — infra VPS (UFW/SSH/Tailscale/Node), pas logique produit.
- `node_modules/`, `package-lock.json` — dépendances.
- `.env` et secrets — hors repo, hors bundle, jamais lus par un agent.

## Invariants à ne jamais casser
INV-001 CoS délègue, n'exécute jamais de code direct · INV-002 aucun pipeline figé ·
INV-003 périmètre vécu, escalade si multi-système · INV-004 canaux bornés ·
INV-005 preuves pilotées par le risque · INV-006 clôture autonome si calibré/réversible/contrôlé ·
INV-007 confiance graduée par domaine (visuel) · INV-008 diagnostic par niveaux ·
INV-009 source canonique unique (YAML/JSON décide) · INV-010 budget de mission.

## Trajectoire (réplication entreprise)
Kernel minimal (actuel) → Optimiseur de mission (choix stratégie/modèle) →
Boucle adaptative (checkpoints, réserve de compute) → Kernel B2B (identités, approvals, ledger) →
Tenant overlay (même runtime, zéro fork) → Appliance.
**Règle d'or :** une nouvelle compétence *ajoute* une règle/modèle/agent/outil ;
une nouvelle mécanique du kernel reste *exceptionnelle*.
