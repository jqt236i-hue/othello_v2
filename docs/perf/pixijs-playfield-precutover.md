# PixiJS playfield pre-cutover evidence

- Result: **PASS**
- Evidence mode: automated hardware-desktop release gate
- Candidate commit: `ecf28bf92edca24c039e8640502a58a8187f2de5`
- Browser artifact SHA-256: `762fcbf9716ba36f15915fced611cb644faed3bf4dd6680e65af95541db24c24`
- Desktop capture SHA-256: `00b825249062364140d1c32e8ca875fb3f45db14b85585152438d36874d65784`
- Cross-platform smoke SHA-256: `fc3139ee309eb4e81cb3313f9ac4c0ecd511689b9ec43dac1167ada42a7afa21`
- Fixture digest: `fnv1a32:45a514aa`
- Event digest: `fnv1a32:75cd8b2e`
- Validated at: 2026-07-17T23:52:18.880Z

| Browser lane | DOM/Pixi gate | Checks |
| --- | --- | ---: |
| classic | PASS | 46 |
| vite | PASS | 46 |

Cross-browser desktop/mobile-viewport functional gate: PASS
Follow-up attribution entries: 0.

## Residual risk accepted by operator decision

- Physical Android Chrome and iPhone Safari paint/composite performance was not measured.
- Safari on an actual iPhone GPU was not measured; Playwright WebKit is functional compatibility evidence only.
- Mobile-device thermal throttling and battery/power-mode behavior were not measured.

Desktop/mobile viewport automation is not represented as physical Android/iPhone performance evidence.
This evidence does not change player-visible timing, events[] ordering, network authority, or Pixi playfield ownership.
