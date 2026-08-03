# Cortex — Architecture (courte)

## Flux fondamental
```
Intent
  ↓
Chief of Staff        runtime/chief-of-staff.mjs
  ↓
Bundle immuable       bundles/<mission>-<hash>.json
  ↓
Checks                runtime/checks.mjs  (seul point qui touche aux fichiers)
  ↓
Closure
  ├── LIVRAISON_AUTONOME
  ├── AVEC_INFORMATION
  └── ESCALADE_HUMAINE
```

## Composants
| Composant | Rôle | Fichier |
|---|---|---|
| Constitution | 10 invariants canoniques (autorité 1) | `constitution/core.yaml` |
| Registre | Index machine des règles | `registry/registry.json` |
| Schémas | Contrôles vérifiables | `schemas/*.yaml` |
| Compilateur | Registre + schémas → bundle immuable (hash stable) | `compile-bundle.mjs` |
| Chief of Staff | Gouvernance : applique checks, suit budget, décide closure | `runtime/chief-of-staff.mjs` |
| Checks | Exécuteurs de contrôle (grep…) | `runtime/checks.mjs` |

## Source de vérité
- La règle canonique est le YAML/JSON (`constitution/`, `registry/`, `schemas/`).
  Le Markdown explique, il ne décide pas (INV-009).
- Un bundle est immuable une fois compilé : son hash (sha1 sur contenu stable, hors date)
  l'identifie et le rend reproductible.

## Frontière produit — cortex.lab
```
cortex.lab = interface personnelle + adaptateur ChatGPT
cortex.lab ≠ Cortex Core
```
- `cortex.lab/` est un chat web isolé (backend + frontend) qui pont vers ChatGPT via une
  gateway locale (`127.0.0.1:8000`), exposé uniquement par Tailscale. Le token vit en
  mémoire serveur, jamais dans le JS navigateur.
- Il n'entre **pas** dans le flux de gouvernance ci-dessus. Le supprimer
  (`rm -rf cortex.lab`) ne casse rien du Core.
- Ses secrets (`cortex.lab/backend/.env`) sont hors repo et hors bundle.

## Contrat figé par les tests (`test/runtime.test.mjs`)
- Le bundle porte le `check` réel (compilateur réparé).
- Violation anti-slop → `ESCALADE_HUMAINE` + exit 3.
- Workspace propre → `LIVRAISON_AUTONOME`.
- Dépassement budget → `ESCALADE_HUMAINE`.

## Évolution prévue (pas encore appliquée)
Le `registry/registry.json` manuel deviendra un **registre généré** depuis des manifests
déclaratifs (`manifests/*.json` → `generate-registry.mjs` → `registry/registry.generated.json`),
en **migration parallèle** : l'ancien chemin reste actif jusqu'à preuve d'équivalence.
Cette page borne ce changement ; elle ne le déclenche pas.
