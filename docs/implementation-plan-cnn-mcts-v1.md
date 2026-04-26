# カードオセロAI学習システム 統合改善実装計画書

**バージョン**: 1.0  
**作成日**: 2026-04-27  
**対象**: カードオセロ Lv6 CPU ONNX学習パイプライン  
**目標**: Deep Research報告書「Gumbel AlphaZero + WDLヘッド + SPRT評価ゲート + 2層MCTS」統合アプローチの完全実装

---

## 1. エグゼクティブサマリー

本計画書は、ディープリサーチエージェントによる横断調査の結果を統合し、カードオセロAI学習システムの全体的な改善を3フェーズに分けて段階的に実装するロードマップを示す。

**最終目標**: ブラウザ環境で動作する軽量CNNモデル（MCTS併用）として、既存のMLPベースシステムから完全に移行し、AlphaZero系の最新技術を取り入れた次世代学習パイプラインを構築する。

**3つのフェーズ**:
- **Phase 1**: モデル構造・学習戦略の基礎改善（即座に着手可能）
- **Phase 2**: MCTS・評価ゲート・多様性確保の中核強化（中期的）
- **Phase 3**: アーキテクチャの革新的変更・計算効率最大化（長期的）

---

## 2. 前提条件・制約

### 2.1 技術制約
- **ブラウザ推論**: onnxruntime-web（WASM/WebGPU）、1ターンあたりの推論時間制約あり
- **モデルサイズ**: ブラウザダウンロード・メモリ制約を考慮（目標: 10MB以下）
- **Python環境**: PyTorch + ONNX変換パイプライン（現状維持）
- **Node.js環境**: 自己対局生成・評価（現状維持）

### 2.2 学習制約
- **1イテレーション時間**: 1時間以内を目標（現状の中間案A基準）
- **自己対局数**: 4,000〜12,000ゲーム/イテレーション
- **評価ゲート時間**: 30分以内

### 2.3 依存関係
```
PyTorch 2.0+
ONNX 1.14+
onnxruntime-web 1.16+
Node.js 18+
```

---

## 3. Phase 1: 基礎改善（即座に着手可能）

**目標期間**: 2〜3週間  
**優先度**: 🔴 Critical  
**前提**: 既存のCNN+ResNet基盤（train_policy_onnx_v2.py）を拡張

### 3.1 手札情報の明示的エンコーディング

**現状の問題**:
- 現在のauxiliary vector（16次元）には手札内容が含まれていない
- Hearthstone AI研究で手札除去により53%の相対精度低下が確認されている

**実装内容**:

#### 3.1.1 カードエンディング方式
各カードを以下の構造化ベクトルで表現（合計22〜36次元/カード）:

| 要素 | 方式 | 次元数 | 実装詳細 |
|------|------|--------|----------|
| Card ID | 学習可能embedding | 8〜16 | `nn.Embedding(83+1, card_id_dim)` |
| コスト | 正規化スカラー [0,1] | 1 | `cost / CHARGE_MAX` |
| カードタイプ | One-hot | 9 | 9ディスプレイタイプ（執行/守護/戦闘/採掘/殲滅/特殊/禁忌/繁栄/観測） |
| 効果カテゴリ | 学習可能embedding | 4〜8 | DeNA式特性ベクトルの拡張 |

#### 3.1.2 手札全体の順序不変表現
```python
class HandEncoder(nn.Module):
    def __init__(self, card_dim=32, hand_size=5):
        self.card_encoder = CardEncoder(card_dim)  # 各カードを32次元に
        self.aggregator = DeepSetsAggregator(card_dim, output_dim=64)
    
    def forward(self, hand_cards):
        # hand_cards: (batch, 5, card_features)
        card_embeddings = self.card_encoder(hand_cards)  # (batch, 5, 32)
        hand_vector = self.aggregator(card_embeddings)   # (batch, 64)
        return hand_vector
```

**DeepSets実装**:
- φ: MLP (card_dim → hidden → card_dim)
- ρ: MLP (card_dim → hand_output_dim)
- 順序非依存の集合表現を実現

#### 3.1.3 CNNボディへの注入
```python
# CNN bodyのflatten後にconcatenate
board_features = cnn_body(board_input)        # (batch, hidden_channels)
hand_features = hand_encoder(hand_input)      # (batch, 64)
aux_features = build_aux_vector(aux_input)    # (batch, 16)

combined = torch.cat([board_features, hand_features, aux_features], dim=1)
# → Policy/Value/Card Headへ
```

**実装ファイル**:
- `ai/train/models/hand_encoder.py` （新規）
- `ai/train/models/cnn_resnet_policy.py` （手札エンコーダ統合）
- `game/ai/policy-onnx-runtime.js` （ブラウザ側手札エンコーディング）

**検証指標**:
- Card Head精度の向上（特に稀なカード使用の予測精度）
- 自己対局でのカード使用パターンの多様性増加

---

### 3.2 盤面履歴T=8入力

**現状の問題**:
- 現在は単一局面のみを入力（5チャンネル×10×10）
- カード効果による盤面変化の文脈が失われる

**実装内容**:

