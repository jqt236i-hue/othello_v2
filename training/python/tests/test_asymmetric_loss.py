"""Unit tests for Asymmetric Loss (ASL).

Run with: python -m pytest test_asymmetric_loss.py -v
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest


def test_import():
    """Test module import."""
    from losses.asymmetric_loss import AsymmetricLoss
    assert AsymmetricLoss is not None


def test_loss_computation():
    """Test basic loss computation."""
    pytest.importorskip("torch")
    import torch
    from losses.asymmetric_loss import AsymmetricLoss

    loss_fn = AsymmetricLoss(gamma_pos=0, gamma_neg=2, m=0.2)
    pred = torch.randn(4, 10)
    target = torch.tensor([0, 1, 2, 3])
    loss = loss_fn(pred, target)

    assert loss.item() >= 0
    assert not torch.isnan(loss)


def test_class_imbalance():
    """Test that ASL handles class imbalance."""
    pytest.importorskip("torch")
    import torch
    from losses.asymmetric_loss import AsymmetricLoss

    loss_fn = AsymmetricLoss(gamma_neg=2)
    # All predictions for majority class (0)
    pred = torch.zeros(10, 5)
    target = torch.zeros(10, dtype=torch.long)  # All class 0
    loss = loss_fn(pred, target)
    assert loss.item() >= 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
