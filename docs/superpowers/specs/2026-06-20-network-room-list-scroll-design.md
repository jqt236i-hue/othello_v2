# Network Room List Scroll Design

**Goal**

PC版ネット対戦ロビーで、部屋数が増えても `ルーム一覧` 枠の中だけを縦スクロールし、ヘッダーや外枠のレイアウトを崩さず全件閲覧できるようにする。

**Scope**

- 対象はPCレイアウトのネット対戦ロビー
- `ルーム一覧` のヘッダーは固定
- 部屋カード群だけを縦スクロール
- `html.layout-profile-phone-portrait` の現行挙動は維持

**Design**

1. `ui/handlers/match-mode.ts`
   - `#networkRoomListPanel` 配下に `#networkRoomListViewport` を追加する
   - `#networkRoomList` は viewport の子にして、ヘッダーとは分離する

2. `styles-layout-info.css`
   - `#networkRoomListPanel` を「ヘッダー + スクロール領域」の2段構成として維持する
   - `#networkRoomListViewport` に `min-height: 0` と `overflow-y: auto` を与え、PCでのみ一覧内部スクロールを担わせる
   - スクロールバーと右装飾の干渉を避けるために viewport 側の右余白を確保する
   - scrollbar styling は `#networkRoomListViewport` にも適用する

3. `styles-responsive.css`
   - `html.layout-profile-phone-portrait #networkRoomListViewport` は `overflow: visible` / `max-height: none` に戻し、スマホでは従来どおり縦に展開する

4. `01-rulebook.md`
   - PCロビーでは `ルーム一覧` をモーダル内スクロールで閲覧できることを追記する

**Verification**

- DOM回帰テスト:
  - `#networkRoomListViewport` が生成され、その子に `#networkRoomList` が入ること
- CSS契約テスト:
  - PC用 viewport に `overflow-y: auto`
  - phone portrait 用 override に `overflow: visible`

**Risk**

- 既存の装飾 pseudo-element とスクロール領域が重なる可能性がある
- 既存の room card グリッド幅を変えないことが重要

**Chosen Tradeoff**

`#networkRoomList` 自体を直接スクロールさせず、専用 viewport を1枚挟む。これによりヘッダー固定、装飾維持、モバイル分岐の局所化を同時に満たせる。
