# Mission Control devient la base UI canonique

La console React/Vite située dans `web/` remplace définitivement l'ancien frontend `public/`.

## Contrat de la base

- `web/` est l'unique frontend à faire évoluer.
- `server/index.mjs` sert `web/dist` et expose les API runtime.
- `/api/missions` fournit la projection Mission Control dérivée du ledger.
- Les contrôles visibles doivent être fonctionnels, jamais décoratifs.
- Toute évolution UI importante doit produire une capture Chromium via `UI visual proof`.

## Structure validée

1. indicateurs opérationnels ;
2. table Missions ;
3. table Agents ;
4. activité du ledger en direct ;
5. navigation par ancres fonctionnelles.

Le frontend historique `public/` ne doit pas être restauré.
