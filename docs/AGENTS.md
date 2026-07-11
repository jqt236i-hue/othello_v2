# docs/ AGENTS.md

Documentation role boundary. Use this file with the root `AGENTS.md` as the local boundary guide.

## Where to write

| Task | Location | Notes |
| --- | --- | --- |
| Player-visible rules/spec | `../01-rulebook.md` | Source of truth for gameplay, card behavior, UI-visible timing. |
| Stable internal contracts | `architecture-contracts.md` | Module boundaries, runtime contracts, authority, DI, validation bundles. |
| Current operational reference | top-level docs files | Keep purpose and currentness explicit. |
| Historical plan/runbook/report | `archive/` | Not normative unless explicitly marked Active. |
| New structured plan | `*plan*.md` or `../.sisyphus/plans/*` | Include phase, completion criteria, verification bundle. |

## Rules

- State the document role, target, source of truth, and non-goals first.
- Do not put gameplay spec changes only in `docs/`; update `01-rulebook.md` first.
- Do not turn docs into a TODO pile. A plan must let the next executor act.
- Claims need evidence: file paths, test/check outputs, or explicit investigation notes.

## Archive rule

- `docs/archive/` is historical by default.
- If a stable contract emerges from an archive/runbook, move the contract to `architecture-contracts.md`.
- Do not cite archive docs as current authority without checking current contract docs.

## Verification

- Docs-only changes require `git diff --check`, reference and file-existence checks, and rendered Markdown inspection when layout matters. Validate frontmatter only for document types that use it.
- If docs describe behavior changes, include the matching implementation/test update or explain why not.
