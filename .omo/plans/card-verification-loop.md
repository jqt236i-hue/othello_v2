# カードオセロ 全カード自律検証・修正・回帰テスト完遂プロンプト

## 0. 目的

あなたは Sisyphus として、カードオセロの全カード挙動を自律的に検証し、不具合を発見した場合は根本原因を特定して修正し、修正後に回帰確認と再現可能なテストを残してください。

この作業の目的は、単なる目視確認ではありません。

目的は以下です。

1. `cards/catalog.json` に定義された有効カードすべてについて、仕様通りに動くことを確認する
2. `01-rulebook.md`、`cards/catalog.json`、実装、テストの不一致を解消する
3. ローカル / CPU 対戦だけでなく、ネット対戦でもカード効果が破綻しないことを確認する
4. Playwright または Jest で再現可能な検証シナリオを残す
5. 途中で中断しても状態ファイルから再開できるようにする

このプロンプトは、自律的に最後まで進めるための作業指示です。
曖昧なまま推測で進めず、仕様・実装・テスト・実機結果を照合して判断してください。

---

## 1. 絶対に守る正本順位

仕様や実装判断で迷った場合は、以下の順で正本を扱ってください。

1. `01-rulebook.md`
   - ゲームルール、カード挙動、UI/演出仕様の一次情報
2. `cards/catalog.json`
   - カードID、カード名、type、cost、desc_ja、enabled 状態の一次情報
3. `docs/architecture-contracts.md`
   - game / ui / worker / shared / network / authority / pending / playback などの内部契約
4. `AGENTS.md`
   - このリポジトリでの読み順、直し方、確認順
5. 実装ファイル
6. 既存テスト

`01-rulebook.md` と実装が矛盾している場合は、原則として実装を修正してください。
ただし、実装変更がプレイヤーに見える挙動変更になる場合は、`01-rulebook.md` と `cards/catalog.json` の更新要否も判断してください。

---

## 2. 完了条件

以下のすべてを満たした場合のみ「完了」と宣言してください。

1. `cards/catalog.json` から `enabled: false` を除いた全カードを機械的に列挙し、全カードを検証した
2. 各カードについて、`01-rulebook.md` の仕様、`cards/catalog.json` の定義、実装、実機挙動が一致している
3. 各カードについて、黒側が使用した場合と白側が使用した場合の両方を確認した
4. 各カードについて、カード使用後も配置、反転、手番交代、終局までの進行が破綻しないことを確認した
5. 検証中に発見した不具合をすべて修正した
6. 修正後、対象カードだけでなく、既確認カードが壊れていないことを必要範囲で再確認した
7. Playwright または Jest で、カード挙動を再現可能な形でテスト化した
8. ローカル / CPU 対戦だけでなく、ネット対戦で破綻しやすいカード群を検証した
9. `npm run typecheck` が通る
10. `npm run test:jest` が通る
11. network / worker / mirror に影響した場合は、必要に応じて `npm run test:network:parity` と `npm run worker:prepare` も通る
12. `01-rulebook.md`、`cards/catalog.json`、実装、テストの間に未解決の矛盾が残っていない
13. `blocked` または `保留` のカードが1枚も残っていない

重要:
- スキップや保留は完了扱いしない
- blocked カードが残っている場合は「未完了」として報告する
- 「見た目上動いたように見える」だけでは完了扱いしない

---

## 3. 検証対象リストの作り方

手書きのカード一覧を正本にしてはいけません。

必ず `cards/catalog.json` を読み、以下の条件で検証対象カード一覧を生成してください。

- `cards[*].enabled === false` のカードは通常検証対象から除外
- `enabled` が未定義、または `true` のカードは有効カードとして扱う
- 各カードについて以下を記録する
  - id
  - type
  - name_ja
  - cost
  - desc_ja
  - display_type_ja
  - enabled 状態
  - 対応する `01-rulebook.md` の節
  - 対応する実装ファイル
  - 対応する既存テスト

最初に `verification-targets.json` を作成または更新してください。

例:

```json
{
  "generatedAt": "ISO_TIMESTAMP",
  "source": "cards/catalog.json",
  "totalCards": 0,
  "enabledCards": [],
  "disabledCards": [],
  "mismatches": []
}