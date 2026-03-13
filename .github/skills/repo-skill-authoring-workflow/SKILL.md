---
name: repo-skill-authoring-workflow
description: 'この repo 向けの新しい workflow skill を、安全に調査・設計・作成・索引化・検証するワークフロー。Use when adding or updating .github/skills/*/SKILL.md, expanding SKILLS.md, turning repeated repo workflows into reusable skills, or planning multi-skill additions in this card-othello repository.'
argument-hint: 'どの領域の skill を作りたいか。対象領域、使う人、1本だけか複数本かも書く'
---

# Repo Skill Authoring Workflow

このスキルは、このリポジトリ向けの workflow skill を、実運用に耐える形で安全に追加・更新するための実務手順です。

## When to Use

- 新しい `.github/skills/<name>/SKILL.md` を作りたい
- 既存の skill を repo 実態に合わせて更新したい
- 同じ調査手順や修正手順が何度も出てきたので、再利用できる skill にしたい
- 1 本ではなく複数 skill をまとめて増やしたい
- `SKILLS.md` の索引を増やしたい

## Default Stance

- この repo では、project 共有の skill は `.github/skills/<name>/SKILL.md` に置く
- generic な customization ではなく、この repo 固有の読む順、罠、検証束を固める
- mandatory rule は `SKILLS.md` に書かず、必要なら `AGENTS.md` と `.github/copilot-instructions.md` 側に置く
- `AGENTS.md` と `.github/copilot-instructions.md` を触る時は、役割差だけを保って意味を揃える
- 1 回だけの作業なら skill 化せず、直接編集や prompt の方を優先する

## Repo-specific Facts

- customization の役割分担は次で固定する
  - `.github/copilot-instructions.md` は常時効く制約
  - `AGENTS.md` は作業導線
  - `.github/instructions/*.instructions.md` は applyTo の局所ルール
  - `.github/agents/*.agent.md` はサブエージェント
  - `.github/skills/**/SKILL.md` は再利用する workflow
- `SKILLS.md` は短い案内地図として使い、強制ルールの正本にしない
- この repo の skill は既存の見出し順を揃えておくと discovery と保守が安定する
- 広い領域の skill を複数作る時は、先に計画書を作る方が重複と粒度ずれを抑えやすい
- `prompts/*.agent.md` は古い置き方なので、新しい custom agent は `.github/agents/*.agent.md` を使う

## Procedure

1. まず skill 化すべきかを判定する
   - 毎回読む順がほぼ同じか
   - 代表的な罠が繰り返し出るか
   - 最小の検証束を固定できるか
   - 1 回だけで終わるなら skill にしない

2. scope と primitive を決める
   - この repo の共有ルールなら workspace scope にする
   - 多段の再利用手順なら skill を選ぶ
   - 常時効く内容なら instruction、文脈隔離が必要なら agent を選ぶ

3. 先に読む場所を固定する
   - `SKILLS.md` で既存の索引と表現の粒度を確認する
   - 近い既存 skill を 1〜2 本読む
   - `AGENTS.md` と `.github/copilot-instructions.md` で customization 境界を確認する
   - 対象領域に効く `.github/instructions/*.instructions.md` を確認する
   - 対象が広い時は repo memory や既存 plan doc を確認する

4. 1 本で作るか、先に計画書を書くか決める
   - 単一領域で粒度が見えているなら、そのまま `SKILL.md` を作る
   - 複数 skill を増やす、または対象が広いなら、先に docs 配下へ計画書を書く
   - unfamiliar な領域なら read-only subagent で探索する

5. skill の骨組みを固定する
   - folder 名と frontmatter の `name` を一致させる
   - frontmatter は最低でも `name`, `description`, `argument-hint` を入れる
   - body は原則として次の順にする
     - `When to Use`
     - `Default Stance`
     - `Repo-specific Facts`
     - `Procedure`
     - `Branching Guide`
     - `Guardrails`
     - `Stop And Clarify Only If`
     - `Good Prompts`

6. repo 固有情報に絞って書く
   - 正本ファイル
   - 固定の読む順
   - この repo で実際に踏みやすい罠
   - 最小の確認コマンド
   - 3〜5 本の実用 prompt 例
   - generic すぎる説明や、他 md と重複する mandatory rule は増やしすぎない

7. 索引を最小更新する
   - `SKILLS.md` に 2〜3 行の短い案内を足す
   - 案内は「何をするときに使うか」に絞る
   - 強制ルールや長い手順を `SKILLS.md` に移さない

8. 検証する
   - 新しい `SKILL.md` と `SKILLS.md` の markdown 診断を確認する
   - frontmatter の構文と `name` / folder 一致を確認する
   - 必要なら `npm run check:window` のような軽量チェックを回す
   - 複数 skill を作った時は見出し順と粒度が揃っているかも確認する

9. 最後に報告を固定する
   - なぜ skill 化したかを書く
   - どのファイルを追加・更新したかを書く
   - 実行した診断やチェック結果を書く
   - `01-rulebook.md` を更新したか必ず書く
   - 最後に専門用語を避けた短い説明を付ける

## Branching Guide

- 対象が 1 領域だけで、読む順も明確
  - 近い既存 skill を雛形にして、そのまま 1 本作る

- 複数領域の skill をまとめて追加したい
  - 先に plan doc を書き、順番と重複除去方針を決めてから作る

- 何を skill にするか自体が曖昧
  - 「毎回同じ手順か」「固定のテスト束があるか」でまず切る

- instruction / agent / skill のどれか迷う
  - 常時適用なら instruction、文脈隔離なら agent、都度呼ぶ手順なら skill

## Guardrails

- folder 名と frontmatter `name` をずらさない
- `description` は trigger 語を十分に入れる
- `SKILLS.md` を mandatory rule の正本にしない
- `.github/copilot-instructions.md` と `AGENTS.md` の意味差を広げない
- 広い対象を plan なしで一気に skill 化しない
- legacy の `prompts/*.agent.md` に戻さない

## Stop And Clarify Only If

- workspace 共有にするか個人用にするか決められない
- skill ではなく instruction / agent / prompt の方が適切に見える
- 対象領域が広すぎて、1 本の skill に収めるか分割するか判断できない
- 既存の未コミット変更と同じ customization ファイルで衝突している

## Good Prompts

- network 周りの修正手順が毎回同じなので、この repo 向けの workflow skill に切り出して
- 3 本まとめて skill を増やしたいので、先に計画書を作ってから順に実装して
- 既存 skill の説明が弱くて呼ばれにくいので、description と guardrail を repo 実態に合わせて直して
- instruction で持つべきか skill で持つべきか迷うので、この repo のルールに沿って切り分けて