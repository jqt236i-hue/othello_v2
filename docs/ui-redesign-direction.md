# UI Redesign Direction Memo

Role: active design memo for the broad PC/iPad UI redesign discussion.
Target: browser UI for Card Reversi.
Source of truth: `01-rulebook.md` remains the source of truth for gameplay and player-visible rules. This memo records layout and presentation direction only.
Non-goals: this memo does not define card behavior, balance, network authority, or implementation tasks.

Last updated: 2026-06-08

## Scope

- Redesign target is PC and iPad UI for now.
- Smartphone-specific layout is out of scope for the current pass.
- Generated images are concept references only. Final UI details must be fixed in implementation design, not copied blindly from generated images.

## Fixed Board Rules

- The board must be square, front-facing, and flat 2D.
- Do not tilt the board, add perspective, or use an isometric angle.
- The board should be centered horizontally on the screen.
- The board may sit slightly above the vertical center.
- Layout must reserve one extra cell of expansion space on all four sides.
- Treat the visible board area as a board stage: base board plus the one-cell expansion safety margin.
- No UI panel, hand row, log, tooltip, or character art should overlap the expansion safety margin.

## Core Composition

The current desired composition is:

```text
left utility nav | opponent hand / opponent status / opponent character
                 |
                 |              square board stage
                 |          centered, slightly above middle
                 |
                 | hero character / player hand / selected-card detail
```

- Preserve the existing character direction: hero side at lower left, enemy side at upper right.
- Opponent hand must remain visible at the top because some cards can observe or reveal opponent cards.
- Player hand remains visible at the bottom.
- The board remains the visual center of the match screen.
- The board stage, not just the 8x8 base grid, is the centered object.

## Opponent Hand

- Show opponent deck count and opponent hand at the top.
- Normal opponent cards are face-down.
- The UI must have room to show revealed or observed opponent cards when card effects expose them.
- Keep the opponent hand aligned with the board/status area rather than floating randomly.

## Player Hand And Card Detail

- Player hand is shown along the bottom area.
- Card descriptions can be long, so card detail must not be treated as a tiny tooltip.
- Use layered detail:
  - Hand card: name, cost, type, and visual identity only; do not put card description text on the card face.
  - Selected-card inspector: short explanation, play-relevant summary, target/result/limits/notes, and actions.
  - Long detail text: scrollable area inside the inspector or a detail expansion.
- Keep action buttons near the selected-card inspector:
  - `使用`
  - `破壊`
  - `パス`
- Action buttons do not belong in the left utility nav.

## Card Surface Assets

- Frequently changing text must be HTML/CSS, not baked into images:
  - card name
  - cost
  - type
  - short description, when shown in the selected-card inspector
  - long detail text
  - button labels and state labels
- Card description text should not be displayed on the card face.
- Keep the card face readable and compact; put explanations in the selected-card inspector instead.
- Card backs may use generated image assets.
- Card front frames or broad decorative templates may use generated image assets only when they remain text-free and reusable.
- Normal card front backgrounds should stay comparatively simple so text remains readable.
- Do not assume every card has a central projected stone image.
- Special stone image projection applies only to cards that already reference stone images, such as assets under `assets/images/stones/`.
- For those special-stone cards, preserve the referenced stone image behavior and keep the surrounding card background simple.
- The preferred layer model is:
  - reusable frame/background asset
  - optional special-stone image layer for applicable cards
  - HTML/CSS text and state overlays
- Preserve the existing two-axis card visual logic:
  - cost tier controls the broad card color/intensity via `cost-tier-*`
  - display type controls accent color and ornament via `data-card-type`
- Current cost tier mapping:
  - cost `0`: `cost-tier-white`
  - cost `1..5`: `cost-tier-gray`
  - cost `6..10`: `cost-tier-red` in class name, currently rendered as green-toned
  - cost `11..15`: `cost-tier-blue`
  - cost `16..20`: `cost-tier-purple`
  - cost `21..30`: `cost-tier-gold`
  - cost `31+`: `cost-tier-special`
- Do not replace this with a new cost color scale without an explicit design decision.
- Type accents should continue to be a secondary layer over the cost-tier base rather than replacing the cost-tier color.

## Left Utility Nav

Adopt a fixed left vertical utility navigation bar, based on the generated concept the user selected.

Contents:

- Menu
- `ガチャ`
- `デッキ`
- `ランキング`
- `スキン`
- `設定`
- `ヘルプ`

Design intent:

- Dark blue-black vertical bar.
- Large white or light-gray icons with Japanese labels.
- Gold or blue-green accent for active/notification state.
- Utility nav is for secondary features, not per-turn game decisions.
- It replaces the currently scattered left-side utility buttons.

## Existing Settings Panel

Do not keep the current settings panel as a large always-visible control block.

Always-visible quick controls:

- `リセット`
- `AUTO: ON/OFF`
- Master volume slider

Move to settings drawer:

- Song selection
- Individual SE setting
- Individual BGM setting
- DEBUG
- Detailed sound settings

Acceptable two-step controls:

- Mode selection
- Board size

## CPU Level

- Prefer changing CPU level from the character area instead of the settings drawer.
- Display enemy character label as a button, for example: `Lv1 盤喰いの小鬼 ▾`.
- Pressing the label can open a CPU level selector.
- If changed during a match, it should likely apply from the next reset.
- Network battle should disable or hide CPU level controls.

## Current Open Design Questions

- Exact placement of quick controls: upper right, lower right, or a compact top bar.
- Exact iPad behavior for the selected-card inspector when horizontal space is tight.
- Whether long card detail uses tabs, a single scroll area, or a collapsed detail section.
- How large the hero/enemy character art should be while preserving board centering.
