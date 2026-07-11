---
name: goal-prompter
description: |
  Use when the user asks to draft, improve, review, translate, or activate a Codex Goal or `/goal` prompt for one durable long-running objective with a verifiable stopping condition. Inspect available context before asking questions, keep the entire workflow in the current main chat, and distinguish drafting from activation. Do not use for ordinary one-turn implementation, research, review, or explanation unless the user explicitly wants it turned into a Goal.
---

# Goal Prompter

## Purpose

Turn a durable objective into a compact, auditable Goal contract. A Goal is larger than one normal prompt, smaller than an open-ended backlog, and complete only when concrete evidence satisfies its stopping condition.

## Operating Contract

- Keep fit checking, context inspection, questions, drafting, confirmation, activation when requested, and reporting in the chat where this skill was invoked.
- Do not create, fork, open, recommend, or hand off to another chat, thread, task, or worktree for this workflow.
- Inspect available files, instructions, current state, and tool capabilities before asking the user. Ask only for decisions or facts that cannot be discovered safely.
- Point to authoritative repository instructions instead of copying them wholesale into the Goal. Do not repeat Git hygiene, standard verification policy, or generated-file rules that already apply through those instructions; restate only exceptions and invariants that materially change this Goal.
- Use the user's language unless they request another language.
- Treat explicit time, token, cost, command, service, and approval limits as authoritative constraints.
- Avoid arbitrary self-imposed iteration caps, but never ignore user limits, platform limits, or a genuine blocked condition. When a limit is reached, report verified progress and remaining work.
- Support factual claims with current evidence. Drafting advice may be explained directly without forcing an artificial citation on every sentence.

## Goal Fit

Recommend a Goal when all of these are true:

- There is one durable objective that may need multiple turns or checkpoints.
- Success can be shown by tests, commands, artifacts, source evidence, logs, benchmarks, or an observable workflow.
- Codex can make scoped progress without requiring the user to choose every intermediate step.

Use a normal prompt for a one-line edit, simple explanation, short review, single deterministic command, or unrelated backlog. If the user still wants a Goal, draft one but state the weak fit and tighten the stopping condition.

## Workflow

1. Inspect the target, current state, applicable instructions, existing evidence, and available Goal capability.
2. Decide whether the request is a good Goal fit.
3. Fill the Goal contract from discovered evidence and explicit user requirements.
4. Ask the smallest useful batch of missing decision questions.
5. Draft one recommended Goal and explain the contract briefly.
6. Activate it only when the user explicitly requests activation and the current environment supports it.

## Inspect Before Asking

For repository work:

- Read the root `AGENTS.md` and the closest applicable nested instructions.
- Identify the relevant source-of-truth documents, public contracts, existing test or build commands, and dirty-worktree constraints.
- Derive material pointers, preservation constraints, and verification commands from the repository instead of asking the user to repeat them.
- In this repository, use `01-rulebook.md` for player-visible behavior, `docs/architecture-contracts.md` for internal boundaries, and `AGENTS.md` for verification and Git rules.

Ask at most a small focused batch at a time. Prioritize:

1. The exact end state and success stopping condition.
2. The evidence that proves success.
3. Product decisions, protected behavior, hard limits, or risky actions requiring approval.

For research or audit Goals, also resolve the authoritative source hierarchy, final artifact, and how confirmed findings, proxy evidence, blocked claims, and uncertainty must be labeled.

Do not ask about iteration strategy unless the user requests one. Default to evidence-producing checkpoints and compact progress reports.

## Goal Contract

Include these required elements:

- **Objective:** one outcome that should become true.
- **Success stopping condition:** the observable state that permits completion.
- **Verification:** commands, artifacts, checks, sources, or workflows that prove the stopping condition.
- **Preservation constraints:** behavior, APIs, schemas, data, files, or user workflows that must not regress.
- **Boundaries and limits:** allowed scope, tools, services, repositories, risk gates, and explicit time, token, or cost limits.
- **Blocked or limit report:** evidence gathered, paths attempted, completed checkpoints, remaining uncertainty, blocker or reached limit, and the next input needed.

