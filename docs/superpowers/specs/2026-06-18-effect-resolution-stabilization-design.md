# Effect Resolution Stabilization Design

## 目的

`理論の化身`、配置直後効果、ターン開始特殊石、`救済神`、`BoardOps` の組み合わせで発生している不安定さを、個別パッチではなく構造的に減らす。

今回の対象は、プレイヤー向けルール変更ではなく内部解決経路の安定化である。`01-rulebook.md` と `正本/*.md` は、実装中に既存仕様と実装の不一致が見つかった場合だけ別途更新する。

## 背景

直近の障害では、`理論の化身` が生成した `破壊神` の即時破壊が `救済神` の復活処理に到達したとき、`BoardOps requires an injected deterministic PRNG.` で停止した。

根本原因は `破壊神` そのものではない。通常配置用の即時効果ディスパッチャと、理論召喚用の即時効果ディスパッチャが別々に存在し、PRNG や effect block metadata の渡し方が経路ごとに違っていたことが原因である。

既存コードで確認した主な危険箇所:

- `game/turn/action-phase/placement-immediate-effects.ts`: 通常配置直後効果の個別分岐
- `game/turn/theory-spawn-immediate-effects.ts`: 理論召喚直後効果の個別分岐
- `game/logic/cards.ts`: 各カード効果ラッパーで `random` / `randomSource` / options object を手作業変換
- `game/logic/board_ops.ts`: `救済神` の破壊ブロック後復活で PRNG を要求
- `game/logic/cards/*`: カードごとに `runEffectBlock` / `runDestroyBlock` / `runCellRemovalBlock` の使い方が微妙に違う

## 成功条件

- 通常配置と理論召喚が、同じ即時効果ディスパッチャを通る。
- 即時効果からカード効果へ渡すランダム源は内部的に `randomSource` へ正規化される。
- 既存カード API との互換が必要な箇所では、正規化済み `randomSource` から `random` も同時に供給する。
- `救済神` が盤面にいても、破壊系即時効果は `_defaultRandomSource` に依存せず、phase から渡された PRNG だけで完結する。
- `BoardOps` の fail-fast は維持し、`Math.random()` fallback は追加しない。
- headless 層に DOM、window、sound、network 依存を追加しない。
- 1コミットあたりの変更は小さく、失敗時に戻しやすい。

## 非目標

- カード効果の仕様変更
- `救済神` の復活ルール変更
- `理論の化身` の出現候補、演出時間、ロック挙動の変更
- Worker authority や network projection の再設計
- `game/logic/cards.ts` 全体の大規模分割
- 既存の unrelated UI/layout 変更との統合

## 設計

### 1. Immediate Effect Context

即時効果の入口で、次の形に正規化した context を作る。

```ts
type ImmediateEffectContext = {
  CardLogic: any;
  cardState: any;
  gameState: any;
  playerKey: 'black' | 'white';
  events: any[];
  row: number;
  col: number;
  typeKey: string;
  randomSource: { random(): number };
  source: 'placement' | 'theory_spawn';
  awardBoardChargeGain?: (
    CardLogic: any,
    cardState: any,
    playerKey: 'black' | 'white',
    amount: number,
    payload: any
  ) => void;
};
```

`randomSource` は必須にする。呼び出し元が持っていない場合は、即時効果ディスパッチャの入口で失敗させる。`BoardOps` の深い場所まで進んでから落ちるより、入口で原因を示す方が保守しやすい。

### 2. Immediate Effect Dispatcher

`game/turn/immediate-effect-dispatcher.ts` を追加し、通常配置と理論召喚の両方から呼ぶ。

責務:

- `typeKey` ごとに該当カード効果を呼ぶ
- `randomSource` を統一して渡す
- 既存カード関数の期待に合わせて `{ random: randomSource, randomSource }` を渡す
- `decrementRemainingOwnerTurns: false` を配置直後/理論召喚直後の効果に一貫して渡す
- `*_immediate` イベントを同じ規則で `events` に積む
- 盤面・カード状態・演出イベントは既存カード効果と `BoardOps` に任せる

