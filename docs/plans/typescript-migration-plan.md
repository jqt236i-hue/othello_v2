# TypeScript移行計画書

## 1. 現状分析

| 項目 | 数値 |
|------|------|
| JavaScriptファイル総数 | 882ファイル |
| 総コード行数 | 448,187行 |
| 主要ディレクトリ | game(60k行), ui(39k行), test(89k行), scripts(23k行) |
| 既存TypeScript設定 | なし（tsconfig.jsonなし、.d.tsなし） |
| モジュールシステム | UMD/IIFE混在（ブラウザ/Node両対応） |

### 1.1 技術的制約
- ブラウザとNode.jsの両方で動作する必要がある
- UMDパターンでグローバル変数を使用している箇所が多数
- Jestテストが89k行あり、移行時の回帰テストが重要

## 2. 移行戦略

### 2.1 基本方針
**「完璧な移行」を目指し、以下を厳守する：**

1. **型安全性の完全確保**: `strict: true` で運用
2. **段階的移行**: 依存関係の少ない層から順に移行
3. **互換性維持**: 既存機能を一切損なわない
4. **テスト駆動**: 各フェーズで全テストを実行し合格を確認
5. **ビルド自動化**: tsc + 既存ツールチェインの統合

### 2.2 移行順序（依存関係の少ない順）
```
shared/ → game/cards/effects/ → game/logic/ → ui/ → workers/ → scripts/ → test/
```

## 3. フェーズ詳細

### Phase 1: 基盤構築（1-2日）
**目標**: TypeScriptコンパイラと型システムの導入

#### タスク
- [ ] `typescript` のインストール（devDependencies）
- [ ] `tsconfig.json` の作成（strict: true, esModuleInterop: true）
- [ ] `@types/*` 必要パッケージのインストール
- [ ] 既存 `.js` ファイルを `.ts` にリネームするビルドスクリプト作成
- [ ] `allowJs: true` で段階的移行の土台を構築

#### 完了条件
- `npx tsc --noEmit` がエラーなく実行できる
- 既存の `npm run checkall` が引き続きPASS

### Phase 2: 共有型定義の作成（2-3日）
**目標**: すべてのドメイン型を定義

#### タスク
- [ ] `src/types/` ディレクトリ作成
- [ ] ゲーム状態型（GameState, CardState）
- [ ] プレイヤー型（PlayerKey, PlayerValue）
- [ ] カード定義型（CardDef, CardType）
- [ ] マーカー/特殊石型
- [ ] イベント/プレゼンテーション型
- [ ] 盤面操作型（BoardConfig, CellPosition）

#### 完了条件
- すべての主要データ構造に型定義が存在
- `shared/` 層のファイルが新しい型定義をimportできる

### Phase 3: shared層の移行（3-4日）
**目標**: 依存関係の根元をTypeScript化

#### 対象ファイル
- `shared-constants.js` → `shared-constants.ts`
- `shared/*.js` → `shared/*.ts`
- `shared/**/*.js` → `shared/**/*.ts`

#### タスク
- [ ] 各ファイルを `.ts` にリネーム
- [ ] 関数シグネチャに型注釈を追加
- [ ] 定数/列挙型を `const enum` または `as const` に変換
- [ ] インターフェースの抽出

#### 完了条件
- `shared/` 以下のすべてのファイルが `.ts`
- 該当テストがすべてPASS
- `npm run checkall` PASS

### Phase 4: game/cards/effects/ の移行（5-7日）
**目標**: カード効果システムを完全に型付け

#### 対象
- `game/cards/effects/*.js`
- `game/cards/*.js`
- `game/logic/cards.js`（分割済みの部分）

#### タスク
- [ ] 効果関数のdepsパラメータに型を付与
- [ ] 戻り値型（Result型）の統一
- [ ] エフェクトリゾルバーの型付け
- [ ] カード状態マネージャーの型付け

#### 完了条件
- すべてのカード効果関数に完全な型注釈
- 既存のカード効果テストがすべてPASS

### Phase 5: game/logic/ の移行（5-7日）
**目標**: コアゲームロジックの型安全性確保

#### 対象
- `game/logic/*.js`
- `game/turn/*.js`
- `game/ai/*.js`

#### タスク
- [ ] 盤面操作関数の型付け
- [ ] ターンマネージャーの型付け
- [ ] CPU意思決定ロジックの型付け
- [ ] イベントシステムの型付け

#### 完了条件
- ゲーム進行に関する主要関数が型安全
- E2EテストがPASS

### Phase 6: ui/ 層の移行（7-10日）
**目標**: UI層の型安全性確保

#### 対象
- `ui/*.js`
- `ui/**/*.js`