Include when relevant:

- **Material pointers:** files, docs, issues, logs, plans, source IDs, or official domains to inspect first.
- **Checkpoint policy:** a user-requested iteration strategy or a lightweight requirement to report the current checkpoint, verified evidence, remaining work, and blocked state.
- **Evidence labels:** exact proof, partial support, proxy evidence, approximation, and uncertainty for research or audit work.

Do not require material pointers when none are useful. Do not prescribe numeric thresholds that Codex can safely derive from authoritative material; do require the acceptance threshold when it is a product decision.

Pin the outcome, evidence, protected invariants, boundaries, and stopping behavior. Do not turn discovered implementation ideas into mandatory steps unless the user or an authoritative source already requires that design.
Do not broaden the named objective, target systems, or deliverables merely because inspection reveals adjacent work. Put adjacent risks or optional follow-ups in assumptions or explanation unless they are required for the stated stopping condition.

## Activation Rules

- Interpret “draft,” “write,” “create a prompt,” “improve,” “review,” and “translate” as drafting only.
- Activate only for explicit intent such as “activate,” “set the Goal,” “start Goal mode,” or an equally clear request to begin the Goal.
- Before activation, show the exact final Goal text unless the user already approved that exact wording.
- Use native Goal tools in the current chat when available. Do not create or navigate to another task.
- When a native tool accepts an objective field, pass the Goal body in the schema it expects; keep the literal `/goal` prefix only for copy-ready slash-command text.
- Do not replace, clear, or supersede an existing active Goal without explicit user direction.
- Pass a token budget only when the user explicitly requested one.
- If activation is unavailable, provide a copy-ready `/goal` prompt and state that it was not activated.
- For current capability or CLI setup claims, inspect callable tools, local help, or current official OpenAI documentation. Do not rely on remembered version numbers.

## Output

When information is sufficient, provide:

1. **Recommended `/goal`:** one copy-ready Goal.
2. **Why it works:** a brief mapping to objective, stopping condition, verification, constraints, boundaries, and blocked or limit reporting.
3. **Assumptions:** only assumptions that materially affect success.
4. **Before activating:** only unresolved decisions that prevent safe activation.

Keep the recommended Goal as short as the contract allows. Put inspection evidence, rationale, and candidate implementation approaches in the explanation rather than the Goal itself. Prefer a high-level document, directory, glob, or existing verification entry point over exhaustive file and test lists. Use labeled subsections only when they make a complex stopping condition or evidence matrix easier to audit.

Add alternatives only when they materially change scope, verification burden, risk, or stopping behavior. When reviewing an existing Goal, return the revised Goal first, followed by the important changes.

If essential information is missing, ask only the next smallest set of questions. Do not present a confident final Goal with unresolved placeholders.

If activation was explicitly requested and the Goal is ready, present the final wording, activate it in this same chat, and report the activation result here.

## Quality Check

Before delivering or activating a Goal, verify:

- It contains one objective rather than a loose backlog.
- Its success stopping condition is observable and evidence-based.
- Verification can fail as well as pass.
- Preservation constraints and hard limits are explicit.
- Material pointers and checkpoint reporting are included only where useful.
- Repository rules are referenced rather than duplicated unless a specific invariant must appear in the Goal.
- Discovered implementation ideas remain choices unless the user or source of truth made them requirements.
- The Goal does not silently expand beyond the user's named objective or target systems.
- Drafting language cannot be mistaken for activation consent.
- Blocked and limit-reached reports preserve partial evidence without pretending the Goal succeeded.
- The prompt is compact enough to remain legible across later turns in this same chat.

Read `references/goal-design.md` for current official behavior notes, reusable patterns, and failure checks.
