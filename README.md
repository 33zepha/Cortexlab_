# 🧠 Cortex Lab

> 🚧 **Projet en chantier (WIP).** Le noyau minimal est fonctionnel et testé, mais
> l'interface, l'optimiseur de mission et la boucle adaptative ne sont pas encore
> branchés. On construit à vue, pas dans le vide — toute aide/retour est le bienvenu.

**Cortex** est un *runtime* d'orchestration IA qui **organise le travail des agents
au lieu de l'exécuter aveuglément**. À chaque mission il compile un **bundle immuable**
de règles (invariants, politiques, contrôles vérifiables), le confie à un *Chief of Staff*
qui gouverne l'exécution, et clôt avec une décision tracée — jamais en silence.

![state](https://img.shields.io/badge/state-en%20chantier-yellow)
![license](https://img.shields.io/badge/license-ISC-blue)
![node](https://img.shields.io/badge/node-%3E%3D18-9cf)
![tests](https://img.shields.io/badge/tests-passing-brightgreen)

---

## 🎯 Le problème qu'on règle

Quand plusieurs IA/agents bossent sur une mission, chacun choisit son modèle, son
contexte et ses droits arbitrairement. Résultat : doublons, perte de preuves,
décisions non auditable, et aucune garantie que la mission reste dans ses limites.

Cortex ne prétend pas écrire le « meilleur code ». Il pose une **frontière conceptuelle
nette** : un agent ne lit jamais le repo, il reçoit uniquement son bundle, et toute
dérive déclenche une escalade traçable.

## ⚙️ Comment ça marche

```
Intent ──▶ Chief of Staff ──▶ Bundle immuable ──▶ Checks ──▶ Closure
                                  (hash stable)     (grep…)   ├─ LIVRAISON_AUTONOME
                                                            ├─ AVEC_INFORMATION
                                                            └─ ESCALADE_HUMAINE
```

| Étape | Rôle | Fichier |
|---|---|---|
| Constitution | 10 invariants canoniques (autorité 1) | `constitution/core.yaml` |
| Registre | Index machine des règles | `registry/registry.json` |
| Schémas | Contrôles vérifiables | `schemas/*.yaml` |
| Compilateur | Registre + schémas → bundle immuable | `compile-bundle.mjs` |
| Chief of Staff | Gouvernance : checks, budget, closure | `runtime/chief-of-staff.mjs` |
| Checks | Exécuteurs de contrôle | `runtime/checks.mjs` |

## 🚀 Démarrage rapide

```bash
npm install
npm test                      # node --test : fige le contrat actuel

# 1. Compiler un bundle immuable pour une mission
node compile-bundle.mjs --mission <id> --domain <domaine>

# 2. Faire gouverner l'exécution par le Chief of Staff
node runtime/chief-of-staff.mjs \
  --bundle bundles/<id>-<hash>.json \
  --target /chemin/vers/workspace [--max-reworks N] [--json]
```

Décision de closure (`INV-006`) :
- **LIVRAISON_AUTONOME** — aucune violation, budget OK, tous les controls auto-vérifiés.
- **AVEC_INFORMATION** — aucune violation, mais controls non auto-vérifiables → humain informé.
- **ESCALADE_HUMAINE** — violation de control `on_match: block` OU budget dépassé (exit 3).

## 📦 Périmètre actuel

✅ **Fait / fonctionnel**
- Noyau de gouvernance (compile-bundle → chief-of-staff → checks).
- 10 invariants figés, registre machine, schémas de contrôle vérifiables.
- Tests qui verrouillent le contrat (violation anti-slop → escalade, budget → escalade).

🚧 **En cours**
- Migration du registry manuel vers un registre généré (`manifests/*.json`).
- `cortex.lab` : interface personnelle + adaptateur ChatGPT (hors Core, supprimable).

🔜 **Roadmap**
- Optimiseur de mission (choix stratégie/modèle) → boucle adaptative (checkpoints) →
  Kernel B2B (identités, approvals, ledger) → tenant overlay → appliance.

> **Règle d'or** : une nouvelle compétence *ajoute* une règle/modèle/agent/outil ;
> une nouvelle mécanique du kernel reste *exceptionnelle*.

## 🗂 Structure

```
constitution/   invariants canoniques (autorité 1)
registry/       index machine des règles
schemas/        contrôles vérifiables
runtime/        chief-of-staff.mjs, checks.mjs
bundles/        bundles générés (artefacts immuables, hors git)
test/           tests qui figent le contrat
docs/           PRODUCT.md, ARCHITECTURE.md
```

## 🤝 Contribuer

Chantier ouvert : ouvre une issue ou une PR. Toute modif de `constitution/`,
`registry/`, `schemas/`, `policies/` passe par un mandat explicite et reste versionnée.

## 📜 Licence

ISC — voir `package.json`.
