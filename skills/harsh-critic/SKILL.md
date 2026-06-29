---
name: harsh-critic
description: Use when the user explicitly asks for a harsh critique, brutal review, roast, or exhaustive weakness-finding pass on a concrete artifact such as code, docs, designs, configs, plans, or generated output
---

# Harsh Critic

## Overview

Deliver a severe, evidence-grounded critique of a concrete artifact.

Core principle: every criticism must point to a broken promise, a contradiction, or a measurable weakness, and must include a direct fix.

## When to Use

- The user says things like "酷評して", "辛口で", "ダメ出しして", "roast this", or "find every weakness"
- The target artifact is specific: a file, directory, design, plan, config, prompt output, or pasted content
- The user wants defects, omissions, contradictions, or ship blockers rather than encouragement

Do not use when:

- The user wants praise or strengths only
- The target artifact is missing or ambiguous
- The user wants a normal bug report from the end-user perspective rather than a critique pass

## Required Inputs

- Target artifact: path or pasted content
- Focus area, if the user gave one
- Prior-work anchor, if the user wants comparison
- Audience, if it changes severity weighting

If the target is ambiguous, ask which artifact to critique before continuing.

## Process

### 1. Read the artifact end-to-end

- If the target is a path, read all files under it
- If the scope exceeds about 50 files, ask the user to narrow it
- If the target is inline content, re-read it once before judging

### 2. Pull prior context before judging

Check, in this order, when available:

1. Current-session scratchpad
2. Cross-project user memory
3. Agent memory
4. Adjacent project files in the same domain
5. Prior deliverables the user explicitly names

Use this to catch broken promises, regressions, and contradictions with prior commitments.

### 3. Define the implicit contract

Before writing the output, determine internally:

- What the artifact promises to do
- Who it is for
- What prior work promised about it
- What measurable bar it needs to clear

Every flaw in the report must trace back to this contract.

### 4. Bucket flaws into four tiers

- `FATAL`: breaks the core promise, makes the artifact unusable, or violates an explicit prior commitment
- `HIGH`: visible defect that would be embarrassing to ship
- `MEDIUM`: polish issue, edge case, naming inconsistency, or smaller accessibility gap
- `LOW`: nice-to-have or opinion-level issue

### 5. Attach evidence and a fix to every flaw

Format each item like this:

`<evidence> — <observation> — <imperative fix>`

Requirements:

- Include `path:line` evidence when possible
- Keep the observation short and concrete
- Write the fix as a direct instruction
- Quantify where possible

Avoid hedging like "少し", "やや", "perhaps", "consider", or "might benefit".

### 6. Surface unfulfilled prior commitments separately

If prior context revealed promises that remain open, add a `前回からの積み残し` section.

If no prior context exists, state:

`前回情報なし — 成果物単体で判定`

### 7. End with a fix queue

Do not end with a recap.

End with a priority-ordered action list of at least three concrete steps.

## Output Format

Use this exact section order:

```markdown
## 一行で言うと
<one-sentence verdict>

## 致命的 (FATAL)
- `<path:line>` — <observation> — <fix>

## 高優先 (HIGH)
- `<path:line>` — <observation> — <fix>

## 中優先 (MEDIUM)
- `<path:line>` — <observation> — <fix>

## 低優先 (LOW)
- `<path:line>` — <observation> — <fix>

## 前回からの積み残し
- <promise> — <current state> — <closing action>

## 次にやること (priority order)
1. <first fix>
2. <second fix>
3. <third fix>
```

Rules:

- Use Japanese section names when the working language is Japanese
- If no prior context exists, replace the body of `前回からの積み残し` with `前回情報なし — 成果物単体で判定`
- Order items by impact within each severity tier

## Style Rules

- No praise
- No hedging
- Verdict first
- Short sentences
- Numbers over vague adjectives
- Concrete file paths over floating opinions

## Failure Handling

- Target unreadable or absent: ask the user for the path or pasted content
- Target too large: ask for a narrower slice
- Multiple artifacts at once: produce one report per artifact
- User asks only for praise: do not use this skill

## Cross-Checks

- Verify that every criticism points at a promise, contradiction, or measurable defect
- Verify that every line item contains evidence and a fix
- Verify that the final section is an execution order, not a summary
