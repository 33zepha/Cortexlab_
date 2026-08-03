# Cortex Console — Inspirations intégrées

10 dashboards analysés et leurs patterns transformés en système Cortex.
Références : Orchestra, Synqra, JunoMind, Agentic UI (Monitor + Orchestrate),
Recent Executions, Agent Timestamp, Cost Breakdown, Logistics, + 2 grilles cartes.

## Patterns communs retenus

| Pattern | Sources | Décision Cortex |
|---|---|---|
| Sidebar gauche groupée (MAJUSCULES) | Orchestra, JunoMind, Agentic UI, Synqra | ✅ Groupes MONITOR / ORCHESTRATE / DELEGATE / ANALYTICS |
| Cartes blanches, coins arrondis, ombre douce | Tous | ✅ Adopté (`card`) |
| Badges statut pill colorés | Synqra, JunoMind, Recent Executions | ✅ Vert=ok, ambre=info, rouge=escalade, bleu=running |
| Toggle vert/on · gris/off | Synqra, Orchestra | ✅ Agent actif / inactif |
| Barre progression seuil-codée | Synqra (token balance) | ✅ <60% vert, 60–85% ambre, >85% rouge |
| Icônes intégrations en rang | Tous | ✅ Row de glyphs fournisseurs |
| Vue grille + vue tableau (toggle) | JunoMind, Orchestra | ✅ Bascule grid / table |
| "Last Run" / "Running" / timestamp live | Tous | ✅ Alimenté par le ledger NDJSON |
| Top bar : search + filters + "+ New" | Orchestra, Agentic UI | ✅ Adopté |
| Cartes KPI résumé en tête | JunoMind, Agentic UI | ✅ Active Agents / Errors / Confidence |
| Historique d'exécutions (liste) | Recent Executions, Agentic UI | ✅ Alimenté par `events.ndjson` |

## Différenciateur Cortex

- Les **3 états de closure (INV-006)** mappent direct sur les couleurs de badge :
  `LIVRAISON_AUTONOME` = vert · `AVEC_INFORMATION` = ambre · `ESCALADE_HUMAINE` = rouge.
- Le dashboard lit le **ledger NDJSON** déjà en place → « voir en direct » sans refonte du kernel.
- Le système est *minimal qui grandit* : un token ajouté dans `DESIGN.md` se propage
  partout (Tailwind + DTCG exportés). Pas d'usine à gaz.

## Sources → tokens

| Élément vu | Token Cortex |
|---|---|
| Fond gris clair (tous) | `bg` #F5F6F8 |
| Carte blanche | `surface` #FFFFFF |
| Bouton primaire vert/orange (Orchestra/Agentic) | `primary` #4F46E5 (indigo, distinct) |
| Badge vert actif | `success` #16A34A |
| Badge ambre « 1 issue » | `warning` #D97706 |
| Badge rouge « 8 issues » / Failed | `error` #DC2626 |
| Toggle on vert | `toggle-on` = success |
| Police (tous) | Inter |
