# 完了報告: TypeScript移行完了宣言・残存JS許容リスト化

## 概要

TypeScript移行計画 `ts-migration-freeze-and-allowlist` を完了しました。

## 変更内容

### 1. 新規ドキュメント作成

**`docs/typescript-migration-js-allowlist.md`**
- 残存する425件の`.js`ファイルを正式に許容リスト化
- 4つのカテゴリに分類：
  - **dist-wrapper** (366件): TS正本への互換forwarding層
  - **generated** (4件): ビルド生成物
  - **legacy-implementation** (52件): Node.jsツール・デバッグスクリプト
  - **test-or-tooling** (3件): テストファイル
- unknown 52件の調査・再分類結果を詳細に記載
- 今後のガバナンスポリシー（新規JS追加ポリシー・監視ゲート・定期レビュー）を明記

### 2. 既存計画書更新

**`docs/plans/typescript-migration-completion-plan-2026-05-07.md`**
- 先頭に「完了済み（2026-05-08）」のステータスを追加
- 「11. 完了宣言と最終検証結果（2026-05-08）」セクションを新規追加
- 残課題R1-R4が解消済みであることを明記
- 完了定義のチェックリストを更新し、すべての項目が満たされていることを確認

## 検証結果

| 検証項目 | 結果 | 備考 |
|----------|------|------|
| `npm run typecheck` | ✅ PASS | 型検査に問題なし |
| `npm run checkall` | ✅ PASS | JS inventory gate含むすべてのチェック通過 |
| `npm run build:ts` | ❌ FAIL | **既存の技術的負債**（`.d.ts`ファイルの配置問題） |
| `game.guard-will.test.js` | ✅ 11/11 PASS | R1解消確認 |
| `game.position-swap-will.test.js` | ✅ 6/6 PASS | R2解消確認 |
| UI source-sibling `.js` import | ✅ 0件 | R3解消確認 |

### build:ts失敗について

`npm run build:ts` は以下のエラーで失敗しました：
```
error TS5055: Cannot write file '.../dist/game/logic/cards-internal/card-usage-prechecks.d.ts' because it would overwrite input file.
```

**これは今回の変更とは無関係の既存問題**です。`.d.ts` ファイルが `dist/` ディレクトリと同じ場所にあるため、TypeScriptコンパイラが出力先と入力先が衝突しています。今回の作業は文書化のみで、実装ファイルの変更は一切行っていません。

## 01-rulebook.md 更新状況

**更新なし**

理由: 今回の作業はビルド構成・型検査対象・JSファイルの扱いに関するインフラ整備であり、ゲーム仕様・カード効果・UI表示の変更は一切含まれないため。

## 今後の方針

1. **凍結状態の維持**: 新規のJS→TS移行作業は行わない
2. **監視ゲートの維持**: `npm run checkall` のJS inventory gateで新規legacy-implementation増殖を検出
3. **許容リストの管理**: `docs/typescript-migration-js-allowlist.md` を正本とし、四半期ごとの見直しを推奨
4. **build:tsの修正**: 別途、`.d.ts`ファイルの配置問題を解消する必要がある（本計画のスコープ外）

## コミット予定

1. `docs(ts-migration): investigate and reclassify unknown JS files`
2. `docs(ts-migration): add formal JS allowlist documentation`
3. `docs(ts-migration): update completion plan with final status`

---

**完了日時**: 2026-05-08
**基準コミット**: `efff49c`
