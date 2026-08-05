# Cortex Orchestration — Runtime Bootstrap

Ce fichier est un **point d'entrée minimal**. Il n'est PAS une constitution.
La constitution courte et les règles vivent dans `constitution/` + `registry/`
(format machine JSON/YAML canonique). Ce bootstrap pointe vers elles.

## 1. Identité
Runtime d'exécution sous orchestration Hermes (Chief of Staff). N'exécute aucune
décision de gouvernance : il applique les mandats et les bundles qui lui sont
fournis.

## 2. Interdiction
Ne jamais travailler sans un **bundle valide** (voir `bundles/`). Un bundle est
immutable une fois la mission commencée et porte un manifeste (hash, versions,
sources). Travailler sans bundle = hors gouvernance = interdit.

## 3. Chargement du contexte
Le contexte d'une mission est fourni par le compilateur de bundle :
```
node compile-bundle.mjs --mission <id> --domain <domaine>
```
Le bundle généré (`bundles/<id>-<hash>.json`) est la **seule** source de règles
applicables, préférences et références pour la mission. Ne pas lire le repo entier.

## 4. Demande de contexte supplémentaire
Si un agent a besoin d'un complément, il ne lit pas le repo directement. Il
demande une extension de bundle via le Chief of Staff, qui produit une nouvelle
révision du bundle (traçable, jamais silencieuse).

## 5. Gouvernance
N'éditer aucune source de `constitution/`, `registry/`, `schemas/`, `policies/`
sans mandat explicite du Chief of Staff. Ces fichiers sont la source canonique ;
toute modification y est versionnée et tracée.

## 6. Référence
- Constitution courte : `constitution/core.yaml`
- Registre machine : `registry/registry.json`
- Compilateur de bundle : `compile-bundle.mjs`
- Runtime (Chief of Staff) : `runtime/chief-of-staff.mjs`
- Exécuteurs de checks : `runtime/checks.mjs`
- Bundles : `bundles/`

## 7. Runtime (Chief of Staff)
Le runtime *applique* un bundle à un workspace et décide la closure de la
mission, gouverné par les invariants (INV-005 preuves, INV-006 closure,
INV-010 budget). Il n'exécute aucun code métier directement (INV-001) : il
délègue / vérifie et rend une décision traçable.

Pipeline :
```
1. compile-bundle.mjs --mission <id> --domain <domaine>   # génère bundles/<id>-<hash>.json
2. node runtime/chief-of-staff.mjs \
     --bundle bundles/<id>-<hash>.json \
     --target /chemin/vers/workspace [--max-reworks N] [--json]
```

Décision de closure (INV-006) :
- `LIVRAISON_AUTONOME` : aucune violation, budget respecté, tous controls auto-vérifiés.
- `AVEC_INFORMATION`  : aucune violation, mais présence de controls non auto-vérifiables
  (gouvernance structurelle) → l'humain est informé.
- `ESCALADE_HUMAINE`  : violation de control (`on_match: block`) OU dépassement de budget
  (INV-010). Exit code 3 — jamais silencieux.

Checks supportés (`runtime/checks.mjs`) : `grep` (anti-slop CTRL-NO-LABEL-UPPERCASE).
Un check non implémenté est traité comme non auto-vérifiable → `AVEC_INFORMATION`.

## 8. Délégation (`runtime/router.mjs`)
Chaque control vérifiable est confié à un agent, jamais exécuté « par le CoS »
(INV-001). Le routeur choisit par **aptitude** (strengths vs domaine de la règle)
puis par **rapport qualité/coût** (INV-011) ; le choix est déterministe et sa
justification est écrite au ledger avec le mandat. Hermes (CEO) route, il ne reçoit
jamais de mandat d'exécution.

Événements émis : `agent.assigned` (agent, règle, coût, justification, alternatives)
puis `agent.result` (violation, findings, durée). Le coût d'un mandat vaut
`cost_index × DELEGATION_UNIT` et alimente le budget de mission (INV-010) —
`cost_index` et `maxCost` sont des indices sans unité, pas une devise.

### ARCHITECTURE TRANSITOIRE

> **Ce n'est PAS la cible finale.** Les managers et agents portent des *rôles
> organisationnels*. Claude, Codex, Kimi, Luna et HY3 sont des *modèles*
> interchangeables ; le choix du modèle et de l'effort se fait par mandat.
> Une migration dédiée (`feat/role-model-separation`) séparera rôles, modèles
> et niveaux d'effort. Ce qui suit est la représentation **actuelle** pour
> compatibilité avec le runtime — pas l'organigramme définitif.

```
Boss → Hermes (CEO, closure)                    [rôle CEO ; modèle HY3 aujourd'hui]
         ├── Chief of Staff  gouvernance, budgets, policies, closures
         ├── Codex           ingénierie (binding modèle temporaire)
         │     └── Luna      exécutant (worker ; binding modèle temporaire)
         ├── Claude          UX / spec / critique (binding modèle temporaire)
         └── Kimi            recherche (binding modèle temporaire)
```

- Claude, Codex, Kimi et Luna sont encore représentés comme *agents* pour
  compatibilité avec le runtime actuel (registre + router à tokens).
- Cette représentation n'est **pas** la cible finale.
- **Antigravity a été retiré** : aucun fallback, aucun alias. L'historique
  `ledger/` et `bundles/` reste immuable.

⚠️ `strengths` contient des **tokens machine** comparés par `requiredStrengths()`.
La description en prose va dans `capabilities` / `domain_expertise`, qui
n'entrent pas dans le scoring. Une prose placée dans `strengths` ne matche rien
et rend l'agent non routable.

Tests : `npm test` (node --test, voir `test/runtime.test.mjs`, `test/router.test.mjs`,
`test/authority.test.mjs`).
