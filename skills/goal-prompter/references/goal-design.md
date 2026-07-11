# Goal Design Reference

Source basis, verified 2026-07-11:

- OpenAI, “Follow a goal”: https://developers.openai.com/codex/use-cases/follow-goals
- OpenAI, “Slash commands”: https://learn.chatgpt.com/codex/reference/slash-commands

Recheck current official documentation before making capability, command, feature-flag, or surface-specific claims.

## Current Official Model

- Use `/goal` for one durable objective that needs work across turns toward a verifiable stopping condition.
- Keep a Goal larger than one normal prompt and smaller than an open-ended or unrelated backlog.
- Define one objective, one success stopping condition, material to read first, verification commands or artifacts, and evidence-producing checkpoints.
- Use compact progress reports that identify the current checkpoint, verified evidence, remaining work, and whether Codex is blocked.
- In the desktop app, `/goal` sets a persistent Goal in the current task. Goal controls can pause, resume, edit, or clear it, and follow-up messages can steer it.
- `/plan` can shape the objective before `/goal` activation, but drafting and activation remain distinct user intents.
- CLI and app availability can change. Verify the current surface instead of relying on a remembered version threshold.

## Lean Prompt Shape

```text
/goal <one objective>. Complete when <observable stopping condition>, verified by <commands, artifacts, sources, or workflow>. Preserve <behavior, contracts, data, and constraints>. Work within <scope, tools, approvals, and hard limits>. Read <material pointers> first when relevant. Use evidence-producing checkpoints and compact status reports. If blocked or a hard limit is reached, report completed checkpoints, evidence, attempts, remaining work, blocker or limit, and the next input needed.
```

## Patterns

### Migration or Refactor

```text
/goal Complete <migration or refactor scope>. Complete when <target behavior> passes <contract tests, typecheck, build, or smoke checks> and <legacy compatibility or rollback requirement> remains intact. Modify only <allowed layers>. Read <architecture and source-of-truth files> first. At each checkpoint, verify the changed slice. If blocked or a hard limit is reached, report completed slices, failing evidence, remaining risk, and the decision or input needed.
```

### Flaky Test or Bug Hunt

```text
/goal Make <failure> reproducibly resolved. Complete when <test or reproduction command> meets <acceptance rule> while preserving <public behavior>. Use <logs, tests, related implementation, and reproduction tools>. Record reproduction evidence before changing code and verify the fix afterward. If the failure cannot be reproduced or no defensible fix remains, report attempts, evidence, likely causes, uncertainty, and the next input needed.
```

### Performance or Evaluation

```text
/goal Reach <user-approved metric or acceptance rule>, verified by <benchmark or eval command>, while keeping <correctness checks and compatibility constraints> green. Use <allowed files, services, and data>. Inspect failing or weak cases between checkpoints. Stop at any explicit time, token, or cost limit and report the best verified result, remaining gap, and next experiment.
```

### Research or Audit

```text
/goal Produce <report or audit artifact> answering <claims or questions> from <authoritative sources and local material>. Complete when every required claim is labeled as confirmed, partially supported, proxy-supported, blocked, or uncertain and the artifact passes <review criteria>. Preserve source links and distinguish inference from direct evidence. If exact proof is unavailable, report the missing evidence and next input needed.
```

### Documentation or Generated Artifact

```text
/goal Produce <artifact> for <audience and purpose>. Complete when it covers <required topics> and passes <build, validation, or review criteria>. Preserve <style and source-of-truth constraints>. Use <source documents and examples>. If blocked or limited, report draft status, verified sections, missing evidence, and required source material.
```

## Activation Vocabulary

| User wording | Default action |
| --- | --- |
| draft, write, create a prompt, improve, review, translate | Return text only |
| activate, set the Goal, start Goal mode | Show final wording, then activate in the same chat |
| ambiguous “create a Goal” | Draft first; ask before activation |

## Repository Intake

Before asking the user, discover:

- Repository instructions and closest nested instructions.
- Source-of-truth specifications and architecture contracts.
- Existing verification commands and acceptance artifacts.
- Public APIs, schemas, snapshots, output formats, and workflows to preserve.
- Dirty-worktree constraints, generated or mirrored paths, and prohibited files.

Ask only for product choices, acceptance decisions, unavailable external evidence, hard limits, or approval gates that cannot be inferred safely.

## Failure Checks

- Replace vague “improve” or “fix it” with an observable outcome and stopping condition.
- Split unrelated objectives instead of hiding a backlog inside one Goal.
- Do not mistake a request to draft text for permission to activate Goal mode.
- Do not ask for information already available in the repository or current environment.
- Do not copy an entire instruction file, API list, or test catalog into the Goal when an authoritative pointer plus a focused invariant is enough.
- Do not turn a plausible implementation plan into a Goal requirement; pin the result and proof, then leave safe mid-path choices to Codex.
- Do not expand the user's named systems or deliverables to adjacent work; label adjacent risks or follow-ups outside the Goal unless they are required for success.
- Do not repeat repository-wide Git, generated-file, or standard verification rules that already apply through referenced instructions.
- Do not ignore explicit time, token, cost, command, or approval limits.
- Do not declare success from confidence alone or declare blocked merely because progress is slow.
- Do not require irrelevant material pointers, alternatives, or citations that add no decision value.
