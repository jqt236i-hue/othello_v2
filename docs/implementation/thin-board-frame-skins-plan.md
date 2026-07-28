# 極細盤面フレームスキン追加 実装計画

## 文書の役割

- 対象設計: `docs/implementation/thin-board-frame-skins-design.md`
- 目的: 生成済み5案を、既存の盤面フレームスキン経路へ正式採用し、検証・生成・コミットまで完了する。
- 非目標: 盤面renderer、保存形式、ネットワーク仕様、既定スキンの変更。

## 実装手順

### 1. 生成素材を正式パスへ昇格する

- 対象:
  - `assets/images/board/frame-skin-candidates/*.png`
  - `assets/images/board/board-frame-thin-*-v1.png`
- 依存: なし。
- 実施:
  - 5枚を候補用パスから安定したroot素材名へ移動する。
  - 1254x1254、中央透過、四隅透過を再確認する。
- 検証:
  - 画像寸法とアルファ値の検査。
- 完了条件:
  - 候補用パスがroot正本から消え、5つの正式画像が存在する。

### 2. 正本カタログとプレイヤー向け仕様を更新する

- 対象:
  - `ui/board-skin/catalog.ts`
  - `01-rulebook.md`
- 依存: 手順1。
- 実施:
  - 5件のID、表示名、説明、画像パス、layoutを `BASE_BOARD_FRAME_SKINS` へ追加する。
  - 初期所持一覧へ同じ5件を追加する。
- 検証:
  - source inspection、TypeScript build。
- 完了条件:
  - 実装と仕様のID・表示名・画像パスが一致し、既定IDが変わっていない。

### 3. focused coverageを拡張する

- 対象:
  - `test/ui.board-skin-controller.test.ts`
- 依存: 手順2。
- 実施:
  - カタログ順、表示名、5件すべての選択・保存・CSS適用、layout、PNG透過を検証する。
- 検証:
  - `npx jest --runInBand --runTestsByPath test/ui.board-skin-controller.test.ts`
- 完了条件:
  - 新しい5件に対するfocused testが成功する。

### 4. ブラウザ生成物と配布mirrorを更新する

- 対象:
  - browser生成物
  - `worker-public/` mirror
- 依存: 手順3。
- 実施:
  - `npm run build:browser`
  - `npm run build:vite`
  - `npm run worker:prepare`
  - `npm run check:worker-mirror`
- 検証:
  - コマンド成功と、root/workerの5画像ハッシュ一致。
- 完了条件:
  - classic/Vite/Worker配布経路が新しいカタログと画像を参照できる。

### 5. 実機で5種類を確認する

- 対象:
  - ローカルブラウザの `SKIN > 盤面フレーム`
- 依存: 手順4。
- 実施:
  - 5件の選択肢を順に選ぶ。
  - 画像ロード、表示名、選択状態、盤面との境界、外周透過、過度な盤面被覆がないことを確認する。
  - 必要ならカタログlayout値だけを修正し、手順3〜5を再実行する。
- 検証:
  - DOM属性/CSS画像パスとスクリーンショット目視。
- 完了条件:
  - 5種類がプレイヤー操作で問題なく切り替わる。

### 6. 最終差分を分離してコミットする

- 対象:
  - 今回の素材、catalog、test、rulebook hunk、設計・計画、分離可能な生成物。
- 依存: 手順1〜5。
- 実施:
  - `git diff --check`
  - task-owned diffと既存WIPを分類する。
  - 既存WIPを含めず、今回のhunkだけをステージする。
  - coherent commitを作成する。
- 完了条件:
  - タスク所有変更がコミットされ、既存の別作業は未変更・未ステージで残る。

## 完了チェックリスト

- [x] 5つの正式画像がroot正本に存在する
- [x] 5つのカタログ項目と表示名が存在する
- [x] 5つすべての選択・保存・画像適用がテストされる
- [x] 画像別layoutが検証される
- [x] `01-rulebook.md` が実装と一致する
- [x] focused Jestが成功する
- [x] `npm run build:browser` が成功する
- [x] `npm run build:vite` が成功する
- [x] Worker mirror生成・確認が成功する
- [x] ブラウザで5つを操作確認する
- [x] 最終diffに意図しないtask-owned変更がない
- [x] タスク所有変更がコミットされる

## Self-review

- 正本から生成物、focused test、実機確認の順に並べ、生成物の先行編集を避けた。
- 5種類すべてを検証対象にし、「カタログに追加しただけ」で終わらない完了条件へ修正した。
- 既存の大規模な未コミット変更があるため、rulebookと生成物の部分ステージを明示した。
- layout調整が必要な場合はカタログ値だけを戻り先にし、runtimeやCSSへ場当たり的な分岐を追加しない計画とした。
