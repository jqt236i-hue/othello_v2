"""Asymmetric Loss (ASL) for multi-label / imbalanced classification.

Reference:
  Ridnik et al. (2021) "Asymmetric Loss for Multi-Label Classification"
  https://arxiv.org/abs/2009.14119

This version is adapted for single-label classification with severe class
imbalance (e.g., NO_CARD dominates rare card usage).
"""

from __future__ import annotations

import torch
from torch import nn
from torch.nn import functional as F


class AsymmetricLoss(nn.Module):
    """Asymmetric Loss for class-imbalanced classification.

    Parameters
    ----------
    gamma_pos:
        Focusing parameter for positive samples (default 0).
    gamma_neg:
        Focusing parameter for negative samples (default 2).
    m:
        Easy-negative suppression margin (default 0.2).
    """

    def __init__(self, gamma_pos: float = 0.0, gamma_neg: float = 2.0, m: float = 0.2) -> None:
        super().__init__()
        self.gamma_pos = gamma_pos
        self.gamma_neg = gamma_neg
        self.m = m

    def forward(self, pred_logits: torch.Tensor, target: torch.Tensor) -> torch.Tensor:
        """Compute ASL.

        Parameters
        ----------
        pred_logits: (batch, num_classes)
        target: (batch,) – class indices

        Returns
        -------
        Scalar loss tensor.
        """
        probs = torch.sigmoid(pred_logits)
        num_classes = pred_logits.size(1)

        # One-hot encode targets
        targets_one_hot = F.one_hot(target, num_classes=num_classes).float()

        # Positive samples: down-weight easy positives if gamma_pos > 0
        pos_loss = (
            targets_one_hot
            * torch.pow(1.0 - probs, self.gamma_pos)
            * torch.log(probs + 1e-8)
        )

        # Negative samples: shift by m and apply focusing
        neg_probs = (probs - self.m).clamp(min=0.0)
        neg_loss = (
            (1.0 - targets_one_hot)
            * torch.pow(1.0 - neg_probs, self.gamma_neg)
            * torch.log(1.0 - probs + 1e-8)
        )

        # Sum over classes, mean over batch
        loss = -(pos_loss + neg_loss).sum(dim=-1).mean()
        return loss
