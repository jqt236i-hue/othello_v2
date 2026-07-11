# Artifact retention policy

Status: active policy
Updated: 2026-07-11

## Rule

`artifacts/` is exclusively a disposable local-output directory. Its tracked allowlist is **empty**. Durable material must be stored according to its role before a cleanup:

| Material | Canonical location |
| --- | --- |
| Player-visible shipped image, audio, or data | `assets/` |
| Human-readable historical conclusion or reproducibility summary | `docs/` or `docs/archive/` |
| Test fixture that is an input to an automated test | `test/` or `tests/` |
| Generated deployment surface | its documented generated location (for example `worker-public/`) |

Browser profiles, caches, databases, screenshots, raw logs, PID files, temporary servers, and intermediate design exports must not be committed under `artifacts/`. The root `.gitignore` ignores the directory, and `npm run check:artifact-retention` rejects any subsequently tracked path there.

The visual-regression baseline `tests/visual-regression/baseline-board.png` is a tracked test input. Its `current-board.png` and `diff-board.png` siblings are failure diagnostics only, are ignored, and must not be committed.

## 2026-07-11 tracked-tree classification

The inventory contained 156,414 paths (65,355,996,045 bytes). Every first-level subtree is classified below; each nested path inherits its parent's classification.

| Tracked subtree | Paths | Classification | Retention decision |
| --- | ---: | --- | --- |
| `<root-files>` | 178 | test outputs, visual previews, server logs/PIDs | volatile output; remove |
| `network-card-sweep-2026-06-23/` | 151,482 | per-card browser profiles, shader/cache databases, raw sweep outputs | volatile output; remove |
| `live-network-check/` | 2,859 | multi-browser profile capture | volatile output; remove |
| `live-network-check-2026-06-22-endgame/` | 1,332 | multi-browser endgame capture | volatile output; remove |
| `live-network-check-2026-06-23-click-stability/` | 23 | browser capture | volatile output; remove |
| `live-network-check-2026-06-22/` | 18 | historical live-check screenshots and JSON | the conclusion remains in `docs/network-live-check-2026-06-22.md`; remove raw evidence |
| `live-network-check-2026-06-19T17-00-22-477Z/` | 8 | browser capture | volatile output; remove |
| `ipad-ui-audit/`, `ipad-ui-audit-after/`, `ipad-ui-audit-final-pass/`, `ipad-ui-audit-final2/`, `ipad-ui-audit-final3/`, `ipad-ui-audit-final4/`, `ipad-ui-audit-final5/` | 329 | screenshot/JSON inspection iterations | volatile visual output; remove |
| `ranking-ui-assets/` | 150 | downloaded and iterative ranking UI image exports | development intermediate; remove |
| `player-guide/` | 17 | PDF/PPTX and screenshot exports | shipped guide slides are already under `assets/images/help/player-guide/`; remove exports |
| `time-stop-god-card-background/` | 3 | card-art generation candidates | shipped card image is already `assets/images/card/95_時間停神.png`; remove candidates |
| `jade-rim-large/`, `jade-rim-large-v2/`, `jade-rim-regenerated/`, `jade-rim-sharp/` | 8 | stone-skin image iterations | shipped skin images are already `assets/images/stone-skin/jade-rim/`; remove candidates |
| `game-background-concepts/` | 5 | unused background concepts | development intermediate; remove |
| `codex-ipad-layout-fix/` | 2 | screenshot comparison | volatile visual output; remove |

No tracked path in this inventory is a required runtime source, test fixture, or deploy output. Source and test searches found no consumer of `artifacts/`; the only production-adjacent links were historical document evidence, which this policy makes non-file-backed.

## Cleanup and verification procedure

1. Record the classification in this policy before deleting any output.
2. Copy a genuinely durable item to its canonical location only when no equivalent canonical copy exists.
3. Remove all tracked `artifacts/**` paths in a dedicated commit.
4. Run `git ls-files artifacts`; it must produce no paths.
5. Run `npm run check:artifact-retention` and focused script tests. Run `git diff --check` and inspect the deletion summary before staging.

This cleanup removes historical and local-output material only; it cannot change game rules, runtime assets, browser boot, Worker deployment, or test behavior.
