# 盤理の観測者 実装設計

## 目的

`盤理の観測者` (`observer_will_01`, `OBSERVER_WILL`) を、特殊カード基盤の上に実装する。カード使用直後に相手手札から1枚を奪い、その後に次配置石を5T絶対保護の観測石へ変える。観測石が盤面にある間は相手手札を常時表表示し、観測石が持続終了で消滅した所有者ターン開始時に奪ったカードに対する初回返済を開始する。

この設計では、使用直後の選択を既存の `HEAVEN_BLESSING` / `CONDEMN_WILL` 系 pending selection に寄せ、5T後に突然UI選択を発生させる複雑さを避ける。

## 確定仕様

- カード名: 盤理の観測者
- cardId: `observer_will_01`
- type / marker type: `OBSERVER_WILL`
- コスト: 0
- 使用条件: 18手以上経過後
- 使用時: 相手手札選択 overlay を即表示する。
- 選択時:
  - 相手手札から1枚を選ぶ。
  - 選んだカードを相手手札から取り除き、自分手札に加える。
  - 加えたカードは0コスト扱いにする。
  - 観測済みになった相手手札カードはカードcopyごとに1回だけコスト+5扱いにする。奪ったカードは0コストになり、観測者による+5は残らない。特殊カードは観測で表表示にはなるが、特殊カード不可侵によりコスト+5は受けない。
  - 奪ったカードの元コスト20%を返済額として記録する。
  - 次に置く自石を観測石にする予約を作る。
- 観測石:
  - 次の自分の配置石として出る。
  - 5T持続。
  - 絶対保護。
  - 盤面にある間、相手手札を常時表表示する。
  - 持続終了時は通常石に戻る。
- 返済:
  - 観測石が持続終了で消滅した所有者ターン開始時に初回返済も同時に発生する。
  - 最大9回。
  - 各回、奪ったカードの元コスト20%分の布石を失う。
  - 布石が足りない場合、その回は自石をランダム4個破壊する。

## 推奨アーキテクチャ

### カード使用と選択

`OBSERVER_WILL` は新規 card type として追加する。使用時は `CONDEMN_WILL` と同じく相手手札の `offers: [{ handIndex, cardId }]` を作り、`HEAVEN_BLESSING` / `CONDEMN_WILL` と同じ overlay UI を使う。

選択 action は `observerWillTargetIndex` のような専用フィールドにする。`condemnTargetIndex` を流用すると、破壊カードと奪取カードの意味が混ざり、CPU・Worker sanitize・playback の読み間違いが起きやすい。

### コスト変更

カード個体単位のコスト変更が必要なので、手札 copyId を使った cost override / modifier ledger を追加する。奪ったカードはその copyId を0コスト override にし、未選択カードは同じく copyId 単位で+5 modifier を付ける。

この方式なら、同じ cardId が複数枚ある場合でも変更対象が曖昧にならない。手札を離れた後も効果を維持するかは、既存の `REVEAL_HAND_WILL` が copyId で公開状態を追う設計と揃える。

### 観測石予約

選択完了後に「次配置石を `OBSERVER_WILL` にする」pending marker 予約を cardState に置く。実際の石生成は配置処理で行い、game/headless 側の canonical state とする。

観測石 marker には次を持たせる。

- `type: 'OBSERVER_WILL'`
- `owner`
- `remainingOwnerTurns: 5`
- `absoluteProtected: true`
- `visualEffectKey: 'observerWillStone'`
- 返済予約IDまたは返済 entry 参照

### 常時手札公開

既存の `REVEAL_HAND_WILL` は「使用時点の手札 copyId を公開する」効果なので、そのまま常時公開へ流用しない。`utils/match-authority.ts` の `projectSnapshotForViewer` に、`OBSERVER_WILL` marker が盤面にある間だけ observer owner へ相手手札を全表示する判定を追加する。

CPU/ローカル表示でも同じ headless 判定を参照し、UIだけで相手手札を見せる状態を作らない。

### 返済

既存の `RIBO_WILL` は `riboRepaymentsByPlayer` と turn-start 処理を持つ。これを直接詰め込むより、返済 entry の種類を識別できる形に拡張する。

