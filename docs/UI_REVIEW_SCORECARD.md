# Cortex Lab UI Review Scorecard

Use this scorecard after every real Chromium screenshot. Score the current result, not the intent or the CSS.

## Scoring

| Criterion | Weight | Question |
|---|---:|---|
| Visual hierarchy | 20 | Does the eye reach mission state, graph, and selected process in the right order? |
| Readability | 20 | Is every functional text readable at 100% zoom without strain? |
| Geometric precision | 15 | Are alignment, spacing, borders, radii, and proportions consistent? |
| Execution graph | 15 | Are nodes, relations, direction, selection, and state understandable without the inspector? |
| Component consistency | 10 | Do equivalent controls and states use the same visual grammar? |
| Information density | 10 | Is the screen dense but calm, without redundancy or dead space? |
| Accessibility | 10 | Are contrast, focus, hit areas, semantics, and non-color cues sufficient? |

Total: 100.

## Review protocol

1. Compare the new screenshot with the previous accepted screenshot.
2. List at most five defects, ranked by user impact.
3. Select only one defect family for the next implementation pass.
4. Record any intentional visual change in `docs/UI_DECISIONS.md`.
5. Do not approve a pass because the code is cleaner; approve it because the browser result is better or visually unchanged when refactoring.

## Blocking regressions

The following block merge unless explicitly approved:

- graph becomes less prominent;
- functional text falls below readable size;
- inspector content overflows or becomes inaccessible;
- node selection stops working;
- real ledger data is replaced by silent mock data;
- destructive actions become easier to trigger accidentally;
- horizontal overflow appears at the reference desktop viewport;
- build or visual-proof workflow fails.

## Reference language

Use precise observations:

- `Node labels lose contrast against the canvas.`
- `The terminal attracts more attention than the graph.`
- `Inspector metric columns truncate at 1440 px.`

Avoid vague judgments such as `make it premium`, `more modern`, or `add wow effect`.