#### 3.2.1 履歴バッファ構造
```python
# 入力チャンネル数: 5 × 8 = 40チャンネル + 手番情報1チャンネル = 41チャンネル
# 各ステップの盤面を独立チャンネルとしてスタック

class HistoryBoardEncoder(nn.Module):
    def __init__(self, history_length=8, board_channels=5):
        self.history_length = history_length
        self.board_channels = board_channels
        # 履歴盤面を畳み込みで統合
        self.history_conv = nn.Conv2d(
            board_channels * history_length,
            board_channels * 2,  # 圧縮
            kernel_size=3,
            padding=1
        )
    
    def forward(self, history_boards):
        # history_boards: (batch, history_length, board_channels, 10, 10)
        batch_size = history_boards.size(0)
        flat_history = history_boards.view(
            batch_size, 
            self.history_length * self.board_channels,
            10, 10
        )
        return self.history_conv(flat_history)
```

#### 3.2.2 データパイプライン変更
```python
def build_board_tensor_with_history(records, history_length=8):
    """
    records: 直近history_length分の履歴レコード
    各ステップでbuild_board_tensor()を呼び出し、スタック
    """
    history_tensors = []
    for rec in records[-history_length:]:
        tensor = build_board_tensor(rec)  # (5, 10, 10)
        history_tensors.append(tensor)
    
    # パディング（履歴が不足する場合はゼロ埋め）
    while len(history_tensors) < history_length:
        history_tensors.insert(0, torch.zeros(5, 10, 10))
    
    return torch.stack(history_tensors)  # (8, 5, 10, 10)
```

**実装ファイル**:
- `ai/train/train_policy_onnx_v2.py` （履歴生成ロジック追加）
- `scripts/generate-selfplay-data.js` （履歴付き自己対局データ出力）

**検証指標**:
- val_lossの減少
- カード効果後の対応手精度向上

---

### 3.3 WDL（勝・分・負）分布ヘッドへの移行

**現状の問題**:
- 現在のValue HeadはMSEで{-1, 0, +1}のスカラー予測
- 引き分け確率と「50%勝・50%負」の区別が不可能

**実装内容**:

#### 3.3.1 WDLヘッド構造
```python
class WDLValueHead(nn.Module):
    def __init__(self, input_dim):
        super().__init__()
        self.fc1 = nn.Linear(input_dim, 256)
        self.fc2 = nn.Linear(256, 3)  # [Win, Draw, Loss]
    
    def forward(self, x):
        x = F.relu(self.fc1(x))
        logits = self.fc2(x)
        probs = F.softmax(logits, dim=-1)  # (batch, 3)
        return probs
    
    def expected_value(self, probs):
        """スカラー価値に変換: +1 * p_win + 0 * p_draw + (-1) * p_loss"""
        values = torch.tensor([1.0, 0.0, -1.0], device=probs.device)
        return torch.sum(probs * values, dim=-1, keepdim=True)
```

#### 3.3.2 損失関数変更
```python
# 従来: MSELoss
# 新: CrossEntropyLoss（WDL分布）

def wdl_loss(pred_probs, game_outcome):
    """
    pred_probs: (batch, 3) - モデル予測のWDL確率
    game_outcome: (batch,) - 実際の結果: 2=勝ち, 1=引き分け, 0=負け
    """
    return F.cross_entropy(pred_probs, game_outcome.long())

# 自己対局データのラベル変更
# y_value: {-1, 0, 1} → {0, 1, 2}（CrossEntropy用）
```

**実装ファイル**:
- `ai/train/models/cnn_resnet_policy.py` （WDLヘッド追加）
- `ai/train/train_policy_onnx_v2.py` （損失関数・ラベル変更）
- `game/ai/mcts-core.js` （WDL値の取り扱い変更）

**検証指標**:
- AlphaVile-FX研究で33 Elo向上の実績
- 引き分け局面の評価精度向上

---

### 3.4 Policy Lossにnonvalidity_penalty

**現状の問題**:
- マスクのみではニューラルネットが無効手にlogit値を割り当て続ける

**実装内容**:
```python
def policy_loss_with_nonvalidity(pred_logits, target_indices, legal_mask, penalty=0.7):
    """
    pred_logits: (batch, 100)
    target_indices: (batch,) - 正解手のインデックス
    legal_mask: (batch, 100) - 合法手マスク（1=合法, 0=不合法）
    penalty: 無効手抑制の強さ
    """
    # 標準的なCrossEntropy（マスク適用済みlogitsで）
    masked_logits = pred_logits.clone()
    masked_logits[legal_mask == 0] = float('-inf')
    ce_loss = F.cross_entropy(masked_logits, target_indices)
    
    # 無効手確率抑制
    illegal_probs = F.softmax(pred_logits, dim=-1) * (1 - legal_mask)
    nonvalidity_loss = penalty * illegal_probs.sum(dim=-1).mean()
    
    return ce_loss + nonvalidity_loss
```

**実装ファイル**:
- `ai/train/train_policy_onnx_v2.py`

---

### 3.5 Card HeadにAsymmetric Loss（ASL）

**現状の問題**:
- NO_CARDが圧倒的多数派（クラス不均衡）
- 稀なカード使用の学習が不足