#### タスク
- [ ] DOMイベントハンドラの型付け
- [ ] アニメーションシステムの型付け
- [ ] ネットワーククライアントの型付け
- [ ] グローバル変数（window.*）の型宣言

#### 注意点
- ブラウザAPI（document, window）の型定義
- 既存グローバル変数との整合性

#### 完了条件
- UIイベントが正しく型付けされている
- ブラウザでの手動テストで機能が正常

### Phase 7: workers/ と scripts/ の移行（3-5日）
**目標**: バックエンド・ビルドツールの型付け

#### 対象
- `workers/*.mjs`
- `scripts/*.js`

#### タスク
- [ ] Cloudflare Workers用の型定義
- [ ] ビルドスクリプトの型付け
- [ ] 生成スクリプトの型付け

#### 完了条件
- `wrangler dev` が正常に動作
- `npm run worker:prepare` が正常に動作

### Phase 8: test/ の移行（5-7日）
**目標**: テストコードの型安全性確保

#### 対象
- `test/**/*.js`
- `tests/**/*.js`

#### タスク
- [ ] Jest用の型定義設定
- [ ] テストヘルパーの型付け
- [ ] モックオブジェクトの型付け

#### 完了条件
- `npm test` がすべてPASS
- テストカバレッジが移行前と同等以上

### Phase 9: 最終検証・リファクタ（3-4日）
**目標**: コード品質の向上と型安全性の完全確保

#### タスク
- [ ] `any` の使用箇所を洗い出し、適切な型に置き換え
- [ ] 未使用コード/インポートの削除
- [ ] 型エイリアスの統一（命名規則の見直し）
- [ ] ドキュメントの更新（型定義を含む）

#### 完了条件
- `any` の使用率が5%以下
- `npm run checkall` PASS
- `npm test` PASS
- ブラウザで手動テストで機能が正常

## 4. ツール・設定

### 4.1 package.json 変更
```json
{
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/node": "^20.0.0",
    "ts-jest": "^29.1.0"
  }
}
```

### 4.2 tsconfig.json（案）
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020", "DOM"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "allowJs": true,
    "checkJs": false,
    "moduleResolution": "node",
    "resolveJsonModule": true
  },
  "include": ["src/**/*", "game/**/*", "ui/**/*", "shared/**/*", "workers/**/*", "scripts/**/*"],
  "exclude": ["node_modules", "worker-public", "coverage", "dist"]
}
```

### 4.3 Jest設定変更
```json
{
  "transform": {
    "^.+\\.ts$": "ts-jest"
  },
  "testMatch": ["**/*.test.(js|ts)"],
  "moduleFileExtensions": ["ts", "js"]
}
```

## 5. リスクと対策

| リスク | 対策 |
|--------|------|
| 移行中に機能が壊れる | 各フェーズで全テスト実行を必須化 |
| UMDパターンとの衝突 | `allowJs: true` で段階的に移行 |
| グローバル変数の型付け | `.d.ts` 宣言ファイルで対応 |
| 工数が膨れ上がる | フェーズごとに完了条件を明確化 |
| ブラウザ/Node互換性 | 両環境でビルドテストを実行 |

## 6. 完了定義

### 必須条件
- [ ] すべての `.js` ファイルが `.ts` に移行完了
- [ ] `strict: true` でコンパイルエラーがゼロ
- [ ] `npm run checkall` PASS
- [ ] `npm test` PASS（テスト数が移行前と同等以上）
- [ ] ブラウザで手動テストが正常
- [ ] `wrangler deploy` が正常に完了

### 品質基準
- [ ] `any` の使用率が5%以下
- [ ] 公開API（関数・クラス）にJSDoc/型注釈が100%付与
- [ ] 型定義ファイル（.d.ts）が適切に生成されている

## 7. スケジュール見積もり

| フェーズ | 工数 | 累計 |
|----------|------|------|
| Phase 1: 基盤構築 | 1-2日 | 2日 |
| Phase 2: 型定義作成 | 2-3日 | 5日 |
| Phase 3: shared層移行 | 3-4日 | 9日 |
| Phase 4: game/cards移行 | 5-7日 | 16日 |
| Phase 5: game/logic移行 | 5-7日 | 23日 |
| Phase 6: ui層移行 | 7-10日 | 33日 |
| Phase 7: workers/scripts | 3-5日 | 38日 |
| Phase 8: test移行 | 5-7日 | 45日 |
| Phase 9: 最終検証 | 3-4日 | **49日** |

**総工数見積もり: 約50日（フルタイム換算）**

## 8. 次のステップ

Phase 1の基盤構築から着手します。まず `typescript` のインストールと `tsconfig.json` の作成を行います。