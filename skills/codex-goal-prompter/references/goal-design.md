# Goal Design Reference

Source basis: OpenAI Cookbook, "Using Goals in Codex" (May 9, 2026), https://developers.openai.com/cookbook/examples/codex/using_goals_in_codex

## Core Model

A Codex Goal should define what must become true, how success is checked, and what must remain intact. Treat it as evidence-based state for the current main chat, not as a handoff artifact for a side chat or separate thread. Conduct drafting, confirmation, activation when requested, and completion reporting in the chat where the skill was invoked.

Good Goal candidates:

- Performance tuning with benchmarks and correctness tests.
- Flaky test reproduction and repair.
- Multi-step migrations or refactors.
- Bug hunts where reproduction is part of the work.
- Research or audit work that needs a final evidence-backed artifact.
- Iterative model, benchmark, or dependency improvement tasks.

Poor Goal candidates:

- One-line edits.
- Simple explanations.
- Short code reviews.
- Questions that should stop after one answer.
- Vague work without an auditable finish line.

## Prompt Patterns

These templates show the default lean shape: outcome, verification, constraints, boundaries, blocked stop. Add a concrete iteration-policy sentence only when the user explicitly requests iteration strategy, for example: "Between iterations, inspect the newest failing check before editing again." By default leave iteration to Codex's autonomous judgment, including the choice to keep iterating until the Outcome is fully satisfied. Material pointers are encouraged where Codex needs to know where to look.

### Performance

```text
/goal Reduce <metric> below <threshold>, verified by <benchmark command or artifact>, while keeping <correctness checks> green and preserving <compatibility constraints>. Use <allowed services/files/tests>. If the benchmark cannot run or no valid paths remain, stop with attempted paths, evidence, blocker, and needed input.
```

### Flaky Test

```text
/goal Make <test name> reliably pass on the current branch, verified by <repeat count or command>, while preserving <behavior/API constraints>. Use <test files, related implementation, logs, reproduction tools>. If the failure cannot be reproduced or no valid fix remains, stop with reproduction attempts, evidence, likely causes, and the next input needed.
```

### Migration or Refactor

```text
/goal Complete <migration/refactor scope>, verified by <tests/typecheck/build/smoke command> and <artifact inspection>, while preserving <public API/schema/output/user workflow>. Modify only <allowed layers/files>. If blocked, stop with completed slices, remaining risks, failing evidence, and the decision needed.
```

### Documentation or Generated Artifact

```text
/goal Produce <artifact> that covers <required topics/audience>, verified by <build/check/review criteria>, while preserving <style/source-of-truth constraints>. Use <source docs/repos/examples>. If blocked, stop with the draft status, missing evidence, and source material needed.
```

### Research or Audit

```text
/goal Produce an evidence-backed <report/audit/reproduction> for <topic>, using <authoritative sources and local resources>. Material pointers: <file paths, doc references, source IDs, web domains>. Attempt <required claims or experiments> where feasible, verify outputs where possible, and end with a report that separates confirmed findings, approximate support, blocked claims, and remaining uncertainty. If exact proof is unavailable, label proxy evidence explicitly and stop with the missing inputs needed to reduce uncertainty.
```

## Intake Checklist

Use this checklist as a private drafting aid. Ask only the questions that are missing and important.

- Desired end state: What changes or artifact should exist?
- Evidence: Which command, benchmark, test, log, source, or review proves completion?
- Threshold: Is there a number, repeat count, pass/fail condition, or acceptance rule?
- Constraints: What must not regress?
- Boundaries: Where may Codex work? What must it avoid?
- Material pointers: Where should Codex look for evidence? (file paths, documentation references, source IDs, web domains, prior reports). Pointers beat prescribed values.
- Iteration policy: [OPTIONAL] Should Codex use any specific iteration strategy? Skip this by default — only ask if the user explicitly requests a strategy. By default Codex should keep iterating until the Outcome is fully satisfied; iteration caps, hard ceilings, and "ran out of budget" stops are anti-patterns.
- Risk gates: What actions require approval?
- Stop condition: What counts as blocked?
- Final report: What must Codex summarize if complete, blocked, or budget-limited?
- Language and format: Should the final `/goal` be in English, Japanese, or another language?

## Common Fixes

- Replace "improve" with a measured target or audit criterion.
- Replace "fix it" with the failing behavior and verification command.
- Replace "do research" with claim inventory, source hierarchy, evidence labels, and final artifact.
- Add `while preserving <constraint>` for public behavior, API compatibility, data integrity, test coverage, or user workflow.
- Add `If blocked, report <required evidence>` so Codex reports useful evidence instead of looping.
- Add `Material pointers: <paths/docs/source IDs/web domains>` to point Codex at relevant materials. Prefer pointers over prescribed numeric values.
- Add a concrete `Between iterations, ...` sentence ONLY when the user explicitly requests iteration policy. By default, leave mid-path decisions to Codex, who should keep refining until the Outcome is fully satisfied rather than stopping at any preset iteration count or wall-clock budget.
