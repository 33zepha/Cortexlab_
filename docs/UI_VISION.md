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

Cortex Lab reste une **surface de supervision en lecture augmentée** — jamais l'endroit où une mission démarre. Ce principe, déjà acté dans `UI_HANDOFF_CLAUDE.md`, ne change pas avec cette refonte visuelle. Ce qui change, c'est la façon dont l'information est organisée, densifiée et hiérarchisée à l'écran.

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

**Sidebar** — navigation entre espaces (Missions, Agents, Memory, Skills, Automations, Results, Evaluations). Persistante, mais volontairement discrète : pas de gros logo, pas de bannière, pas de zone promotionnelle. Un jeu d'icônes précis + labels courts. Elle ne porte aucune donnée de mission — uniquement de la navigation.

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

*Fin de la Section 1. En attente de validation avant de poursuivre avec la Section 2 (Vues).*
