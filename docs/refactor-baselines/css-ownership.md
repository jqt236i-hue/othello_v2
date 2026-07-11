# CSS Ownership Inventory

> Status: active baseline for Phase 8
> Audit date: 2026-07-11
> Scope: root `styles-*.css`, the static order in `index.html`, and the dynamic leaderboard stylesheet.

## Contract

- A selector has one **base owner**. A later responsive rule is an override, not a second owner.
- The existing stylesheet order below is the explicit cascade order. This is the equivalent of a layer contract while preserving the current browser support and markup.
- `styles-leaderboard.css` is deliberately absent from `index.html`: it is appended once to `document.head` by `ui/handlers/match-mode/leaderboard-styles.ts`, after all static stylesheets.
- No `!important` is removed until its replacement has a specificity/cascade proof and passes the visual-verification gate.

## Static load order

`index.html` loads these stylesheets in this exact order:

1. `styles-variables.css` — design tokens
2. `styles-base.css` — global/reset/base presentation
3. `styles-layout.css` — application shell and general layout
4. `styles-charge-hud.css` — charge HUD
5. `styles-layout-controls.css` — control and modal surfaces (contains legacy gacha/network/leaderboard overlap)
6. `styles-layout-info.css` — information, gacha, and network surfaces; later than controls
7. `styles-layout-result.css` — result surface
8. `styles-layout-characters.css` — player/CPU character surface
9. `styles-board.css` — board and stones
10. `styles-cards.css` — cards, hand, and card detail
11. `styles-animations.css` — animations and reduced-motion behavior
12. `styles-responsive.css` — responsive overrides only
13. `styles-stone-shadows.css` — isolated stone-shadow adjustment
14. `styles-profile.css` — profile surface
15. Dynamic: `styles-leaderboard.css` — leaderboard only, appended after the static list.

## Repeated-selector authority matrix

Rows use a mechanically searchable `CSS_OWNER` marker. A selector-family row covers every selector beginning with that ID/class prefix in the stated files; the static audit command below is the exhaustive source for individual selector names.

| Marker | Selector family / exact selector | Base owner | Other occurrence | Classification / migration rule |
| --- | --- | --- | --- | --- |
| CSS_OWNER | `#status` | `styles-layout.css` | `styles-base.css` | Base file supplies legacy plate defaults; layout is the later authoritative application presentation. Consolidate only after visual proof. |
| CSS_OWNER | `#gacha*`, `.gacha-*` | `styles-layout-info.css` | `styles-layout-controls.css` | Information stylesheet is later in static order and owns gacha presentation. Controls copies are legacy overlap. |
| CSS_OWNER | `#network*`, `.network-*` | `styles-layout-info.css` | `styles-layout-controls.css` | Information stylesheet is later in static order and owns network lobby/chat presentation. Controls copies are legacy overlap. |
| CSS_OWNER | `#leaderboard*`, `.leaderboard-*` | `styles-leaderboard.css` | `styles-layout-controls.css` | Dynamic stylesheet is appended after static CSS and is the sole leaderboard owner. Controls copies are legacy overlap. |
| CSS_OWNER | `#board`, `.cell`, `.disc`, `.stone-info-*` | `styles-board.css` | `styles-responsive.css` | Responsive file is an intentional media-query override only. |
| CSS_OWNER | `#card-detail-panel`, `#hand-black .card-item*` | `styles-cards.css` | `styles-responsive.css` | Responsive file is an intentional media-query override only. |
| CSS_OWNER | `#control-panel`, `#leftActionButtons*`, `#quick-controls-bar`, `#side-panel`, `.deck-builder-*` | `styles-layout-controls.css` | `styles-responsive.css` | Responsive file is an intentional media-query override only. |
| CSS_OWNER | `#info-panel`, `#log`, `#networkChat*`, `#rules-help-*`, `#manifest-effect-panel`, `#effect-live-panel`, `#handSkin*` | `styles-layout-info.css` | `styles-responsive.css` | Responsive file is an intentional media-query override only. |
| CSS_OWNER | `#cpu-*`, `#hero-*`, `.character-*` | `styles-layout-characters.css` | `styles-responsive.css` | Responsive file is an intentional media-query override only. |
| CSS_OWNER | `.result-*`, `.premium-btn` | `styles-layout-result.css` | `styles-responsive.css` | Responsive file is an intentional media-query override only. |
| CSS_OWNER | `#game-container`, `#hand-black`, `#hand-white` | `styles-layout.css` | `styles-responsive.css` | Responsive file is an intentional media-query override only. |

