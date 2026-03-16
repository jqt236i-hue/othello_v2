---
name: 'repo-skill-authoring-workflow'
description: 'この repo 向けの新しい workflow skill を、安全に調査・設計・作成・索引化・検証するワークフロー。Use when adding or updating .github/skills/*/SKILL.md, expanding SKILLS.md, turning repeated repo workflows into reusable skills, or planning multi-skill additions in this card-othello repository.'
argument-hint: 'どの作業を skill 化したいか。新規追加か既存 skill の整理かも書く'
---

# Repo Skill Authoring Workflow

このスキルは、この repo で繰り返し出る作業を skill に切り出す時、skill / instruction / agent / README.ai のどれに置くべきかを判断し、安全に追加・更新する手順です。

## When to Use

- 同種の調査手順と検証束が何度も出てくる時
- 既存 skill が古く、索引や本文を整理したい時
- 新しい workflow を `.github/skills/*/SKILL.md` と `SKILLS.md` へ追加したい時
- 複数 skill にまたがる再編を計画したい時

## Read First

- `01-rulebook.md`
- `.github/copilot-instructions.md`
- `AGENTS.md`
- 触る領域に対応する `.github/instructions/*.instructions.md`

## Primary Files

- `SKILLS.md`
- `.github/skills/**/SKILL.md`
- 境界確認用に `.github/instructions/*.instructions.md`, `.github/agents/*.agent.md`, `AGENTS.md`, `.github/copilot-instructions.md`

## Common Traps

- 一度きりの局所ルールを skill にしてしまうこと
- repo-wide rule を skill 側で重複定義すること
- frontmatter や `SKILLS.md` の索引更新を忘れること
- 既存 skill と対象範囲が重なったまま増やすこと

## Procedure

1. まず、その作業が skill に向く反復作業か、instruction / agent / README.ai で足りるかを判断する。
2. 対象ファイル、よくある罠、検証束、完了条件が固定できるかを確認する。
3. skill 名、説明、argument-hint を安定した名前で決める。
4. `SKILL.md` を workflow 専用で書き、repo-wide rule の再定義を入れない。
5. `SKILLS.md` の索引と選び方を同じタスクで更新する。

## Validation Bundle

- frontmatter (`name`, `description`, `argument-hint`) がある
- `SKILLS.md` に索引がある
- skill の対象範囲が既存 skill と重なりすぎていない
- sample prompt を 1 つ想定した時に入口が明確

## Completion Checklist

- 新規 / 更新した skill の使いどころが明確になっている
- 索引と本文が同じタスクでそろっている
- repo-wide rule を重複定義していない
- 検証結果と `01-rulebook.md` 更新有無を報告している
