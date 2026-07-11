# Network Repair Baseline 2026-06-22

This report records the Phase 0.2 baseline for
`docs/archive/2026-06-22-network-battle-complete-repair-optimization.md`.

It is an execution baseline, not a gameplay specification. Player-visible
behavior remains governed by `01-rulebook.md` and `正本/`. Internal boundaries
remain governed by `docs/architecture-contracts.md`.

## Worktree Status

Baseline was captured with the following pre-existing dirty files present:

```text
 M index.html
 M public/module-registry.js
 M test/ui.animation-engine.test.ts
 M test/ui.animation-utils.hand-fallback.test.ts
 M ui/animation-engine.ts
 M ui/animation-utils.ts
 M worker-public/index.html
 M worker-public/public/module-registry.js
 M worker-public/styles-layout-info.css
 M worker-public/styles-layout-result.css
```

The generated/mirror files are not safe to overwrite until their ownership is
resolved or the work is moved to a clean checkout/worktree.

## Surface Counts

Command:

```powershell
$files = @(
  'ui/network-client.ts',
  'ui/network/publish-flow.ts',
  'ui/network/stream-snapshot.ts',
  'ui/network/session-lifecycle.ts',
  'ui/network/snapshot.ts',
  'ui/render-scheduler.ts',
  'cards/card-interaction-pending-settlement.ts',
  'utils/match-authority.ts',
  'public/module-registry.js',
  'worker-public/public/module-registry.js'
)
foreach ($f in $files) {
  $text = Get-Content $f -Raw
  $lines = ($text -split "`n").Count
  $catch = [regex]::Matches($text, 'catch\s*\(').Count
  $render = [regex]::Matches($text, 'renderBoard|renderBoardFull|requestBoardRender|flushVisualUpdates|emitBoardUpdate').Count
  "{0}`tlines={1}`tcatch={2}`trenderRefs={3}" -f $f,$lines,$catch,$render
}
```

Observed output:

```text
ui/network-client.ts	lines=3849	catch=101	renderRefs=34
ui/network/publish-flow.ts	lines=374	catch=2	renderRefs=0
ui/network/stream-snapshot.ts	lines=212	catch=0	renderRefs=0
ui/network/session-lifecycle.ts	lines=735	catch=2	renderRefs=0
ui/network/snapshot.ts	lines=812	catch=25	renderRefs=18
ui/render-scheduler.ts	lines=198	catch=4	renderRefs=13
cards/card-interaction-pending-settlement.ts	lines=158	catch=4	renderRefs=0
utils/match-authority.ts	lines=2738	catch=3	renderRefs=0
public/module-registry.js	lines=2715	catch=2756	renderRefs=272
worker-public/public/module-registry.js	lines=2715	catch=2756	renderRefs=272
```

## Authority Marker Drift

Command:

```powershell
$paths=@('utils/match-authority.ts','dist/utils/match-authority.js','public/module-registry.js','worker-public/public/module-registry.js')
foreach($p in $paths){
  if(Test-Path $p){
    $text=Get-Content $p -Raw
    $sse=[regex]::Match($text,'SSE_RESUME_BUFFER_LIMIT\s*=\s*(\d+)')
    $journal=[regex]::Match($text,'PRESENTATION_JOURNAL_LIMIT\s*=\s*(\d+)')
    $base=$text.Contains('presentationJournalBaseVisualSeq')
    "{0}`tSSE={1}`tJournal={2}`tHasBase={3}" -f $p, $(if($sse.Success){$sse.Groups[1].Value}else{'none'}), $(if($journal.Success){$journal.Groups[1].Value}else{'none'}), $base
  }
}
```

Observed output:

```text
utils/match-authority.ts	SSE=8	Journal=8	HasBase=True
dist/utils/match-authority.js	SSE=8	Journal=8	HasBase=True
public/module-registry.js	SSE=96	Journal=none	HasBase=False
worker-public/public/module-registry.js	SSE=96	Journal=none	HasBase=False
```

## Generated Surface Check

Command:

```powershell
npm run check:generated-network-surface
```

Observed result: failed after `npm run build:ts`, as expected for the current
baseline.

```text
public/module-registry.js: SSE_RESUME_BUFFER_LIMIT mismatch: source=8 generated=96
public/module-registry.js: PRESENTATION_JOURNAL_LIMIT missing from generated
public/module-registry.js: presentationJournalBaseVisualSeq missing from generated
public/module-registry.js: presentationJournalBaseSnapshotByViewer missing from generated
worker-public/public/module-registry.js: SSE_RESUME_BUFFER_LIMIT mismatch: source=8 generated=96
worker-public/public/module-registry.js: PRESENTATION_JOURNAL_LIMIT missing from generated
worker-public/public/module-registry.js: presentationJournalBaseVisualSeq missing from generated
worker-public/public/module-registry.js: presentationJournalBaseSnapshotByViewer missing from generated
```

## Baseline Implications

- Source and `dist/utils/match-authority.js` agree on the network authority
  constants and presentation journal base markers.
- Browser registry and worker-public registry are stale and must be regenerated
  through the existing scripts before runtime network behavior can be trusted.
- `ui/network-client.ts` is still the largest risk surface, with 101 catch
  blocks and 34 references to board render/write paths.
- `ui/network/snapshot.ts` and `ui/render-scheduler.ts` still contain render
  references that must be classified against the Single Visual Writer contract
  before removing compatibility paths.
