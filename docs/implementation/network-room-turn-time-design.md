# ネット対戦の部屋別持ち時間設定 設計

## 文書の役割

この文書は、ネット対戦の部屋作成設定で1手の持ち時間を変更できるようにするための実装設計です。プレイヤー向け仕様の正本は `01-rulebook.md`、ネットワーク境界の正本は `docs/architecture-contracts.md` です。この文書はそれらを置き換えません。

## 問題と目的

現在のネット対戦は全室で1手120秒に固定されています。部屋作成者が3〜1800秒の整数を指定し、同じ部屋の対局者・観戦者・再接続後の端末が同じ正式なタイマーを共有できるようにします。初期値は互換性のため120秒を維持します。

## 範囲

- 部屋作成設定へ「持ち時間（秒）」の数値欄を追加する。
- マウスホイールでは10秒ずつ増減し、クリック後は直接数値入力できるようにする。
- 入力値を3〜1800秒の整数へ正規化する。
- 部屋作成payloadからローカル対戦サーバーとWorkerへ伝え、部屋の正式な `turnTimer.limitSeconds` と期限計算に使用する。
- 参加・観戦・状態取得・SSE・再接続・再戦では、既存の公開 `turnTimer` 経路を通して同じ値を維持する。
- 仕様、テスト、ブラウザー成果物、Worker mirrorを同期する。

## 非対象

- 対局中に持ち時間を変更する機能。
- 秒読み、累積持ち時間、フィッシャー方式など別の時計ルール。
- レート対戦の固定設定変更。明示的な値を持たない既存・レート対戦は120秒のままとする。

## 現在の構造と根拠

- UIは `ui/handlers/match-mode/network-surface-template.ts` と `network-lobby-inputs.ts` が部屋作成設定の表示と入力を所有する。
- 作成値は `network-button-actions.ts` → `ui/network/session-lifecycle.ts` → `shared/match-entry-payload.ts` を通る。
- ローカル authority は `scripts/local-match-server.ts`、Worker authority は `workers/match-worker.ts` が部屋を生成する。
- 公開側はすでに `turnTimer.limitSeconds` をcreate/join/state/SSE等へ投影しているため、新しい並列メタデータは不要。
- 固定値は `shared/network-contract.ts` の120秒と、両authorityのタイマー生成処理で使用されている。

## 選択した設計

### 正規化の単一所有者

`shared/network-contract.ts` に既定値120、最小3、最大1800、ホイール刻み10と、整数へ正規化する関数を置きます。UI・payload・ローカルauthority・Worker authorityが同じ関数を使い、個別の範囲判定を増やしません。

有限な数値は切り捨て後に3〜1800へ収め、空欄や数値でない値は120へ戻します。直接入力では3秒など10の倍数でない値も有効です。ホイール操作だけが10秒刻みです。

### UI操作

HTMLの `input[type=number]` を使い、`min=3`、`max=1800`、`step=1`、初期値120とします。ホイールイベントは入力欄上でのみ捕捉し、現在値から上下10秒ずつ変更して画面スクロールを抑止します。`input` 中は入力途中を妨げず、`change` と部屋作成直前に正規化します。

### authorityと永続化

作成payloadの任意フィールド `turnTimeSeconds` を両authorityで正規化します。部屋の既存 `turnTimer.limitSeconds` を唯一の保存値とし、タイマー停止・開始・手番交代・再戦時の再生成処理はその値を読みます。フィールドがない古いクライアントや既存保存データは120秒へフォールバックします。

Workerのタイマーヘルパーは固定の初期設定値ではなく、各roomの現在の `turnTimer.limitSeconds` を正規化して期限を計算します。ローカルauthorityも同じ方式にします。これによりWorker/localの外部動作を一致させます。

## 互換性・失敗時の挙動

- フィールド省略時は従来どおり120秒。
- 不正・範囲外の値は共有正規化で安全な範囲へ収める。
- 既存roomデータに値がない場合も120秒。
- クライアント表示値はauthorityから返る `turnTimer` が正式であり、作成画面の一時入力を対局状態として扱わない。
- 秘密情報や席権限、状態version、operationId、presentation順序には変更を加えない。

## 検証方針

- 共有正規化と作成payloadのfocused Jest。
- UIで初期値、直接入力、上下限、ホイール10秒刻み、作成payloadを確認するfocused Jest。
- ローカルauthorityとWorkerで3秒・1800秒・省略時120秒、期限差、公開timerを確認するfocused Jest。
- 型検査、TypeScript build、network parity、browser build、Worker prepare/mirror/bundle smoke。
- 実ブラウザーで設定欄と作成操作を確認し、8000番の正規サーバーを維持する。

## リスクと対策

- タイマー再生成で120秒へ戻るリスク: 開始・停止・継続の全経路がroom保存値を読むテストを追加する。
- Worker/local差異: 同じ共有正規化を使い、両方の作成テストとparity bundleを実行する。
- ホイールでページが動くリスク: 入力欄上で有効なdeltaを処理した場合だけ `preventDefault()` する。
- 小さな画面で設定popupが縦に収まらないリスク: 既存gridへ1行追加し、必要な最大高さとoverflowを設定して確認する。

## 完了条件

- 3〜1800秒の整数を直接入力できる。
- 入力欄上のホイールで10秒ずつ変わり、3と1800を越えない。
- 初期値と未指定時は120秒。
- 作成したroomで両authorityが同じ秒数の期限を作り、全viewerへ同じ公開値を返す。
- 手番交代・再接続・再戦で設定が120秒へ戻らない。
- 仕様、source、tests、browser成果物、Worker mirrorが同期し、必要な検証が通る。

## Self-review

初稿ではroomへ別の `turnTimeSeconds` メタデータも保存する案を検討しましたが、既存の公開・永続化契約である `turnTimer.limitSeconds` と二重管理になるため採用しませんでした。直接入力を10の倍数へ丸めると「3秒から」の要件を損なうため、10秒刻みはホイール操作だけに限定しました。既存クライアント・レート対戦への互換性、再戦時の保持、Worker/local parity、狭い画面のpopupを検証対象へ追加し、要求とauthority境界を満たす設計になっています。