### Known legacy-overlap selector families

The following are the static-audit families that require feature-by-feature consolidation. They are not safe bulk deletions: an earlier declaration may still provide a property not restated by the later declaration.

- Gacha: `#gachaActionRow`, `#gachaBalance*`, `#gachaCloseBtn`, `#gachaDetailsPanel`, `#gachaModal*`, `#gachaOverlay`, `#gachaResults`, `#gachaStatusText`, `.gacha-*`.
- Network: `#networkActionRow`, `#networkAdvancedSettings`, `#networkCloseBtn`, `#networkDeckInfo`, `#networkModal*`, `#networkOverlay`, `#networkPanel`, `#networkRoom*`, `#networkServerInput`, `#networkPlayerNameInput`, `#networkRoomIdInput`, `#networkRoomPasswordInput`, `#networkStatusText`, `.network-*`.
- Leaderboard: `#leaderboardCloseBtn`, `#leaderboardList`, `#leaderboardModal*`, `#leaderboardNameRow`, `#leaderboardOverlay.is-open`, `#leaderboardStatusText`, `.leaderboard-name`, `.leaderboard-row`, `.leaderboard-score`.

## `!important` exception inventory

The static audit found 444 declarations. They remain explicit exceptions until each feature migration has visual evidence. The count is a baseline, not permission to add new declarations.

| Owner stylesheet | Count | Accepted current reason |
| --- | ---: | --- |
| `styles-animations.css` | 14 | reduced-motion and terminal animation cancellation |
| `styles-base.css` | 4 | manifest world background runtime override |
| `styles-board.css` | 24 | board-state/special-stone visual precedence |
| `styles-cards.css` | 7 | hand-swipe/playback visual settlement |
| `styles-charge-hud.css` | 4 | transient charge-delta settlement |
| `styles-layout-characters.css` | 7 | character-stage alignment compatibility |
| `styles-layout-controls.css` | 318 | legacy modal/deck/control cascade debt; migrate feature by feature |
| `styles-layout-info.css` | 21 | information/network/gacha state overrides |
| `styles-layout-result.css` | 1 | result presentation compatibility |
| `styles-layout.css` | 3 | shell compatibility |
| `styles-leaderboard.css` | 32 | dynamic leaderboard visual asset/state precedence |
| `styles-responsive.css` | 9 | responsive exceptional overrides |

## Reproducible static audit

Run this read-only command to list repeated ID/class selectors across root stylesheets. Keyframes and declaration fragments are intentionally excluded.

```powershell
@'
from pathlib import Path
import re
from collections import defaultdict
owners = defaultdict(list)
for path in sorted(Path('.').glob('styles-*.css')):
    text = re.sub(r'/\*.*?\*/', '', path.read_text(encoding='utf-8'), flags=re.S)
    text = re.sub(r'@(?:media|supports|keyframes)[^{]*\{', '', text)
    for match in re.finditer(r'(^|\})\s*([.#][^{}]+?)\s*\{', text, re.M):
        owners[' '.join(match.group(2).strip().split())].append(path.name)
for selector, files in sorted(owners.items()):
    files = list(dict.fromkeys(files))
    if len(files) > 1:
        print(f'{selector}\t{" | ".join(files)}')
'@ | python -
```

Run this to count exceptions by owner:

```powershell
Get-ChildItem styles-*.css | ForEach-Object {
  $count = (Select-String -Path $_.FullName -Pattern '!important' | Measure-Object).Count
  if ($count -gt 0) { '{0}: {1}' -f $_.Name, $count }
}
```

## Verification gate

- Static checks: `test/ui.match-mode.leaderboard-styles.test.ts`, `npm run build:browser`, and `git diff --check -- styles-*.css index.html`.
- Visual checks: `npm run test:visual` or a playable-browser check require explicit user authorization. No visual-equivalence claim is valid until that gate passes.