呼び出し元:

- 通常配置: `game/turn/action-phase/placement-immediate-effects.ts`
- 理論召喚: `game/turn/theory-spawn-immediate-effects.ts` は互換 wrapper として残し、新 dispatcher に委譲する

### 3. PRNG 正規化

短期的には dispatcher 内で `randomSource` を正規化する。中期的には `game/logic/cards.ts` の anchor effect ラッパーへ `normalizeAnchorEffectOptions()` を追加する。

正規化後の内部ルール:

- 内部名は `randomSource`
- 既存カード module が `random` を読む場合だけ `random: randomSource` を渡す
- `runEffectBlock` / `runDestroyBlock` / `runCellRemovalBlock` の meta には必ず `randomSource` を渡す
- `_defaultRandomSource` は初期化・互換用であり、phase 実行中の正規経路では依存しない

### 4. 救済神と破壊ブロックの契約

`救済神` は「破壊処理に横断的に割り込む」ため、破壊系カード効果はすべて PRNG を要求しうるものとして扱う。

明示する契約:

- `BoardOps.destroyAt()` が直接呼ばれる場合、呼び出し元は `meta.randomSource` か active effect context の `randomSource` を用意する。
- `BoardOps.runEffectBlock()` / `runDestroyBlock()` を使う場合、block meta に `randomSource` を渡す。
- `BoardOps` は PRNG 不在を隠さない。

### 5. テスト戦略

最初に「現状を壊さずに構造を変えるための契約テスト」を追加する。

重点テスト:

- fake `CardLogic` を使い、dispatcher が各カードへ正しい options を渡すこと
- real `CardLogic` を使い、`_defaultRandomSource` を消しても `救済神 + 理論召喚 + 破壊系即時効果` が通ること
- 通常配置と理論召喚で同じ `*_immediate` イベントが出ること
- `runEffectBlock` / `runDestroyBlock` 後の `救済神` SPAWN が同じ effect block metadata を持つこと

## 実行手順

1. 作業前に `git status --short` を確認する。
2. unrelated dirty files が残っている場合、実装対象ファイルと衝突しない task だけ進める。
3. `public/module-registry.js` や `worker-public/*` が dirty のまま、新 runtime module 追加を伴う task は開始しない。
4. 各 task は red test → minimal implementation → focused verification → commit の順で進める。
5. `game/turn/immediate-effect-dispatcher.ts` 追加後は `npm run build:browser` を実行し、module registry を生成物として確認する。
6. browser-served root changes を反映する段階では `npm run worker:prepare` を実行する。
7. 失敗が unrelated なら、コマンドと最初の関連エラーを記録して次の task へ混ぜない。

## リスク

- `game/logic/cards.ts` のラッパー変更は広範囲に影響するため、dispatcher 統合より後に分ける。
- 新 module 追加は browser classic loader と worker mirror に波及するため、dirty registry/mirror が解消されてから行う。
- 一部カード module は `random` を期待し、一部は `randomSource` を期待する。完全統一は互換 adapter を置きながら段階的に進める。
- `救済神` が絡むテストは既存 UI/tag mismatch など unrelated failure と同時に落ちる可能性があるため、focused test を優先する。

## 完了判定

- `理論の化身` 経由と通常配置経由の即時効果が同じ dispatcher を使っている。
- `rg -n "process.*Immediate|resolveTheorySpawnImmediateEffects" game/turn` で分岐の重複が残っていない。
- `rg -n "decrementRemainingOwnerTurns: false" game/turn` で即時効果ごとの手作業分岐が dispatcher に集約されている。
- `_defaultRandomSource` を削った focused tests が通る。
- `npm run build:ts` が通る。
- 新 module を追加した場合、`npm run build:browser` と `npm run worker:prepare` が通る。

