"""Hand encoder for explicit card hand representation in Card Othello.

Each card is encoded as a structured vector (card_id embedding + cost + type one-hot).
The hand (up to 5 cards) is aggregated with a DeepSets layer so the representation
is permutation invariant.
"""

from __future__ import annotations

import json
import os
from typing import Any

import torch
from torch import nn
from torch.nn import functional as F

# Card display types (display_type_ja values from catalog.json)
CARD_DISPLAY_TYPES = [
    "執行",   # Enforcement
    "守護",   # Protection
    "戦闘",   # Combat
    "採掘",   # Mining
    "殲滅",   # Annihilation
    "特殊",   # Special
    "禁忌",   # Taboo
    "繁栄",   # Prosperity
    "観測",   # Observation
]
NUM_DISPLAY_TYPES = len(CARD_DISPLAY_TYPES)


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


# Global catalog cache
_CARD_CATALOG = _load_card_catalog()
# Build index for card IDs (excluding __no_card__ which is handled separately)
_CARD_ID_LIST = sorted(_CARD_CATALOG.keys())
_CARD_ID_TO_IDX = {cid: idx for idx, cid in enumerate(_CARD_ID_LIST)}
NUM_CARD_IDS = len(_CARD_ID_LIST)


def card_id_to_index(card_id: str) -> int:
    """Map a card ID string to an integer index for embedding."""
    return _CARD_ID_TO_IDX.get(card_id, NUM_CARD_IDS)  # Unknown cards map to last index


def display_type_to_onehot(display_type: str | None) -> list[float]:
    """Convert display_type_ja string to one-hot vector."""
    vec = [0.0] * NUM_DISPLAY_TYPES
    if isinstance(display_type, str):
        dt = display_type.strip()
        if dt in CARD_DISPLAY_TYPES:
            vec[CARD_DISPLAY_TYPES.index(dt)] = 1.0
    return vec


def encode_card_features(card_id: str | None) -> list[float]:
    """Build a feature vector for a single card (without learned embedding).

    Returns [cost_norm, type_onehot(9)] = 10 dims.
    The learned embedding is handled by nn.Embedding separately.
    """
    if not isinstance(card_id, str) or not card_id.strip():
        # Empty / unknown card
        return [0.0] * (1 + NUM_DISPLAY_TYPES)

    card = _CARD_CATALOG.get(card_id.strip())
    if card is None:
        return [0.0] * (1 + NUM_DISPLAY_TYPES)

    cost = float(card.get("cost", 0)) / 99.0  # CHARGE_MAX normalization
    onehot = display_type_to_onehot(card.get("display_type_ja"))
    return [cost] + onehot


class CardEncoder(nn.Module):
    """Encode a single card into a dense vector.

    Output dimension: card_id_embedding_dim + 1 (cost) + NUM_DISPLAY_TYPES (one-hot)
    """

    def __init__(self, card_id_embedding_dim: int = 8) -> None:
        super().__init__()
        # +1 for unknown cards
        self.card_id_embed = nn.Embedding(NUM_CARD_IDS + 1, card_id_embedding_dim)
        self.output_dim = card_id_embedding_dim + 1 + NUM_DISPLAY_TYPES

    def forward(self, card_features: torch.Tensor) -> torch.Tensor:
        """Forward pass.

        Parameters
        ----------
        card_features: (batch, hand_size, feature_dim)
            where feature_dim = 1 (card_id_index) + 1 (cost) + NUM_DISPLAY_TYPES
            The first element of each card is the integer card_id index.

        Returns
        -------
        (batch, hand_size, output_dim)
        """
        # card_id index is the first feature
        card_id_idx = card_features[..., 0].long()
        id_emb = self.card_id_embed(card_id_idx)  # (batch, hand_size, card_id_embedding_dim)

        # Remaining features: cost + type one-hot
        other_features = card_features[..., 1:]  # (batch, hand_size, 1 + NUM_DISPLAY_TYPES)

        return torch.cat([id_emb, other_features], dim=-1)


class DeepSetsAggregator(nn.Module):
    """DeepSets-style permutation-invariant aggregator.

    phi:  MLP on each element
    rho:  MLP on the sum/mean of phi outputs
    """

    def __init__(self, input_dim: int, hidden_dim: int = 64, output_dim: int = 64) -> None:
        super().__init__()
        self.phi = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, input_dim),
            nn.ReLU(),
        )
        self.rho = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, output_dim),
            nn.ReLU(),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Forward pass.

        Parameters
        ----------
        x: (batch, set_size, input_dim)

        Returns
        -------
        (batch, output_dim)
        """
        # Apply phi to each element
        phi_out = self.phi(x)  # (batch, set_size, input_dim)
        # Aggregate (sum)
        aggregated = phi_out.sum(dim=1)  # (batch, input_dim)
        # Apply rho
        return self.rho(aggregated)


class HandEncoder(nn.Module):
    """Encode a hand of cards into a fixed-size vector.

    Permutation invariant via DeepSets aggregation.
    """

    def __init__(self, hand_size: int = 5, card_id_embedding_dim: int = 8) -> None:
        super().__init__()
        self.hand_size = hand_size
        self.card_encoder = CardEncoder(card_id_embedding_dim=card_id_embedding_dim)
        self.aggregator = DeepSetsAggregator(
            input_dim=self.card_encoder.output_dim,
            hidden_dim=64,
            output_dim=64,
        )

    def forward(self, hand_features: torch.Tensor) -> torch.Tensor:
        """Forward pass.

        Parameters
        ----------
        hand_features: (batch, hand_size, feature_dim)
            feature_dim = 1 (card_id index) + 1 (cost) + NUM_DISPLAY_TYPES (9) = 11

        Returns
        -------
        (batch, 64)
        """
        card_embeddings = self.card_encoder(hand_features)  # (batch, hand_size, card_dim)
        hand_vector = self.aggregator(card_embeddings)       # (batch, 64)
        return hand_vector


def build_hand_features_for_record(hand_card_ids: list[str] | None, hand_size: int = 5) -> list[list[float]]:
    """Build hand feature matrix for a single record.

    Returns list of (hand_size) cards, each with [card_id_index, cost_norm, type_onehot(9)].
    Padding cards are all zeros.
    """
    if not isinstance(hand_card_ids, list):
        hand_card_ids = []

    features: list[list[float]] = []
    for card_id in hand_card_ids[:hand_size]:
        card_id_idx = float(card_id_to_index(card_id))
        card_feats = encode_card_features(card_id)
        features.append([card_id_idx] + card_feats)

    # Pad to hand_size
    empty_card = [0.0] * (1 + 1 + NUM_DISPLAY_TYPES)
    while len(features) < hand_size:
        features.append(empty_card.copy())

    return features


if __name__ == "__main__":
    # Smoke test
    encoder = HandEncoder()
    print(f"HandEncoder parameters: {sum(p.numel() for p in encoder.parameters()):,}")

    # Dummy hand: 2 real cards + 3 padding
    hand = [
        [float(card_id_to_index("hard_01")), 1.0 / 99.0] + display_type_to_onehot("守護"),
        [float(card_id_to_index("destroy_01")), 19.0 / 99.0] + display_type_to_onehot("執行"),
    ]
    empty = [0.0] * (1 + 1 + NUM_DISPLAY_TYPES)
    while len(hand) < 5:
        hand.append(empty.copy())

    hand_tensor = torch.tensor([hand], dtype=torch.float32)
    out = encoder(hand_tensor)
    print(f"Hand encoding shape: {out.shape}")
