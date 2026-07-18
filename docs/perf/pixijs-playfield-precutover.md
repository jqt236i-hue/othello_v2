# PixiJS playfield pre-cutover evidence

- Result: **PASS**
- Evidence mode: automated hardware-desktop readiness
- Candidate commit: `ff9fe537775c081f5ba018b19a25091b2919872d`
- Browser artifact SHA-256: `0ead37b9c937f3e71d7a190228bdc3bfdd9668cd9da8da32974732d1235e523f`
- Desktop readiness SHA-256: `8abf20cbe9dd9fbefb4897bd241334cedaea5762a89deb9e79ec47fe6ff7b3aa`
- Cross-platform smoke SHA-256: `cea3454acbc23366d9a7ebd033fb9dcfc2d6b32620bd891d0f106456b7c279a7`
- Fixture digest: `fnv1a32:45a514aa`
- Event digest: `fnv1a32:75cd8b2e`
- Validated at: 2026-07-18T13:41:53.322Z

Blocking readiness gate: PASS
Cross-browser desktop/mobile-viewport functional gate: PASS
Optional 4x10-minute strict soak: historical-candidate-fail

| Browser lane | Non-blocking rAF/DOM comparison | Checks |
| --- | --- | ---: |
| classic | FAIL | 48 |
| vite | FAIL | 48 |

Follow-up attribution entries: 5.

## Residual risk accepted by operator decision

- The optional 4x10-minute strict soak is historical-candidate-fail; shared-workstation rAF stalls are not a release-blocking signal.
- Physical Android Chrome and iPhone Safari paint/composite performance was not measured.
- Safari on an actual iPhone GPU was not measured; Playwright WebKit is functional compatibility evidence only.
- Mobile-device thermal throttling and battery/power-mode behavior were not measured.

Desktop/mobile viewport automation is not represented as physical Android/iPhone performance evidence.
Shared-workstation raw rAF stalls and DOM/Pixi timing ratios remain diagnostics; app-attributed synchronous work and lifecycle remain blocking.
This evidence does not change player-visible timing, events[] ordering, network authority, or Pixi playfield ownership.
