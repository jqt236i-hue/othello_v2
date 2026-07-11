---
name: codex-goal-prompter
description: |
  Use when the user asks to create, improve, review, translate, or decide whether to use a Codex Goal or `/goal` prompt for a long-running objective. Keep the interview, drafting, confirmation, activation, and reporting in the current main chat; never redirect the workflow to a side chat or separate thread. Do NOT use for ordinary debugging, refactoring, research, audits, or implementation unless the user explicitly wants those turned into a Goal.
---

# Codex Goal Prompter
## Low-Capability Execution Contract
- Classify the request against the frontmatter before using this skill. If another skill owns the task more directly, switch before doing work.
- Collect these inputs before analysis: target artifact or repository path, user objective, constraints, prior commitments, available evidence, expected output format, and the decision the user needs.
- Execute in this order: inspect the artifact or live state, extract concrete evidence, compare evidence to the objective, identify blockers, then produce the requested decision or artifact.
- Every finding or recommendation must cite a file, command output, data point, or explicit user requirement. Do not rely on unsupported adjectives or memory-only claims when current evidence is available.
- Before final response, verify that all required checks ran or state the exact blocker. Include changed paths or reviewed paths, evidence used, remaining risks, and the next action.

## Purpose

Help the user turn an intended long-running Codex task into a strong Goal prompt. Prioritize detailed hearing before drafting: a Goal is a scoped completion contract, not a bigger one-off prompt.

## Current Main Chat Contract

- Treat the conversation where the skill was invoked as the main chat.
- Complete the fit check, interview, draft, confirmation, activation when requested, and final report in this same chat.
- Do not create, fork, open, recommend, or hand off to a side chat, separate thread, or separate task for any part of this workflow.
- Interpret "multiple turns" as later turns in this same main chat, not as permission to move the work elsewhere.
- If Goal activation is unavailable in the current chat, provide the copy-ready Goal draft here and state the limitation. Do not move the user to another chat as a workaround.

Use the user's language unless they request otherwise. If the user wants the final `/goal` prompt in another language, ask once and then write it in that language.

### Default posture: perfect over fast

The user prefers a fully complete submission over a fast one. Codices should keep iterating while each iteration can produce new evidence, a concrete fix, or a narrower decision. Arbitrary caps imposed only to "save time" are anti-patterns, but every Goal must include a blocked stop condition for repeated blockers, contradictory constraints, missing external access, or no remaining valid path.

## Workflow

1. Decide whether a Goal is appropriate.
2. Interview the user for missing completion details.
3. Draft one or more `/goal` prompts.
4. Explain what each prompt optimizes for.
5. Ask for confirmation before activating a Goal unless the user explicitly asked to create or set it.
6. When activation is requested and supported, activate the Goal in this same main chat and report the result here.

## Activation Gate

Drafting a Goal does not require a local Codex CLI that supports Goals. Activating
one does.

- In Codex Desktop or an environment exposing Goal tools, use the platform's
  native Goal creation flow in the current main chat when the user explicitly
  asks to activate/set it. Do not create or navigate to another thread or task.
- In CLI-only contexts, check local command evidence before telling the user to
  run `/goal`: `codex --help`, `codex --version`, and any available goal-related
  help output. If current official OpenAI docs are needed to confirm support,
  browse official OpenAI sources only.
- Treat `0.128.0` as a stale lower-bound note from a prior local observation, not
  as an authoritative rule. Do not activate or recommend CLI Goal usage from this
  number alone.
- If local help or current official docs do not confirm Goal support, output a
  copy-ready Goal draft and say `UNVERIFIED: local Codex CLI Goal support not
  confirmed`. Do not imply that `/goal` will work locally.
- Keep Desktop/API activation instructions separate from CLI activation
  instructions.

## Goal Fit Check

Recommend a Goal when the task has:

- A durable objective that may require several turns in the same main chat.
- An evidence-based finish line: tests, benchmark output, generated artifact, report, source evidence, logs, or reproducible commands.
- An uncertain path where Codex should inspect, try, verify, and continue.

Recommend a normal prompt instead when the task is a one-line edit, a simple explanation, a short review, a single deterministic command, or a question where the user wants one answer and then a stop.

If the user insists on a Goal for a weak fit, still draft it, but make the limitation explicit and tighten the evidence standard as much as possible.

## Interview

Ask focused batches of questions. Do not dump the entire checklist at once unless the user explicitly asks for exhaustive intake. Start with the first batch; continue until the Goal can be audited.

First batch:

- What exact end state should be true when Codex is done?
- What evidence should Codex use to verify that end state?
- What must not regress or be changed while Codex works?
- What files, repos, tools, data, services, or time/budget limits define the boundary?

Second batch, only when needed:

- What should count as blocked, and what should Codex report if no defensible path remains?
- Are proxy results acceptable? If yes, how should Codex label exact proof, partial support, approximation, and uncertainty?
- Should Codex stop for approval before risky edits, external calls, dependency upgrades, data deletion, or expensive commands?

Default: do NOT ask about iteration policy in the interview. Let Codex choose its own next-action strategy based on the outcome, verification, and boundaries. Codex should keep refining until the Outcome is fully satisfied — partial delivery is worse than slow convergence. Only ask about iteration policy if the user explicitly requests a specific strategy.

For coding Goals, also ask:

- Which test, lint, typecheck, benchmark, reproduction, or smoke command proves progress?
- Which public APIs, schemas, snapshots, output formats, or user workflows must remain compatible?
- Are there files or layers Codex should avoid?

For research or audit Goals, also ask:

- What claims or questions should be answered?
- What source material is authoritative?
- What final artifact should be produced?
- How should Codex separate confirmed findings, approximate support, blocked claims, and remaining uncertainty?

## Drafting Standard

Write Goals with these parts:

- Outcome: what should be true. Always make this explicit.
- Verification surface: how Codex proves it.
- Constraints: what must remain true.
- Boundaries: allowed files, tools, data, repositories, and limits.
- Blocked stop condition: when to stop and what to report.

Iteration policy is OPTIONAL: include a specific strategy only when the user explicitly requests one. Even when no strategy is specified, the Goal must require each iteration to record new evidence/progress or stop as blocked when the blocked condition is met.

Material pointers are encouraged: when the Goal involves research, audit, or evidence gathering, include pointers to file paths, documentation references, source IDs, or web domains where Codex should look. Pointing Codex at sources is preferred over prescribing specific numeric values, multipliers, or thresholds that Codex can derive from the material itself.

Build the final `/goal` from these fields. Do not emit the `/goal` line until
every field is replaced with concrete text from the interview:

| field | required content |
| --- | --- |
| desired end state | the exact state that should become true |
| specific evidence | how Codex proves completion |
| constraints | what must remain preserved |
| allowed inputs/tools/boundaries | repositories, files, tools, data, and limits |
| material pointers | concrete paths, source IDs, docs, or domains to inspect |
| blocked stop report | evidence gathered, attempted paths, blocker, and next input needed |

Add a concrete iteration-policy sentence only when the user explicitly requests one, for example: "Between iterations, inspect the latest failing test output before editing again." Otherwise let Codex choose its own next-action strategy while requiring evidence of progress between iterations. Do not declare blocked on slow progress alone; do declare blocked when the same blocker repeats and no meaningful progress path remains.

Keep the final Goal compact enough to stay memorable, but specific enough that a later turn in the current main chat can decide whether to continue or complete it from evidence.

## Output Format

When enough information is available, respond with:

1. `Recommended /goal`: one copy-ready Goal prompt.
2. `Why this works`: a short mapping of outcome, evidence, constraints, boundaries, and blocked stop condition. Mention material pointers if included; skip iteration policy if it was left to Codex.
3. `Assumptions`: only the assumptions that affect success.
4. `Alternatives`: include shorter or stricter versions only when they materially change activation risk, evidence burden, or blocked-state handling.
5. `Before activating`: any remaining detail the user should confirm in this chat.

If the user already asked to activate/set the Goal and all required information is available, activate it in the current main chat after presenting the final wording. Do not end by directing the user to a separate chat.

If information is insufficient, do not draft a confident final Goal. Ask the next smallest set of questions. Provide a clearly labeled rough draft only when all of these are known: objective, target artifact or system, finish evidence, allowed scope, and at least one blocker or stop condition. Otherwise ask questions only.

## Quality Checks

Before presenting the final prompt, verify:

- The Goal has a measurable or auditable finish line.
- Completion cannot be declared from confidence alone; it requires concrete evidence.
- Constraints are explicit enough to prevent hidden regressions.
- The boundary is neither so broad that Codex can wander nor so narrow that obvious fixes are excluded.
- The blocked condition covers genuine impossibility (no valid path remains, the upstream project requires external changes, the constraint set is contradictory, or the same blocker repeats without a meaningful progress path). It must NOT fire on slow progress alone or on an arbitrary iteration count. Codex should report partial progress with remaining uncertainty, not declare blocked prematurely.
- Research Goals preserve uncertainty instead of flattening partial support into success.
- The prompt does NOT prescribe specific numeric values, multipliers, thresholds, or test counts that Codex can derive from the material itself. Mid-path decisions are left to Codex's autonomous judgment; only the outcome, verification, constraints, boundaries, and blocked stop are pinned down.

For deeper examples and wording patterns, read `references/goal-design.md`.
