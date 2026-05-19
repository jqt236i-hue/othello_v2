"""Unit tests for card characteristic vectors.

Run with: python -m pytest test_card_characteristics.py -v
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest


def test_import():
    """Test module import."""
    from models.card_characteristics import CardCharacteristicLearner
    assert CardCharacteristicLearner is not None


def test_characteristics_shape():
    """Test output shape of characteristic vectors."""
    pytest.importorskip("torch")
    import torch
    from models.card_characteristics import CardCharacteristicLearner

    learner = CardCharacteristicLearner(num_cards=83, char_dim=8)
    indices = torch.tensor([0, 1, 2])
    chars = learner(indices)
    assert chars.shape == (3, 8)


def test_get_characteristics():
    """Test getting characteristics for a card ID."""
    pytest.importorskip("torch")
    from models.card_characteristics import CardCharacteristicLearner

    learner = CardCharacteristicLearner()
    chars = learner.get_characteristics("hard_01")
    assert len(chars) == 8
    assert all(isinstance(c, float) for c in chars)


def test_initialization_from_catalog():
    """Test that characteristics are initialized from catalog."""
    pytest.importorskip("torch")
    from models.card_characteristics import CardCharacteristicLearner

    learner = CardCharacteristicLearner()
    # Defense card should have high defense value
    chars_defense = learner.get_characteristics("hard_01")
    # Attack card should have high attack value
    chars_attack = learner.get_characteristics("destroy_01")

    assert chars_defense[1] > chars_attack[1]  # defense > attack for defense card


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
