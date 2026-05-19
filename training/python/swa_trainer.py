"""Stochastic Weight Averaging (SWA) for ensemble model training.

Reference:
  Izmailov et al. (2018) "Averaging Weights Leads to Wider Optima and Better Generalization"
  https://arxiv.org/abs/1803.05407

SWA maintains a running average of model weights during training.
The averaged model typically generalizes better than the final trained model.
"""

from __future__ import annotations

import copy
from typing import Any

import torch
from torch import nn


class SWAModel(nn.Module):
    """SWA wrapper that maintains an exponential moving average of model weights.

    Parameters
    ----------
    model:
        The base model to average.
    decay:
        EMA decay rate (0.9 = slow update, 0.5 = fast update).
    update_freq:
        Update frequency in steps.
    """

    def __init__(self, model: nn.Module, decay: float = 0.75, update_freq: int = 250000) -> None:
        super().__init__()
        self.model = model
        self.decay = decay
        self.update_freq = update_freq
        self.swa_model = copy.deepcopy(model)
        self.swa_n = 0
        self._step_count = 0

        # Freeze SWA model parameters (they are updated manually)
        for param in self.swa_model.parameters():
            param.requires_grad = False

    def update(self, step: int | None = None) -> bool:
        """Update SWA model weights.

        Parameters
        ----------
        step:
            Current training step. If None, uses internal counter.

        Returns
        -------
        True if update was performed.
        """
        if step is not None:
            self._step_count = step
        else:
            self._step_count += 1

        if self._step_count % self.update_freq != 0:
            return False

        # EMA update: swa = decay * swa + (1 - decay) * current
        with torch.no_grad():
            for swa_param, param in zip(self.swa_model.parameters(), self.model.parameters()):
                swa_param.data = self.decay * swa_param.data + (1 - self.decay) * param.data

        self.swa_n += 1
        return True

    def get_averaged_model(self) -> nn.Module:
        """Get the SWA-averaged model for evaluation."""
        return self.swa_model

    def state_dict(self) -> dict[str, Any]:
        """Return state dict including SWA model."""
        return {
            "model": self.model.state_dict(),
            "swa_model": self.swa_model.state_dict(),
            "swa_n": self.swa_n,
            "decay": self.decay,
            "update_freq": self.update_freq,
        }

    def load_state_dict(self, state_dict: dict[str, Any]) -> None:
        """Load state dict."""
        self.model.load_state_dict(state_dict["model"])
        self.swa_model.load_state_dict(state_dict["swa_model"])
        self.swa_n = state_dict.get("swa_n", 0)
        self.decay = state_dict.get("decay", self.decay)
        self.update_freq = state_dict.get("update_freq", self.update_freq)


class EnsembleEvaluator:
    """Evaluate using multiple model checkpoints (ensemble).

    Averages policy and value predictions across multiple models.
    """

    def __init__(self, models: list[nn.Module]) -> None:
        self.models = models
        for model in models:
            model.eval()

    def evaluate(self, *inputs: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        """Average predictions across ensemble models.

        Parameters
        ----------
        *inputs:
            Model inputs (board, aux, hand, etc.)

        Returns
        -------
        (avg_policy, avg_value)
        """
        policies = []
        values = []

        with torch.no_grad():
            for model in self.models:
                outputs = model(*inputs)
                if isinstance(outputs, tuple):
                    policy = outputs[0]
                    value = outputs[1] if len(outputs) > 1 else None
                else:
                    policy = outputs
                    value = None

                policies.append(policy)
                if value is not None:
                    values.append(value)

        avg_policy = torch.mean(torch.stack(policies), dim=0)
        avg_value = torch.mean(torch.stack(values), dim=0) if values else None

        return avg_policy, avg_value


if __name__ == "__main__":
    # Smoke test
    from models.cnn_resnet_policy_v2 import build_cnn_model_v2

    model = build_cnn_model_v2(card_output_dim=5, use_wdl_head=True)
    swa = SWAModel(model, decay=0.75, update_freq=10)

    print(f"SWAModel created with {sum(p.numel() for p in swa.parameters()):,} parameters")

    # Simulate training steps
    for step in range(100):
        swa.update(step)
        if step > 0 and step % 10 == 0:
            print(f"Step {step}: SWA updated (n={swa.swa_n})")
