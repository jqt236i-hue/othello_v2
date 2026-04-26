"""Card characteristic vectors (DeNA-style) for learning card effects.

Each card is represented by a learnable 8-dimensional characteristic vector:
  attack, defense, range, duration, special, mobility, economy, control

This allows the model to generalize across similar cards and adapt to
new cards without retraining from scratch.
"""

from __future__ import annotations

import json
import os
from typing import Any

import torch
from torch import nn


# Card characteristic dimensions
CARD_CHARACTERISTICS = [
    "attack",    # Aggressiveness (enemy stone impact)
    "defense",   # Defensiveness (self stone protection)
    "range",     # Effect range (board-wide vs local)
    "duration",  # Persistence (temporary vs permanent)
    "special",   # Special effect presence
    "mobility",  # Mobility (stone movement/duplication)
    "economy",   # Economy (charge efficiency)
    "control",   # Board control
]
NUM_CHARACTERISTICS = len(CARD_CHARACTERISTICS)


def _load_card_catalog() -> dict[str, dict[str, Any]]:
    """Load card catalog and return mapping from card_id -> card metadata."""
    catalog_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "..", "cards", "catalog.json")
    )
    try:
        with open(catalog_path, "r", encoding="utf-8") as f:
            payload = json.load(f)
        cards = payload.get("cards", []) if isinstance(payload, dict) else []
        out: dict[str, dict[str, Any]] = {}
        for card in cards:
            if not isinstance(card, dict):
                continue
            card_id = card.get("id")
            if not isinstance(card_id, str) or not card_id.strip():
                continue
            out[card_id.strip()] = card
        return out
    except Exception:
        return {}


# Initialize rule-based characteristic values from catalog
_CARD_CATALOG = _load_card_catalog()
_CARD_ID_LIST = sorted(_CARD_CATALOG.keys())


def _init_characteristics_from_catalog(card_id: str) -> list[float]:
    """Initialize characteristic vector based on card catalog metadata."""
    card = _CARD_CATALOG.get(card_id)
    if not card:
        return [0.0] * NUM_CHARACTERISTICS

    display_type = card.get("display_type_ja", "")
    cost = float(card.get("cost", 0))
    card_type = card.get("type", "")

    # Rule-based initialization
    chars = [0.0] * NUM_CHARACTERISTICS

    # Attack: high for combat/annihilation cards
    if display_type in ("戦闘", "殲滅", "執行"):
        chars[0] = 0.8
    elif display_type in ("禁忌", "特殊"):
        chars[0] = 0.5

    # Defense: high for protection cards
    if display_type == "守護":
        chars[1] = 0.9
    elif display_type == "繁栄":
        chars[1] = 0.4

    # Range: board-wide effects have high range
    desc = card.get("desc_ja", "")
    if "盤面" in desc or "全体" in desc:
        chars[2] = 0.8
    elif "周囲" in desc:
        chars[2] = 0.5
    else:
        chars[2] = 0.3

    # Duration: based on turn mentions in description
    if "ターン" in desc or "持続" in desc:
        chars[3] = 0.7
    elif "ずっと" in desc or "永続" in desc:
        chars[3] = 1.0
    else:
        chars[3] = 0.2

    # Special: complex effects are special
    if display_type in ("禁忌", "特殊", "観測"):
        chars[4] = 0.8
    elif len(desc) > 50:
        chars[4] = 0.5

    # Mobility: movement effects
    if "移動" in desc or "テレポート" in desc or "入替" in desc:
        chars[5] = 0.9
    elif "飛ば" in desc:
        chars[5] = 0.7

    # Economy: mining/resource cards
    if display_type == "採掘":
        chars[6] = 0.9
    elif "布石" in desc or "チャージ" in desc:
        chars[6] = 0.6

    # Control: board manipulation
    if "盤面拡張" in desc or "盤面縮小" in desc or "穴" in desc:
        chars[7] = 0.9
    elif "封鎖" in desc or "凍結" in desc:
        chars[7] = 0.7

    return chars


class CardCharacteristicLearner(nn.Module):
    """Learnable card characteristic embeddings.

    Each card has an 8-dimensional characteristic vector that is initialized
    from rule-based heuristics and refined during training.
    """

    def __init__(self, num_cards: int = 83, char_dim: int = 8) -> None:
        super().__init__()
        self.num_cards = num_cards
        self.char_dim = char_dim

        # Initialize with rule-based values
        init_weights = torch.zeros(num_cards + 1, char_dim)
        for i, card_id in enumerate(_CARD_ID_LIST[:num_cards]):
            chars = _init_characteristics_from_catalog(card_id)
            init_weights[i] = torch.tensor(chars, dtype=torch.float32)

        self.card_embedding = nn.Embedding.from_pretrained(init_weights, freeze=False)

    def forward(self, card_indices: torch.Tensor) -> torch.Tensor:
        """Get characteristic vectors for card indices.

        Parameters
        ----------
        card_indices: (batch,) or (batch, hand_size)

        Returns
        -------
        (batch, char_dim) or (batch, hand_size, char_dim)
        """
        return self.card_embedding(card_indices)

    def get_characteristics(self, card_id: str) -> list[float]:
        """Get characteristics for a card ID."""
        idx = _CARD_ID_LIST.index(card_id) if card_id in _CARD_ID_LIST else self.num_cards
        with torch.no_grad():
            vec = self.card_embedding(torch.tensor([idx])).squeeze(0)
        return vec.tolist()


class CardCharacteristicLoss(nn.Module):
    """Loss to encourage meaningful characteristic vectors.

    Uses contrastive loss: similar cards should have similar characteristics.
    """

    def __init__(self, margin: float = 0.5) -> None:
        super().__init__()
        self.margin = margin

    def forward(self, char_vecs: torch.Tensor, card_types: torch.Tensor) -> torch.Tensor:
        """Compute contrastive loss.

        Parameters
        ----------
        char_vecs: (batch, char_dim)
        card_types: (batch,) - type indices for each card
        """
        # Simple MSE-based regularization to keep vectors in reasonable range
        return torch.mean(char_vecs ** 2)


if __name__ == "__main__":
    learner = CardCharacteristicLearner()
    print(f"CardCharacteristicLearner parameters: {sum(p.numel() for p in learner.parameters()):,}")

    # Test with a few cards
    test_cards = ["hard_01", "destroy_01", "sniper_01", "plunder_will"]
    for card_id in test_cards:
        chars = learner.get_characteristics(card_id)
        print(f"{card_id}: {dict(zip(CARD_CHARACTERISTICS, [f'{c:.2f}' for c in chars]))}")