推奨 entry 形:

```ts
{
  sourceType: 'OBSERVER_WILL',
  status: 'waiting_for_marker_expire' | 'active',
  markerId: string | number,
  stolenCardId: string,
  stolenCardCopyId: number,
  originalCost: number,
  repaymentAmount: number,
  remainingOwnerTurns: 9,
  shortageDestroyCount: 4
}
```

観測石が duration end で通常石に戻った時点で `status` を `active` に変える。返済処理自体は `RIBO_WILL` と同じ turn-start anchor で処理し、イベント名は `observer_will_repaid` / `observer_will_shortage` のように分ける。

## 既存ロジック流用

- `HEAVEN_BLESSING`: overlay 表示、候補カード表示、選択決定UI。
- `CONDEMN_WILL`: 相手手札 offers、handIndex selection、ネットワーク投影、CPU target selection。
- `REVEAL_HAND_WILL`: hand copyId と hidden token の考え方。ただし常時公開処理そのものは marker 条件の projection で新規実装する。
- `RIBO_WILL`: turn-start 返済、布石不足時のランダム自石破壊、返済 summary / playback の構造。
- 特殊カード基盤: `OBSERVER_WILL` marker metadata、絶対保護、visual key、特殊カードのデッキ制約。

## UI / Network

選択 overlay は既存の天の恵み系 overlay に `OBSERVER_WILL` case を追加する。表示対象は相手手札で、カード選択後に即 action publish する。ネットワーク対戦では Worker snapshot を authority とし、UIローカルで相手手札の正体を作らない。

公開状態は snapshot projection で制御する。観測石 owner の seat には相手手札が実カードIDで届き、相手や観戦者には通常どおり hidden token が届く。

## CPU

CPU は以下を追加する。

- 18手以上経過後のみ使用候補に入れる。
- 相手手札が空なら使用しない。
- 選択対象は、コスト・脅威度・保持価値が高いカードを優先する。初期実装では `CONDEMN_WILL` の target scoring を流用し、破壊ではなく奪取価値として評価する。
- 観測石配置予約がある場合、通常の配置評価を使いながら、破壊されにくい位置や返済開始まで維持しやすい位置をやや優先する。

## テスト方針

- catalog: `observer_will_01` が0コスト、18手条件、特殊カード制約対象として存在する。
- usage: 18手未満では使えず、18手以上で相手手札 offers pending が作られる。
- selection: 選択カードが相手手札から自分手札へ移り、0コスト化され、未選択カードが+5される。
- placement: 選択後の次配置石が `OBSERVER_WILL` marker になる。
- marker: 5T絶対保護で、duration end で通常石に戻る。
- reveal: marker がある間だけ owner から相手手札が見え、marker 消滅後は通常の hidden projection に戻る。
- repayment: marker が持続終了で消滅した所有者ターン開始時から9回返済し、布石不足時は自石4個破壊する。
- network: Worker projection で observer owner だけに相手手札を公開し、hidden token を canonical state に混ぜない。
- CPU: 使用条件、target selection、pending selection action が成立する。
- worker mirror: catalog / shared / game / UI 変更後に `npm run worker:prepare` が通る。

## 実装順

1. `01-rulebook.md` と catalog に `盤理の観測者` を追加し、generated catalog を更新する。
2. `OBSERVER_WILL` の usage precheck と pending selection を追加する。
3. overlay / pending selection action / network publish を `observerWillTargetIndex` で接続する。
4. hand copyId 単位の cost override / modifier ledger を追加する。
5. 選択解決でカード奪取、0コスト化、未選択+5、観測石予約、返済予約を作る。
6. 配置処理で観測石 marker を付与する。
7. marker duration end で通常石復帰と返済 active 化を行う。
8. snapshot projection に観測石による相手手札常時公開を追加する。
9. CPU と focused tests を追加する。
10. `worker:prepare` で mirror を同期する。

## スコープ外

- `理論の化身` と `盤界の執行者` の本体効果実装。
- 観測石消滅時に相手手札選択UIを出す旧案。
- 奪ったカードの個別UI演出を新規作成すること。初期実装は既存の hand add/remove playback を使う。
