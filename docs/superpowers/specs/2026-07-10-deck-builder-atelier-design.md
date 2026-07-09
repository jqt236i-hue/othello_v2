# Deck Builder Atelier redesign

## Goal

Replace the deck-builder presentation with a clearer, more premium "Deck Atelier" surface while preserving every existing deck-builder behavior. A player must be able to identify the currently used deck, choose a saved deck, create or edit a deck, and access the four fixed presets without having to infer the relationship between those groups.

## Scope and invariants

- Preserve the existing view and interaction model: opening and closing the overlay, saved-slot selection, use, edit, slot creation, fixed-preset use/edit, editor destination selection, save, deck-code import/export, card quantity cycling, card-detail dialogs, and notices.
- Preserve the six saved slots and the four fixed presets (`観測デッキ`, `執行デッキ`, `理論デッキ`, `冥灰デッキ`).
- Preserve rulebook-visible copy unless a small label change is needed to make an existing action unambiguous.
- Keep game and persistence authority in the existing controller/state modules. The renderer may change markup and semantic labels but may not add new gameplay or storage authority.
- Keep the work source-first in `ui/`; do not edit `dist/` or `worker-public/` by hand.

## Visual direction

The visual language is an observatory atelier: dark lacquered blue-green surfaces, restrained brass accents, and stone-color signals. It retains the game's existing fantasy material palette, but uses fewer competing borders and less all-caps microcopy. Readability and action priority take precedence over ornamental density.

## Information architecture

### Current deck hero

At the top of the selection view, show one distinct active-deck panel. It contains the active deck name, deck size, category/composition information, and a clear `使用中` status. It must not offer a redundant `使用` button. If the default deck is active, this panel communicates that fact equally clearly.

### Saved deck workshop

Place the six saved slots in the primary workspace grid. Filled slots expose the deck name and card count first, a compact composition bar second, then actions with one visual primary action (`使用`) and a secondary edit action. The active slot is visibly selected and cannot appear as an equally actionable alternative.

An empty slot is a full-size creation card labelled `新しいデッキを構築`; it retains the existing click-to-edit behavior and has a clear keyboard-accessible button or equivalent control.

### Fixed-preset library

Keep the four fixed decks separate from saved slots, in a visually subordinate library section. They remain plainly selectable and editable, but their presentation must make it clear that they are supplied presets rather than user save data.

### Editor continuity

The editing view keeps its existing behavior but adopts the new hierarchy: persistent title and deck count, prominent save destination and save action, and visually separate selected and candidate card sections. Existing `詳細` controls stay available and retain their accessible names.

## Implementation approach

1. Inspect the renderer's current selection-view creation functions and existing deck-builder CSS selectors.
2. Add/adjust renderer classes and DOM grouping only where necessary to provide active-hero, workshop, and library boundaries without changing controller contracts.
3. Replace the corresponding CSS layout, spacing, typography, state styling, focus styling, and responsive rules. Reuse existing colors/type signals where possible.
4. Add focused renderer tests for the semantic state boundaries that the redesign introduces: active deck status, saved slots, empty-slot creation affordance, and fixed-preset grouping.
5. Compile TypeScript and regenerate browser artifacts only after source tests pass.

## Accessibility and responsive requirements

- Maintain semantic buttons for all actions; do not turn a clickable visual card into an inaccessible `div`.
- Provide visible `:focus-visible` treatment distinct from selected/active styling.
- Use text plus color for active, empty, and invalid states.
- Increase practical action target size and preserve readable text contrast against the dark surface.
- At narrow widths, stack the hero, workspace, and library sections rather than compressing labels or actions below usable size.

## Error and state handling

Existing invalid/notice states continue to originate from the renderer model. The redesigned UI must visibly retain invalid-state text and disabled-button behavior. No presentation state changes canonical deck selection or modifies save semantics.

## Verification

- Run focused deck-builder renderer tests, including new state-grouping expectations.
- Run the relevant TypeScript build/typecheck check.
- Run `npm run build:browser` because this is a browser-visible root-source change.
- Inspect the generated diff and confirm only intentionally generated browser artifacts accompany the source change.
- Do not run playable-browser or Playwright game interaction checks without an explicit user request.