**実装内容**:
```python
class AsymmetricLoss(nn.Module):
    def __init__(self, gamma_pos=0, gamma_neg=2, m=0.2):
        super().__init__()
        self.gamma_pos = gamma_pos
        self.gamma_neg = gamma_neg
        self.m = m
    
    def forward(self, pred_logits, target):
        # pred_logits: (batch, num_classes)
        # target: (batch,) - クラスインデックス
        probs = torch.sigmoid(pred_logits)
        
        # One-hot化
        targets_one_hot = F.one_hot(target, num_classes=pred_logits.size(1)).float()
        
        # Positive samples (カード使用)
        pos_loss = targets_one_hot * torch.pow(1 - probs, self.gamma_pos) * torch.log(probs + 1e-8)
        
        # Negative samples (NO_CARD + 他未使用カード)
        # mでシフト: 予測確率がm未満のネガティブは無視（easy negative suppression）
        neg_probs = (probs - self.m).clamp(min=0)
        neg_loss = (1 - targets_one_hot) * torch.pow(1 - neg_probs, self.gamma_neg) * torch.log(1 - probs + 1e-8)
        
        return -(pos_loss + neg_loss).sum() / pred_logits.size(0)
```

**推奨パラメータ**:
- γ₊ = 0（ポジティブサンプルのフォーカシングなし）
- γ₋ = 2（ネガティブサンプルの強力な抑制）
- m = 0.2（easy negativeのカットオフ）

**実装ファイル**:
- `ai/train/losses/asymmetric_loss.py` （新規）
- `ai/train/train_policy_onnx_v2.py`

---

### 3.6 Gumbel AlphaZeroへの移行

**現状の問題**:
- 従来のPUCT方式は低シミュレーション（<16）で学習に失敗
- ブラウザ環境では100〜500シミュレーションしか確保できない

**実装内容**:

#### 3.6.1 Gumbel AlphaZeroの核心
```python
class GumbelMCTS:
    def __init__(self, simulations=100, max_actions=8):
        self.simulations = simulations
        self.max_actions = max_actions  # Sequential Halving用
    
    def search(self, root):
        # 1. Gumbelノイズ付きのPolicyからTop-kアクションを選択
        gumbel_noise = self.sample_gumbel(root.policy_logits)
        scored_actions = root.policy_logits + gumbel_noise
        top_actions = torch.topk(scored_actions, self.max_actions).indices
        
        # 2. Sequential Halvingでアクションを絞り込み
        for phase in range(int(math.log2(self.max_actions))):
            # 各アクションを均等にシミュレーション
            for action in top_actions:
                self.simulate(action)
            
            # 半分のアクションを淘汰
            action_values = [self.get_value(a) for a in top_actions]
            top_actions = top_actions[::2]  # 上位半分を保持
        
        # 3. 最終的な訪問回数から方策を生成
        improved_policy = self.compute_improved_policy(root)
        return improved_policy
    
    def sample_gumbel(self, logits):
        """Gumbel-Top-k trick"""
        uniform = torch.rand_like(logits)
        return -torch.log(-torch.log(uniform + 1e-8) + 1e-8)
```

#### 3.6.2 Sequential Halving
```python
def sequential_halving(root, k, budget):
    """
    k: 候補アクション数（通常は8-16）
    budget: 総シミュレーション数
    """
    actions = root.get_top_k_actions(k)
    remaining_budget = budget
    
    while len(actions) > 1:
        # 各アクションに均等にシミュレーションを配分
        simulations_per_action = remaining_budget // len(actions)
        for action in actions:
            for _ in range(simulations_per_action):
                self.simulate(action)
        
        # 半分淘汰
        action_values = [(a, self.get_value(a)) for a in actions]
        action_values.sort(key=lambda x: x[1], reverse=True)
        actions = [a for a, _ in action_values[:len(actions)//2]]
        
        remaining_budget -= simulations_per_action * len(actions) * 2
    
    return actions[0]
```

**実装ファイル**:
- `game/ai/mcts-core.js` （Gumbel AlphaZero方式に書き換え）
- `game/ai/mcts-policy.js` （Sequential Halving統合）

**検証指標**:
- 2シミュレーションでも学習が収束するか
- ブラウザ環境での推論速度維持

---

### 3.7 SPRT（逐次確率比検定）評価ゲート

**現状の問題**:
- 固定220ゲームでは統計力が不足
- 55%勝率でも95%信頼下限は48.4%（50%閾値を下回る）

**実装内容**:

#### 3.7.1 SPRTアルゴリズム
```python
class SPRT:
    def __init__(self, elo0=0, elo1=2.5, alpha=0.05, beta=0.10):
        """
        elo0: 帰無仮説（差がない）
        elo1: 対立仮説（有意な差がある）
        alpha: Type Iエラー率（偽陽性）
        beta: Type IIエラー率（偽陰性）
        """
        self.elo0 = elo0
        self.elo1 = elo1
        self.alpha = alpha
        self.beta = beta
        
        # 対数尤度比の閾値
        self.lower_bound = math.log(beta / (1 - alpha))
        self.upper_bound = math.log((1 - beta) / alpha)
    
    def update(self, wins, losses, draws):
        """
        各試行後にLLRを更新
        戻り値: 'accept', 'reject', 'continue'
        """
        n = wins + losses + draws
        if n == 0:
            return 'continue'
        
        # 勝率の最尤推定
        p = (wins + 0.5 * draws) / n
        
        # 帰無仮説・対立仮説下の確率
        p0 = self.elo_to_winrate(self.elo0)
        p1 = self.elo_to_winrate(self.elo1)
        
        # 対数尤度比
        llr = wins * math.log(p1/p0) + losses * math.log((1-p1)/(1-p0)) + \
              draws * math.log((0.5-0.5*(p1-p0))/(0.5-0.5*(p0-p1)))
        
        if llr >= self.upper_bound:
            return 'accept'  # 候補モデルを採用
        elif llr <= self.lower_bound:
            return 'reject'  # 候補モデルを棄却
        else:
            return 'continue'  # さらに試行が必要
    
    def elo_to_winrate(self, elo):
        return 1 / (1 + 10**(-elo/400))
```

