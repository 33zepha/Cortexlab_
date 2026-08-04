# Handoff Claude — Agent Table V2

## Contexte

Une variante UI a été développée en parallèle sur `chatgpt/agent-table-v2` afin de remplacer la grille de cartes Agents par une vue plus dense et plus opérationnelle.

Cette variante cible encore l’ancienne interface statique dans `public/`.

Claude travaille sur `claude/cortex-lab-hermes-cll80w`, qui migre l’interface vers une application React/Vite dans `web/` et supprime `public/`.

## Ce qui a été ajouté

Fichiers modifiés :

- `public/index.html`
- `public/styles.css`
- `public/app.js`

Fonctionnalités :

- table Agents dense en 7 colonnes ;
- recherche réellement fonctionnelle ;
- filtre cyclique `Tous / Actifs / En pause` ;
- coût relatif affiché avec un libellé compréhensible ;
- qualité affichée avec valeur et barre de progression ;
- états de chargement, vide et erreur ;
- contraste, bordures et densité visuelle renforcés ;
- feed live conservé ;
- suppression de l’injection `innerHTML` dans le feed ;
- identifiant du bouton `Run Mission` réaligné avec le HTML.

## Important pour la migration React

Ne pas réintroduire `public/` dans la nouvelle architecture après la fusion de la branche Claude.

Ne pas cherry-pick aveuglément les commits UI de cette variante dans `web/`.

Il faut porter les concepts utiles dans les composants React existants.

Mapping recommandé :

- `web/src/components/AgentTable.jsx` pour la table ;
- `web/src/components/AgentRow.jsx` pour une ligne ;
- état de recherche et filtre dans `App.jsx` ou un hook dédié ;
- styles convertis dans Tailwind ou `web/src/styles/index.css` ;
- rendu des événements avec des nœuds React, jamais via `dangerouslySetInnerHTML` ;
- conserver les endpoints actuels `/api/agents`, `/api/events`, `/api/stream` et `/api/mission`.

## Données à conserver dans la table

Colonnes proposées :

1. Agent : avatar, nom, identifiant ;
2. Fonction : rôle métier ;
3. Modèle : modèle et provider ;
4. Niveau : CEO, manager ou agent ;
5. Coût relatif : faible, moyen ou élevé avec la valeur brute secondaire ;
6. Qualité : valeur normalisée et barre ;
7. Statut : actif ou en pause.

## Ce qui ne doit pas être fusionné conceptuellement

- la navigation fictive de l’ancienne page ;
- le shell HTML statique ;
- les styles globaux legacy ;
- la grille de cartes Agents précédente ;
- toute duplication entre `public/` et `web/`.

## Ordre de travail conseillé

1. Conserver ce commit dans `main` comme historique et référence visuelle.
2. Finaliser la migration React de Claude.
3. Laisser la branche Claude supprimer `public/` comme prévu.
4. Porter uniquement la table, la recherche, le filtre et les corrections de sécurité dans `web/`.
5. Vérifier que `main` ne sert plus qu’une seule interface après la migration.

## Checklist de validation

- [ ] Aucun fichier `public/` réintroduit après la migration React.
- [ ] Une seule implémentation de l’interface est servie.
- [ ] Recherche Agents fonctionnelle.
- [ ] Filtre de statut fonctionnel.
- [ ] Table lisible à 1280 px et plus.
- [ ] Scroll horizontal propre sur petite largeur.
- [ ] Aucun `innerHTML` ou `dangerouslySetInnerHTML` pour les données du ledger.
- [ ] `Run Mission` reste connecté à `/api/mission`.
- [ ] SSE `/api/stream` toujours opérationnel.
- [ ] Tests runtime inchangés.

## Résumé

La variante ChatGPT constitue une référence de densité et d’interaction pour la liste Agents. La branche Claude reste la cible architecturale. Le bon résultat final est une seule application React dans `web/`, enrichie des patterns utiles de cette variante, sans conserver deux frontends concurrents.
