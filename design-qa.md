# Deck Builder Design QA

- Source visual truth: `C:\Users\quarr\AppData\Local\Temp\codex-clipboard-eb55e094-c909-4842-bcdb-f17108c79df9.png`
- Implementation screenshot: `C:\Users\quarr\Desktop\othello_v2\artifacts\design-qa\deck-builder-final-1204x608.png`
- Latest density correction: `C:\Users\quarr\Desktop\othello_v2\artifacts\design-qa\deck-builder-content-sized-final.png`
- Full-view comparison: `C:\Users\quarr\Desktop\othello_v2\artifacts\design-qa\deck-builder-comparison-final.png`
- Focused loadout comparison: `C:\Users\quarr\Desktop\othello_v2\artifacts\design-qa\deck-builder-focus-loadout.png`
- Focused saved-slot comparison: `C:\Users\quarr\Desktop\othello_v2\artifacts\design-qa\deck-builder-focus-saved-slots.png`
- Responsive evidence: `C:\Users\quarr\Desktop\othello_v2\artifacts\design-qa\deck-builder-tablet-834x700.png`, `C:\Users\quarr\Desktop\othello_v2\artifacts\design-qa\deck-builder-mobile-final-390x844.png`
- Viewport: 1204 × 608 desktop; 834 × 700 tablet; 390 × 844 mobile
- State: preset 1 active, preset 6 filled, four empty slots, `2/6 使用中`; no effective-deck summary and no deck-switch success notice

## Findings

No actionable P0, P1, or P2 mismatch remains.

- [P3] Reference corner ornaments are more elaborate
  - Location: default deck and saved-slot card corners.
  - Evidence: the source uses small manuscript corner seals and bottom-center archive marks; the implementation uses restrained double inset rules and gold/cyan state borders.
  - Impact: minor ornamental fidelity difference only; hierarchy, state recognition, and operation are unchanged.
  - Follow-up: add a small reusable ornamental asset only if a later polish pass needs exact motif fidelity.

## Required Fidelity Surfaces

- Fonts and typography: Japanese display text uses a Mincho stack; metadata and actions retain readable sans/monospace treatment. Saved-deck titles were raised from the inherited ~8.5px rendering to 16px, summaries to 10px, section title to 20px, and the close glyph to 18px.
- Spacing and layout rhythm: desktop uses the reference 3 × 2 saved-slot grid, matching left/right proportions and two-row density. The later user-requested removal of the effective-deck/status row intentionally shifts the content upward relative to the source mock.
- Colors and visual tokens: midnight navy, muted blue-green, and antique-gold tokens map closely to the source. Active, filled, empty, disabled, and secondary-action states remain distinguishable without relying on color alone.
- Image quality and asset fidelity: the generated 1254 × 1254 lacquer/washi texture is sharp, text-free, low-contrast, and used only behind live UI. No screenshot, text, button, or card content is baked into it.
- Copy and content: app copy remains live DOM text. Differences in deck counts/type distribution are intentional dynamic test data rather than copied mock content. The explicitly removed `実対局に使うデッキ` row and switch-success notice do not reappear.
- Icons: existing semantic section icons and controls remain. The plus, archive rail, count badge, and close control are aligned and readable; the remaining ornate-corner difference is classified P3 above.
- Responsiveness and accessibility: tablet fits without horizontal overflow; mobile uses vertical scrolling with a 58px header and practical action targets. Focus-visible produces a 3px antique-gold outline with 2px offset. Reduced-motion rules remain in place.

## Interaction Evidence

- Opened the deck builder from the live game UI.
- Edited slots 1 and 6, used `ランダム生成`, changed names, saved both, returned to the selection screen, and activated slot 1.
- Confirmed empty-slot disabled `使用`, active/filled/empty visual states, `2/6 使用中`, and keyboard focus styling.
- Browser console errors checked after the final desktop state: none.

## Comparison History

1. Initial implementation evidence: `deck-builder-before-modal.png`
   - Findings: 2 × 3 saved-slot grid at 1204px, illustrated observatory background, weak antique-gold hierarchy, and under-sized live metadata.
   - Fixes: switched to generated lacquer/washi texture, established final color/type tokens, restored 3 × 2 desktop grid, and rebuilt active/empty/filled surfaces.
2. First redesign evidence: `deck-builder-after-pass1.png` and `deck-builder-after-pass2.png`
   - Findings: large vertical under-fill, then over-tall cards; plus glyph and halo were separated; saved-deck titles still inherited an `!important` compact size.
   - Fixes: normalized desktop row heights, aligned the live plus element inside its halo, restored `STANDARD` metadata, and overrode title/summary sizes at the final scoped selector.
3. Responsive evidence: `deck-builder-tablet-834x700.png` and initial mobile capture
   - Findings: excess tablet inter-section space and a compressed mobile header/close glyph.
   - Fixes: removed forced stacked-workspace height below 900px, enforced a 58px mobile header, and set an 18px minimum close glyph.
4. Post-fix evidence: final full-view and focused comparison paths listed above.
   - Result: no P0/P1/P2 mismatch remains; only the accepted P3 ornament detail remains.
5. User review reopened the desktop pass because tall viewports stretched every card panel.
   - Correction: desktop modal and workspace are content-sized; saved-slot rows stay at the intended 172px density and unused space remains outside the panels.
   - Evidence: `deck-builder-content-sized-final.png` at 1231 × 886; texture and gold framing remain visible without vertical stretching.

## Verification

- `npm run test:jest -- test/ui.deck-builder-controller.test.ts test/ui.deck-builder-layout-css.test.ts test/ui.deck-builder-browser-registry.test.ts` — 3 suites, 50 tests passed.
- `npm run build:browser` — passed.
- `npm run worker:prepare` — mirror verified, 826 files.
- `git diff --check` — passed.

final result: passed after density correction; reviewer follow-up remains open for visual sign-off
