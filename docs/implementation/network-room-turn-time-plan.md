# ネット対戦の部屋別持ち時間設定 実装計画

## 文書の役割

`docs/implementation/network-room-turn-time-design.md` を実行するための計画です。仕様正本は `01-rulebook.md`、ネットワーク境界の正本は `docs/architecture-contracts.md` です。

## 手順

1. **仕様と共有契約を更新する**（完了）
   - 対象: `01-rulebook.md`, `shared/network-contract.ts`, `shared/match-entry-payload.ts`。
   - 依存: なし。
   - 検証: 共有契約・entry payloadのfocused Jest。
   - 完了条件: 3〜1800、既定120、UIホイール刻み10、任意create fieldの規則が単一の共有実装で表現される。

2. **部屋作成UIを実装する**（完了）
   - 対象: network surface template、match-mode refs、lobby input binding、button action、CSS、bootstrap types/refs。
   - 依存: 手順1の共有正規化。
   - 検証: `ui.match-mode.network-button`、surface/styleテスト。
   - 完了条件: 直接入力、ホイール10秒刻み、上下限、初期120、create payloadが確認できる。

3. **ローカルauthorityへ実装する**（完了）
   - 対象: `scripts/local-match-server.ts` と関連テスト。
   - 依存: 手順1。
   - 検証: local lobby/turn-timer focused Jest。
   - 完了条件: 作成値がroom timerに保存され、開始・停止・手番交代・公開で維持される。

4. **Worker authorityへ実装する**（完了）
   - 対象: Worker create/types/turn-timer helperと関連テスト。
   - 依存: 手順1。
   - 検証: Worker turn-timer/create focused Jest。
   - 完了条件: public create → internal create → persisted room → alarm deadlineが同じ設定を使う。

5. **統合・生成・実操作を検証する**（完了。実ブラウザー操作のみ環境制約で未実施）
   - 対象: browser build、Worker mirror、実ブラウザー。
   - 依存: 手順2〜4。
   - 検証: typecheck、build:ts、network parity、build:browser、worker:prepare、check:worker-mirror、worker:bundle:smoke、8000番のclassic UI操作。
   - 完了条件: ローカル/Worker/browserの契約が一致し、生成物が最新で、実画面から設定できる。

6. **最終レビュー・修正・コミット**（完了）
   - 対象: task-owned diff、status、設計・計画の実績欄。
   - 依存: 手順5。
   - 検証: 分離した主担当の第二レビュー、修正後の該当検証、`git diff --check`。
   - 完了条件: 重要な未解決指摘がなく、今回のファイルだけをコミットする。

## 完了チェックリスト

- [x] 仕様正本を更新した。
- [x] UIの2方式と範囲を実装した。
- [x] create payloadと両authorityを同期した。
- [x] 省略時120秒と旧room互換を維持した。
- [x] 再接続・再戦を含むtimer保持を確認した。
- [x] focused/parity/type/build/mirror/smoke検証を完了した。
- [ ] 実ブラウザー操作を完了した（管理ポリシー確認が利用できず未実施）。
- [x] 最終diffとstatusを確認し、無関係ファイルを含めなかった。
- [x] 独立レビュー相当の第二レビューと必要な修正を完了した。
- [x] task-owned diffをコミットした。

## Self-review

設計からcanonical source → UI → local authority → Worker authority → generated outputsの順に分解しました。各手順に客観的な完了条件を置き、直接入力とホイール操作、古いクライアント、再戦時の保持、Worker/local parity、実画面確認を漏れなく含めています。生成物をsourceより先に触る手順や、仕様だけで実装完了とする手順はありません。

## Final independent review

サブエージェントを使わず、実装作業から切り離した第二レビューを行いました。次の3点を発見して修正しました。

- 空欄が下限3秒として扱われていたため、既定120秒へ戻すよう共有正規化を修正した。
- UI内にホイール刻み10秒が重複していたため、共有定数を参照するよう修正した。
- 設定した3秒がタイムアウト後の次手番にも維持される証拠が弱かったため、Workerの手番遷移テストを3秒設定へ変更し、次の締切が3000msになることを確認した。

修正後、focused 5 suites / 53 tests、network parity 36 suites / 585 tests、typecheck、browser build、Worker mirror、Worker bundle smokeをすべて通過しました。`worker:prepare` は初回のみ `index.html` の一時的なファイル使用中エラーで失敗し、サーバーを止めずに再実行して成功しました。`http://127.0.0.1:8000/` はHTTP 200で、同リポジトリのplay serverが稼働しています。

実ブラウザー操作は、アプリの管理ポリシー確認が利用できず起動できなかったため未実施です。UI操作はJSDOMテストで、直接入力、ホイール10秒増減、3秒・1800秒の上下限、create payloadへの反映まで確認しています。
