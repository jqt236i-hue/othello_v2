"""Unit tests for CNN+ResNet policy v2 model with history support.

Run with: python -m pytest test_cnn_resnet_policy_v2.py -v
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest


def test_import():
    """Test that the model module can be imported."""
    from models.cnn_resnet_policy_v2 import (
        CnnResNetPolicyV2,
        HistoryBoardEncoder,
        build_cnn_model_v2,
    )
    assert CnnResNetPolicyV2 is not None
    assert HistoryBoardEncoder is not None
    assert build_cnn_model_v2 is not None


def test_history_encoder_shapes():
    """Test HistoryBoardEncoder output shapes."""
    pytest.importorskip("torch")
    import torch
    from models.cnn_resnet_policy_v2 import HistoryBoardEncoder

    encoder = HistoryBoardEncoder(history_length=8, board_channels=5)
    history = torch.zeros(2, 8, 5, 10, 10)
    out = encoder(history)
    assert out.shape == (2, 10, 10, 10)  # board_channels * 2 = 10


def test_model_without_history():
    """Test model forward without history (backward compatibility)."""
    pytest.importorskip("torch")
    import torch
    from models.cnn_resnet_policy_v2 import build_cnn_model_v2

    model = build_cnn_model_v2(card_output_dim=5, use_wdl_head=True)
    board = torch.zeros(2, 5, 10, 10)
    aux = torch.zeros(2, 16)
    hand = torch.zeros(2, 5, 11)
    out = model(board, aux, hand)
    assert isinstance(out, tuple)
    assert len(out) == 3
    assert out[0].shape == (2, 100)  # policy
    assert out[1].shape == (2, 3)    # wdl
    assert out[2].shape == (2, 5)    # card


def test_model_with_history():
    """Test model forward with T=8 history."""
    pytest.importorskip("torch")
    import torch
    from models.cnn_resnet_policy_v2 import build_cnn_model_v2

    model = build_cnn_model_v2(
        card_output_dim=5, use_wdl_head=True, history_length=8
    )
    board = torch.zeros(2, 5, 10, 10)
    aux = torch.zeros(2, 16)
    hand = torch.zeros(2, 5, 11)
    history = torch.zeros(2, 8, 5, 10, 10)
    out = model(board, aux, hand, history_boards=history)
    assert isinstance(out, tuple)
    assert len(out) == 3
    assert out[0].shape == (2, 100)
    assert out[1].shape == (2, 3)
    assert out[2].shape == (2, 5)


def test_model_parameter_count():
    """Test that model parameter count is reasonable."""
    pytest.importorskip("torch")
    from models.cnn_resnet_policy_v2 import build_cnn_model_v2

    model = build_cnn_model_v2(card_output_dim=5, use_wdl_head=True)
    params = model.count_parameters()
    assert params > 10000  # Should have at least 10k params
    assert params < 10000000  # Should be under 10M for browser


def test_history_encoder_compression():
    """Test that history encoder compresses correctly."""
    pytest.importorskip("torch")
    import torch
    from models.cnn_resnet_policy_v2 import HistoryBoardEncoder

    encoder = HistoryBoardEncoder(history_length=4, board_channels=5)
    history = torch.randn(1, 4, 5, 10, 10)
    out = encoder(history)
    assert out.shape == (1, 10, 10, 10)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
