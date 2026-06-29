# harsh-critic skill design

## Goal

Add the downloaded harsh-review skill into this repository as a reusable local skill.

## Scope

- Create a repo-local skill directory at `skills/harsh-critic/`
- Preserve the original skill intent while tightening it into a concise, reusable form
- Add the skill to the repo skill index in `SKILLS.md`

## Decisions

- Keep the skill name as `harsh-critic` because it already matches the behavior and uses valid skill naming
- Store the skill under `skills/` because that is the most natural repo-local home for reusable skill documents
- Do not alter gameplay code or runtime files because this is instruction/documentation work only

## Verification

- Confirm the new skill file exists and uses valid frontmatter
- Confirm `SKILLS.md` points to the new local skill
- Inspect the final diff for documentation-only changes