#### 3.7.2 ゲート設計
| ゲート | 最大ゲーム数 | SPRTパラメータ | 早期終了 |
|--------|-------------|---------------|----------|
| Quick Gate | 120 | elo0=0, elo1=1.0 | 可 |
| Final Gate | 200-400 | elo0=0, elo1=2.5 | 可 |

**実装ファイル**:
- `scripts/benchmark-policy-adoption.js` （SPRT統合）
- `scripts/benchmark-policy-quality-gate.js` （SPRT統合）

---

## 4. Phase 2: 中核強化（中期的）

**目標期間**: 4〜6週間  
**優先度**: 🟠 High  
**前提**: Phase 1が安定動作を確認した後

### 4.1 2層MCTS（Duelyst式IMC方式）

**現状の問題**:
- 配置のみ探索でカード使用の価値評価が不正確
- カード選択と配置位置の組み合わせ爆発を無視

**実装内容**:

#### 4.1.1 アクションツリー因数分解
```
Root Node
├── Card Selection (第1層)
│   ├── NO_CARD
│   │   └── Placement (第2層)
│   │       ├── move_1
│   │       ├── move_2
│   │       └── ...
│   ├── card_A
│   │   ├── Effect Application
│   │   └── Placement (if applicable)
│   ├── card_B
│   └── ...
```

#### 4.1.2 2層MCTS実装
```python
class TwoLayerMCTS:
    def __init__(self, card_simulations=50, placement_simulations=50):
        self.card_sims = card_simulations
        self.placement_sims = placement_simulations
    
    def search(self, state):
        # 第1層: カード選択
        card_actions = self.get_card_options(state)
        card_policy = self.model.get_card_probs(state)  # Card Head出力
        
        best_card = None
        best_card_value = -float('inf')
        
        for card in card_actions:
            # カード選択後の状態をシミュレート
            next_state = self.apply_card(state, card)
            
            # 第2層: 配置探索（標準MCTS）
            if card == NO_CARD or not card.requires_placement:
                placement_value = self.evaluate_terminal(next_state)
            else:
                placement_value = self.mcts_placement(
                    next_state, 
                    simulations=self.placement_sims
                )
            
            # カード選択の価値 = 配置後の価値 - コスト機会費用
            card_value = placement_value - self.opportunity_cost(card)
            
            if card_value > best_card_value:
                best_card_value = card_value
                best_card = card
        
        return best_card, self.get_placement_policy(best_card)
```

**実装ファイル**:
- `game/ai/mcts-two-layer.js` （新規）
- `game/ai/mcts-policy.js` （2層MCTS統合）

**計算コスト**:
- カード選択: 最大6枚 × 50シミュレーション = 300
- 配置探索: 平均8手 × 50シミュレーション = 400
- 合計: 700シミュレーション（ブラウザ1秒制約を確認）

---

### 4.2 DeNA式カード特性ベクトル

**現状の問題**:
- 83種類のカード効果がルールベース処理
- 新規カード追加時にモデルの再学習が必要

**実装内容**:

#### 4.2.1 特性ベクトル定義
```python
# 各カードを5〜8次元の学習可能特性で表現
CARD_CHARACTERISTICS = {
    'attack': 0.0,      # 攻撃性（敵石への影響）
    'defense': 0.0,     # 防御性（自石保護）
    'range': 0.0,       # 効果範囲（盤面全体 or 局所）
    'duration': 0.0,    # 持続性（一時的 or 永続的）
    'special': 0.0,     # 特殊効果の有無
    'mobility': 0.0,    # 機動性（石の移動・複製）
    'economy': 0.0,     # 経済性（チャージ効率）
    'control': 0.0,     # 盤面コントロール性
}
```

#### 4.2.2 学習方法
```python
class CardCharacteristicLearner(nn.Module):
    def __init__(self, num_cards=83, char_dim=8):
        self.card_embedding = nn.Embedding(num_cards, char_dim)
        # 初期値: カタログデータからルールベースで設定
        # 学習中: 勾配更新で最適化
    
    def forward(self, card_id):
        return self.card_embedding(card_id)  # (batch, 8)
```

**実装ファイル**:
- `ai/train/models/card_characteristics.py` （新規）
- `cards/catalog.json` （特性初期値のメタデータ追加）

---

### 4.3 KataGo式温度管理・多様性確保

**現状の問題**:
- 単純な温度管理（序盤高・終盤低の2値スイッチ）
- 自己対局の同質化リスク

**実装内容**:

#### 4.3.1 スムーズ温度減衰
```python
def compute_temperature(move_number, board_size=8, initial_temp=0.8, final_temp=0.2):
    """
    KataGo式: halflife = board_sizeで指数減衰
    """
    halflife = board_size
    decay = 0.5 ** (move_number / halflife)
    temp = final_temp + (initial_temp - final_temp) * decay
    return temp

# 使用例
# move 0: temp = 0.8
# move 8: temp = 0.5
# move 16: temp = 0.35
# move 32: temp = 0.24
# move →∞: temp → 0.2
```

