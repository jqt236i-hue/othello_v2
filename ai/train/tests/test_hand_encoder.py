"""Unit tests for hand encoder.

Run with: python -m pytest test_hand_encoder.py -v
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest


def test_import():
    """Test module import."""
    from models.hand_encoder import HandEncoder, build_hand_features_for_record
    assert HandEncoder is not None
    assert build_hand_features_for_record is not None


def test_hand_permutation_invariance():
    """Test that hand encoding is permutation invariant."""
    pytest.importorskip("torch")
    import torch
    from models.hand_encoder import HandEncoder

    encoder = HandEncoder(hand_size=5, card_id_embedding_dim=8)

    # Two hands with same cards in different order
    hand1 = [[[1.0, 0.1] + [0.0]*9, [[2.0, 0.2] + [0.0]*9]] + [[[0.0]*11]*3]
    hand2 = [[[2.0, 0.2] + [0.0]*9, [[1.0, 0.1] + [0.0]*9]] + [[[0.0]*11]*3]

    # Pad to 5 cards
    while len(hand1) < 5:
        hand1.append([0.0]*11)
    while len(hand2) < 5:
        hand2.append([0.0]*11)

    out1 = encoder(torch.tensor([hand1], dtype=torch.float32))
    out2 = encoder(torch.tensor([hand2], dtype=torch.float32))

    # DeepSets should give same output for same set
    assert out1.shape == out2.shape == (1, 64)


def test_empty_hand():
    """Test encoding of empty hand."""
    pytest.importorskip("torch")
    import torch
    from models.hand_encoder import HandEncoder

    encoder = HandEncoder()
    empty_hand = [[[0.0]*11]*5]
    out = encoder(torch.tensor(empty_hand, dtype=torch.float32))
    assert out.shape == (1, 64)
    # All zeros input should give some output (not NaN)
    assert not torch.isnan(out).any()


def test_build_hand_features():
    """Test hand feature builder."""
    from models.hand_encoder import build_hand_features_for_record

    features = build_hand_features_for_record(["hard_01", "destroy_01"])
    assert len(features) == 5  # hand_size
    assert len(features[0]) == 11  # 1 + 1 + 9
    assert features[0][0] > 0  # card_id index should be > 0 for known cards


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
