# Mission Control projection

## But

Le ledger NDJSON reste la source de vérité append-only. L'interface ne doit pas reconstruire elle-même les missions à partir d'une suite d'événements bruts.

`runtime/mission-projection.mjs` fournit une projection pure et sans effet de bord :

```js
import { buildMissionControl } from './runtime/mission-projection.mjs'

const result = buildMissionControl(events)
```

Le résultat contient :

- `summary` : compteurs directement utilisables par le dashboard ;
- `missions` : missions triées de la plus récente à la plus ancienne.

## Contrat mission

Chaque mission expose notamment :

- `id` stable dérivé du hash de `mission.start` ;
- `name`, `domain`, `target`, `rules` ;
- `status` : `running`, `incomplete`, `autonomous`, `information`, `escalated` ou `closed` ;
- `phase` : `starting`, `checking`, `budget`, `closed` ou `unknown` ;
- `started_at`, `finished_at`, `duration_ms` ;
- `checks.total`, `checks.passed`, `checks.violations`, `checks.findings`, `checks.items` ;
- `budget` avec consommation, limites et dépassements ;
- `closure`, `escalations`, `event_count`, `latest_event`.

## Règles de projection

1. Une mission commence sur `mission.start`.
2. Les événements suivants lui sont rattachés jusqu'à `mission.closure`.
3. Une nouvelle mission ouverte avant la fermeture de la précédente marque l'ancienne comme `incomplete`.
4. La dernière mission sans closure reste `running`.
5. Les événements orphelins précédant tout `mission.start` sont ignorés.
6. Le tableau d'événements fourni n'est jamais modifié.

## Intégration serveur recommandée

Ajouter ensuite dans `server/index.mjs` :

```js
import { buildMissionControl } from '../runtime/mission-projection.mjs'

if (url === '/api/missions') {
  return sendJson(res, buildMissionControl(getEvents()))
}
```

Cette modification est volontairement laissée hors de cette branche pour ne pas entrer en conflit avec la migration serveur et frontend de Claude.

## Intégration React pour Claude

Dans `web/`, consommer `/api/missions` plutôt que de regrouper les événements dans les composants.

Ordre conseillé :

1. `MissionTable` alimentée par `missions` ;
2. KPI alimentés par `summary` ;
3. drawer mission à partir d'un objet mission unique ;
4. SSE : à chaque nouvel événement, rafraîchir ou recalculer la projection côté serveur ;
5. seulement ensuite ajouter graphe d'orchestration et visualisations avancées.

Le frontend doit rester un lecteur de projection, pas devenir une seconde implémentation du runtime.

## Tests

`test/mission-projection.test.mjs` couvre :

- mission autonome complète ;
- violation et escalade ;
- segmentation de plusieurs missions ;
- mission incomplète et mission en cours ;
- événements orphelins ;
- résumé Mission Control.

Validation locale : 6 tests sur 6 passent avec `node --test test/mission-projection.test.mjs`.