#### 4.3.2 Playout Cap Randomization (RPC)
```python
class RPCConfig:
    def __init__(self):
        self.full_search_ratio = 0.25  # 25%の手番でフル探索
        self.full_search_nodes = 600
        self.fast_search_nodes = 100
    
    def should_full_search(self, random_seed):
        return random.random() < self.full_search_ratio
    
    def get_search_budget(self, random_seed):
        if self.should_full_search(random_seed):
            return self.full_search_nodes
        return self.fast_search_nodes
```

#### 4.3.3 Game Branching + Position Branching
```python
class DiversityConfig:
    def __init__(self):
        self.game_branching_rate = 0.05      # 5%のゲームで分岐
        self.position_branching_rate = 0.025  # 2.5%の位置で分岐
        self.branching_moves = (3, 10)        # 3〜10手をランダムに選択
        self.temperature_schedule = [1.0, 2.0, float('inf')]  # 70%, 25%, 5%
    
    def maybe_branch_game(self, game_id):
        if random.random() < self.game_branching_rate:
            branch_point = random.expovariate(1/20)  # 指数分布
            num_branch_moves = random.randint(*self.branching_moves)
            return BranchConfig(branch_point, num_branch_moves)
        return None
```

**実装ファイル**:
- `game/ai/mcts-core.js` （温度管理・RPC統合）
- `scripts/generate-selfplay-data.js` （Game/Position Branching）

---

### 4.4 SWA（Stochastic Weight Averaging）アンサンブル

**現状の問題**:
- 単一チェックポイントでモデルを評価・採用
- 過学習のリスク

**実装内容**:

#### 4.4.1 学習時のSWA
```python
class SWAModel(nn.Module):
    def __init__(self, model, decay=0.75, update_freq=250000):
        super().__init__()
        self.model = model
        self.decay = decay
        self.update_freq = update_freq
        self.swa_model = copy.deepcopy(model)
        self.swa_n = 0
    
    def update(self, step):
        if step % self.update_freq == 0:
            # 指数移動平均で重みを更新
            for swa_param, param in zip(self.swa_model.parameters(), self.model.parameters()):
                swa_param.data = self.decay * swa_param.data + (1 - self.decay) * param.data
            self.swa_n += 1
    
    def get_candidate_model(self):
        # SWAモデルを評価用に出力
        return self.swa_model
```

#### 4.4.2 評価時のアンサンブル
```python
class EnsembleEvaluator:
    def __init__(self, models):
        self.models = models  # 複数世代のモデル
    
    def evaluate(self, state):
        # 複数モデルのPolicy/Valueを平均
        policies = []
        values = []
        for model in self.models:
            p, v = model(state)
            policies.append(p)
            values.append(v)
        
        avg_policy = torch.mean(torch.stack(policies), dim=0)
        avg_value = torch.mean(torch.stack(values), dim=0)
        return avg_policy, avg_value
```

**実装ファイル**:
- `ai/train/swa_trainer.py` （新規）
- `ai/train/train_policy_onnx_v2.py` （SWA統合）

---

### 4.5 カリキュラム学習4ステージ設計

**現状の問題**:
- カード使用率の設定が固定（または単純な線形増加）
- 83種類のカード効果が同時に学習される

**実装内容**:

#### 4.5.1 4ステージカリキュラム
```python
class CurriculumScheduler:
    def __init__(self, total_iterations=100):
        self.stages = [
            # Stage 1: 通常オセロのみ（カード使用なし）
            CurriculumStage(
                start_iter=0,
                end_iter=int(total_iterations * 0.3),
                card_usage_rate=0.0,
                allowed_cards=[],  # カード使用不可
                description="基本戦略学習"
            ),
            # Stage 2: 低頻度カード（単純効果のみ）
            CurriculumStage(
                start_iter=int(total_iterations * 0.3),
                end_iter=int(total_iterations * 0.6),
                card_usage_rate=0.05,
                allowed_cards=['PROTECTED_NEXT_STONE', 'GHOST_WILL'],  # 単純な防御系のみ
                description="カード基礎学習"
            ),
            # Stage 3: 中頻度・全種類
            CurriculumStage(
                start_iter=int(total_iterations * 0.6),
                end_iter=int(total_iterations * 0.8),
                card_usage_rate=0.15,
                allowed_cards='all',  # 全カード解放
                description="カード統合学習"
            ),
            # Stage 4: フリー（MCTS最適化）
            CurriculumStage(
                start_iter=int(total_iterations * 0.8),
                end_iter=total_iterations,
                card_usage_rate=-1,  # MCTSに任せる
                allowed_cards='all',
                description="戦略統合学習"
            ),
        ]
```

**実装ファイル**:
- `scripts/curriculum-scheduler.js` （新規）
- `scripts/run-selfplay-training-cycle.js` （カリキュラム統合）

---

## 5. Phase 3: 革新的変更（長期的）

**目標期間**: 2〜3ヶ月  
**優先度**: 🟡 Medium  
**前提**: Phase 1・2が安定動作を確認した後

### 5.1 ViT/CNN+Transformerハイブリッド（AlphaViT方式）

**現状の問題**:
- 純粋CNNでは長距離依存の捉えが弱い
- 角・辺・中央の関係性をグローバルに評価できない

**実装内容**:

#### 5.1.1 AlphaViTアーキテクチャ
```python
class AlphaViT(nn.Module):
    def __init__(self, board_size=10, patch_size=2, embed_dim=256, num_heads=8, num_layers=6):
        super().__init__()
        # パッチ化
        self.patch_embed = nn.Conv2d(5, embed_dim, kernel_size=patch_size, stride=patch_size)
        # (10x10) → (5x5) patches, each embed_dim
        
        num_patches = (board_size // patch_size) ** 2  # 25 patches
        
        # Positional encoding
        self.pos_embed = nn.Parameter(torch.randn(1, num_patches + 1, embed_dim))
        self.cls_token = nn.Parameter(torch.randn(1, 1, embed_dim))
        
        # Transformer layers
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=embed_dim,
            nhead=num_heads,
            dim_feedforward=embed_dim * 4,
            batch_first=True
        )
        self.transformer = nn.TransformerEncoder(encoder_layer, num_layers=num_layers)
        
        # Heads
        self.policy_head = nn.Linear(embed_dim, 100)  # 10x10 board
        self.value_head = nn.Linear(embed_dim, 3)     # WDL
        self.card_head = nn.Linear(embed_dim, 84)     # 83 cards + NO_CARD
    
    def forward(self, x):
        # x: (batch, 5, 10, 10)
        patches = self.patch_embed(x)  # (batch, embed_dim, 5, 5)
        patches = patches.flatten(2).transpose(1, 2)  # (batch, 25, embed_dim)
        
        # Add CLS token
        cls_tokens = self.cls_token.expand(x.size(0), -1, -1)
        x = torch.cat([cls_tokens, patches], dim=1)  # (batch, 26, embed_dim)
        x = x + self.pos_embed
        
        # Transformer
        x = self.transformer(x)
        
        # CLS token for global representation
        cls_output = x[:, 0]
        
        # Heads
        policy = self.policy_head(cls_output)
        value = self.value_head(cls_output)
        card = self.card_head(cls_output)
        
        return policy, value, card
```

**実装ファイル**:
- `ai/train/models/alpha_vit.py` （新規）

**注意点**:
- ブラウザ推論速度の確認（TransformerはCNNより遅い可能性）
- パッチサイズの調整（2x2が10x10盤面で適切か検証）

---

### 5.2 Mamba/State Space Model

**現状の問題**:
- TransformerのO(T²)計算量が長時系列盤面履歴でボトルネック
- ブラウザ環境での計算コスト

**実装内容**:

#### 5.2.1 CNN+Mambaハイブリッド
```python
class CNNMambaModel(nn.Module):
    def __init__(self, board_channels=5, history_length=8, hidden_dim=256):
        super().__init__()
        # CNNで各盤面をエンコード
        self.cnn_encoder = CNNEncoder(board_channels, hidden_dim)
        
        # Mambaで時系列処理
        self.mamba_layers = nn.ModuleList([
            MambaBlock(hidden_dim, state_dim=16, conv_dim=4)
            for _ in range(4)
        ])
        
        # Heads
        self.policy_head = nn.Linear(hidden_dim, 100)
        self.value_head = nn.Linear(hidden_dim, 3)
        self.card_head = nn.Linear(hidden_dim, 84)
    
    def forward(self, history_boards):
        # history_boards: (batch, history_length, board_channels, 10, 10)
        batch_size, T = history_boards.size(0), history_boards.size(1)
        
        # CNNエンコード
        cnn_features = []
        for t in range(T):
            feat = self.cnn_encoder(history_boards[:, t])  # (batch, hidden_dim)
            cnn_features.append(feat)
        
        # Mamba処理
        x = torch.stack(cnn_features, dim=1)  # (batch, T, hidden_dim)
        for mamba in self.mamba_layers:
            x = mamba(x)
        
        # 最終時刻の特徴量
        final_feat = x[:, -1]
        
        return self.policy_head(final_feat), self.value_head(final_feat), self.card_head(final_feat)
```

**実装ファイル**:
- `ai/train/models/mamba_block.py` （新規）

**注意点**:
- Mambaライブラリの依存関係（mamba-ssm）
- 2D盤面のスキャン順序（VMamba方式の検討）

---

### 5.3 終盤完全読みハイブリッド

**現状の問題**:
- MCTSは終盤の細かい差を完全に読めない
- カード残数0で残り15マス未満では完全読みが可能

**実装内容**:

#### 5.3.1 ハイブリッド探索
```python
class HybridSolver:
    def __init__(self, mcts_model, endgame_solver, empties_threshold=15):
        self.mcts = mcts_model
        self.solver = endgame_solver
        self.empties_threshold = empties_threshold
    
    def search(self, state):
        empties = count_empty_cells(state.board)
        cards_remaining = len(state.hand) + len(state.deck)
        
        # 条件: カード残数=0 かつ 空きマス15未満
        if cards_remaining == 0 and empties < self.empties_threshold:
            # 完全読み（Minimax + Alpha-Beta）
            return self.solver.solve(state)
        else:
            # MCTS探索
            return self.mcts.search(state)

class EndgameSolver:
    def __init__(self, max_depth=20):
        self.max_depth = max_depth
        self.transposition_table = {}
    
    def solve(self, state, depth=0, alpha=-float('inf'), beta=float('inf')):
        # 終盤のMinimax探索
        if is_terminal(state):
            return evaluate_terminal(state)
        
        # トランスポジションテーブル
        state_hash = hash_state(state)
        if state_hash in self.transposition_table:
            return self.transposition_table[state_hash]
        
        best_value = -float('inf')
        for move in get_legal_moves(state):
            next_state = apply_move(state, move)
            value = -self.solve(next_state, depth + 1, -beta, -alpha)
            best_value = max(best_value, value)
            alpha = max(alpha, value)
            if alpha >= beta:
                break  # Alpha-beta pruning
        
        self.transposition_table[state_hash] = best_value
        return best_value
```

**実装ファイル**:
- `game/ai/endgame-solver.js` （新規）
- `game/ai/mcts-policy.js` （ハイブリッド統合）

---

### 5.4 GPUバッチ自己対局

**現状の問題**:
- 自己対局生成がCPUのみで実行
- ゲームシミュレーションがボトルネック

**実装内容**:

#### 5.4.1 バッチゲームシミュレーション
```python
class BatchSelfPlay:
    def __init__(self, model, batch_size=256):
        self.model = model
        self.batch_size = batch_size
        self.games = [Game() for _ in range(batch_size)]
    
    def run_batch(self, num_moves):
        for _ in range(num_moves):
            # バッチで局面を収集
            states = [game.get_state() for game in self.games if not game.is_terminal()]
            
            if not states:
                break
            
            # バッチ推論
            with torch.no_grad():
                policies, values = self.model(states)
            
            # 各ゲームに方策を適用
            for i, game in enumerate(self.games):
                if not game.is_terminal():
                    move = sample_move(policies[i])
                    game.apply_move(move)
```

**実装ファイル**:
- `ai/train/batch_selfplay.py` （新規）
- 既存のNode.js自己対局をPython+GPUに置き換え

**技術選定**:
- **AlphaZero.jl方式**: Julia+CUDA（13倍高速化）
- **Pgx方式**: JAX+GPU（10-100倍高速化）
- **Ray/IMPALA**: 分散複数GPU

---

## 6. 実装タイムライン

### Phase 1: 即座に着手（Week 1-3）

| Week | タスク | 担当 | 成果物 |
|------|--------|------|--------|
| W1-1 | 手札エンコーダ実装 | AI | `hand_encoder.py` |
| W1-2 | WDLヘッド実装 | AI | `cnn_resnet_policy.py`更新 |
| W1-3 | ASL実装 | AI | `asymmetric_loss.py` |
| W2-1 | 盤面履歴T=8統合 | AI+Data | `train_policy_onnx_v2.py`更新 |
| W2-2 | Gumbel AlphaZero実装 | Game | `mcts-core.js`書き換え |
| W2-3 | nonvalidity_penalty統合 | AI | 損失関数更新 |
| W3-1 | SPRT評価ゲート実装 | Eval | `benchmark-policy-adoption.js`更新 |
| W3-2 | Phase 1統合テスト | QA | 学習パイプライン動作確認 |
| W3-3 | ブラウザ推論確認 | Browser | onnxruntime-web動作確認 |

### Phase 2: 中核強化（Week 4-9）

| Week | タスク | 担当 | 成果物 |
|------|--------|------|--------|
| W4-1 | 2層MCTS設計 | Game | アクションツリー設計 |
| W4-2 | 2層MCTS実装 | Game | `mcts-two-layer.js` |
| W5-1 | カード特性ベクトル定義 | AI | `card_characteristics.py` |
| W5-2 | カード特性学習統合 | AI | モデル更新 |
| W6-1 | KataGo式温度管理 | Game | 温度スケジュール実装 |
| W6-2 | RPC実装 | Game | `mcts-core.js`更新 |
| W7-1 | Game/Position Branching | Data | `generate-selfplay-data.js`更新 |
| W7-2 | SWA実装 | AI | `swa_trainer.py` |
| W8-1 | カリキュラムスケジューラー | Data | `curriculum-scheduler.js` |
| W8-2 | 4ステージカリキュラム統合 | Data+AI | パイプライン更新 |
| W9-1 | Phase 2統合テスト | QA | 包括的テスト |
| W9-2 | 性能ベンチマーク | QA | 勝率・学習速度測定 |

### Phase 3: 革新的変更（Week 10-20）

| Week | タスク | 担当 | 成果物 |
|------|--------|------|--------|
| W10-1 | AlphaViT調査 | Research | 論文調査・実装計画 |
| W10-2 | AlphaViTプロトタイプ | AI | `alpha_vit.py` |
| W11-1 | Mamba調査 | Research | 論文調査・実装計画 |
| W11-2 | Mambaプロトタイプ | AI | `mamba_block.py` |
| W12-1 | 終盤ソルバー調査 | Research | Edax/Egaroucid調査 |
| W12-2 | 終盤ソルバー実装 | Game | `endgame-solver.js` |
| W13-1 | GPUバッチ自己対局調査 | Research | JAX/Pgx調査 |
| W13-2 | GPUバッチプロトタイプ | AI | `batch_selfplay.py` |
| W14-20 | 各種実験・比較・統合 | All | 最終統合・ドキュメント |

---

## 7. リスク管理

### 7.1 技術リスク

| リスク | 確率 | 影響 | 対策 |
|--------|------|------|------|
| ブラウザ推論速度不足 | 中 | 大 | Phase 1で即座にベンチマーク。WebGPU活用、INT8量子化 |
| モデルサイズ肥大化 | 中 | 中 | 手札エンコーダは軽量設計。必要に応じてプルーニング |
| 学習不安定化 | 中 | 大 | WDLヘッドは段階的導入。勾配クリッピング、学習率調整 |
| 2層MCTSの計算コスト | 高 | 大 | シミュレーション数の動的調整。ブラウザ制約を優先 |
| Phase 3の実装難易度 | 高 | 中 | Phase 1・2の成果を確認してから着手。フォールバック計画 |

### 7.2 運用リスク

| リスク | 確率 | 影響 | 対策 |
|--------|------|------|------|
| 学習時間増大 | 高 | 中 | 軽量版設定の維持。GPU自己対局で相殺 |
| 既存モデルとの互換性 | 低 | 大 | ONNXエクスポート時の入出力名・形状を維持 |
| デプロイ失敗 | 低 | 大 | ステージング環境での事前検証 |

---

## 8. 検証・テスト計画

### 8.1 単体テスト

```javascript
// 手札エンコーダテスト
describe('HandEncoder', () => {
    test('5枚手札の順序不変性', () => {
        const hand1 = [cardA, cardB, cardC, cardD, cardE];
        const hand2 = [cardE, cardD, cardC, cardB, cardA];
        expect(encoder.encode(hand1)).toEqual(encoder.encode(hand2));
    });
});

// Gumbel AlphaZeroテスト
describe('GumbelMCTS', () => {
    test('2シミュレーションで例外なし', () => {
        const mcts = new GumbelMCTS(2);
        const result = mcts.search(root);
        expect(result).toBeDefined();
    });
});
```

### 8.2 統合テスト

```bash
# Phase 1統合テスト
npm run test:training-pipeline -- --phase=1

# Phase 2統合テスト
npm run test:training-pipeline -- --phase=2

# ブラウザ推論テスト
npm run test:browser-inference
```

### 8.3 性能ベンチマーク

```bash
# 学習速度
npm run benchmark:training-speed

# 推論レイテンシ
npm run benchmark:inference-latency

# 勝率評価
npm run benchmark:winrate
```

---

## 9. 成功指標（KPI）

### 9.1 技術指標

| 指標 | 現状 | Phase 1目標 | Phase 2目標 | Phase 3目標 |
|------|------|-------------|-------------|-------------|
| val_loss | 4.76 | < 4.50 | < 4.20 | < 4.00 |
| val_place_acc | 0.198 | > 0.22 | > 0.25 | > 0.28 |
| val_card_acc | 0.620 | > 0.65 | > 0.70 | > 0.75 |
| 推論レイテンシ(p95) | - | < 1000ms | < 800ms | < 500ms |
| モデルサイズ | - | < 5MB | < 5MB | < 10MB |

### 9.2 ビジネス指標

| 指標 | 現状 | Phase 1目標 | Phase 2目標 | Phase 3目標 |
|------|------|-------------|-------------|-------------|
| Lv6 CPU勝率 | 基準値 | +3% | +5% | +10% |
| 昇格率 | 0% | > 30% | > 50% | > 70% |
| 1イテレーション時間 | 2時間 | < 1.5時間 | < 1時間 | < 45分 |

---

## 10. 参考資料・論文

### 主要論文
1. Silver et al. (2017) "Mastering the game of Go without human knowledge" - AlphaZero
2. Silver et al. (2021) "Planning with Learned Options" - Gumbel AlphaZero
3. Wu (2019) "Accelerating Self-Play Learning in Go" - KataGo
4. Brown & Sandholm (2019) "Superhuman AI for multiplayer poker" - Libratus/Pluribus
5. Danihelka et al. (2022) "Policy Improvement by Planning with Gumbel" - Gumbel MuZero

### カードゲームAI
6. DeNA (2020) "オセロニアAI開発事例" - カード特性ベクトル
7. Cardsformer (2022) - Hearthstoneカード埋め込み
8. SabberStone - Hearthstoneシミュレータ

### MCTS改良
9. Browne et al. (2012) "A Survey of Monte Carlo Tree Search Methods"
10. Baier & Winands (2012) "Active Strategy Discovery in MCTS"

### 損失関数・学習戦略
11. AlphaVile-FX (2023) - WDLヘッド
12. Ridnik et al. (2021) "Asymmetric Loss for Multi-Label Classification" - ASL

### 評価・統計
13. Stockfish Fishtest - SPRT/GSPRT
14. Burch et al. (2018) "AIVAT" - 分散削減

### アーキテクチャ
15. Dosovitskiy et al. (2021) "An Image is Worth 16x16 Words" - ViT
16. Gu & Dao (2023) "Mamba: Linear-Time Sequence Modeling" - SSM

---

## 11. 変更履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|----------|
| 2026-04-27 | 1.0 | 初版作成 |

---

## 12. 承認

| 役割 | 名前 | 日付 |
|------|------|------|
| 作成者 | - | 2026-04-27 |
| レビュー | - | - |
| 承認 | - | - |

---

**本計画書は、ディープリサーチレポート「カードオセロAI学習システム改善提案」に基づき、実装可能な形に具体化したものである。**
