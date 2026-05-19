"""Mamba block for sequence modeling of board history.

Reference:
  Gu & Dao (2023) "Mamba: Linear-Time Sequence Modeling with Selective State Spaces"
  https://arxiv.org/abs/2312.00752

Simplified PyTorch implementation without mamba-ssm dependency.
For production use, consider switching to the official mamba-ssm package.
"""

from __future__ import annotations

import math

import torch
from torch import nn
from torch.nn import functional as F


class MambaBlock(nn.Module):
    """Simplified Mamba block for time-series board encoding.

    Parameters
    ----------
    d_model:
        Model dimension.
    d_state:
        SSM state dimension (default 16).
    d_conv:
        Convolution dimension (default 4).
    expand:
        Expansion factor (default 2).
    """

    def __init__(self, d_model: int, d_state: int = 16, d_conv: int = 4, expand: int = 2) -> None:
        super().__init__()
        self.d_model = d_model
        self.d_state = d_state
        self.d_conv = d_conv
        self.expand = expand
        self.d_inner = int(self.expand * self.d_model)

        # Input projection
        self.in_proj = nn.Linear(d_model, self.d_inner * 2, bias=False)

        # Convolution
        self.conv1d = nn.Conv1d(
            in_channels=self.d_inner,
            out_channels=self.d_inner,
            kernel_size=d_conv,
            padding=d_conv - 1,
            groups=self.d_inner,
            bias=True,
        )

        # SSM parameters
        self.x_proj = nn.Linear(self.d_inner, d_state * 2 + 1, bias=False)
        self.dt_proj = nn.Linear(d_state, self.d_inner, bias=True)
        self.A_log = nn.Parameter(torch.log(torch.arange(1, d_state + 1)).repeat(self.d_inner, 1))
        self.D = nn.Parameter(torch.ones(self.d_inner))

        # Output projection
        self.out_proj = nn.Linear(self.d_inner, d_model, bias=False)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Forward pass.

        Parameters
        ----------
        x: (batch, seq_len, d_model)

        Returns
        -------
        (batch, seq_len, d_model)
        """
        batch, seq_len, dim = x.shape

        # Input projection (split into two paths)
        x_and_res = self.in_proj(x)  # (batch, seq_len, d_inner * 2)
        x_ssm, res = x_and_res.split([self.d_inner, self.d_inner], dim=-1)

        # Convolution
        x_conv = x_ssm.transpose(1, 2)  # (batch, d_inner, seq_len)
        x_conv = self.conv1d(x_conv)[..., :seq_len]  # Trim padding
        x_conv = x_conv.transpose(1, 2)  # (batch, seq_len, d_inner)
        x_conv = F.silu(x_conv)

        # SSM
        y = self.ssm(x_conv)

        # Gating
        y = y * F.silu(res)

        # Output projection
        output = self.out_proj(y)
        return output

    def ssm(self, x: torch.Tensor) -> torch.Tensor:
        """Selective State Space Model.

        Parameters
        ----------
        x: (batch, seq_len, d_inner)

        Returns
        -------
        (batch, seq_len, d_inner)
        """
        batch, seq_len, d_in = x.shape

        # Project to B, C, delta
        x_proj_out = self.x_proj(x)  # (batch, seq_len, d_state * 2 + 1)
        delta, B, C = x_proj_out.split([1, self.d_state, self.d_state], dim=-1)

        # Discretization
        A = -torch.exp(self.A_log.float())  # (d_inner, d_state)
        delta = F.softplus(self.dt_proj(delta.squeeze(-1)))  # (batch, seq_len, d_inner)

        # SSM recurrence (simplified)
        # In full Mamba, this uses parallel scan
        # Here we use a simple sequential implementation for clarity
        h = torch.zeros(batch, d_in, self.d_state, device=x.device, dtype=x.dtype)
        ys = []
        for t in range(seq_len):
            # Discretized parameters
            dA = torch.exp(delta[:, t].unsqueeze(-1) * A)  # (batch, d_inner, d_state)
            dB = delta[:, t].unsqueeze(-1) * B[:, t].unsqueeze(1)  # (batch, d_inner, d_state)

            # State update
            h = dA * h + dB * x[:, t].unsqueeze(-1)

            # Output
            y = torch.sum(h * C[:, t].unsqueeze(1), dim=-1)  # (batch, d_inner)
            y = y + self.D * x[:, t]
            ys.append(y)

        return torch.stack(ys, dim=1)


class CNNMambaModel(nn.Module):
    """CNN+Mamba hybrid for board history processing.

    Uses CNN to encode individual boards, then Mamba to process the sequence.
    """

    def __init__(
        self,
        board_channels: int = 5,
        history_length: int = 8,
        hidden_dim: int = 256,
        num_mamba_layers: int = 4,
        policy_output_dim: int = 100,
        card_output_dim: int = 0,
        use_wdl_head: bool = True,
    ) -> None:
        super().__init__()
        self.board_channels = board_channels
        self.history_length = history_length
        self.hidden_dim = hidden_dim

        # CNN encoder for each board
        self.cnn_encoder = nn.Sequential(
            nn.Conv2d(board_channels, hidden_dim // 2, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.Conv2d(hidden_dim // 2, hidden_dim, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.AdaptiveAvgPool2d((1, 1)),
        )

        # Mamba layers
        self.mamba_layers = nn.ModuleList([
            MambaBlock(hidden_dim)
            for _ in range(num_mamba_layers)
        ])

        # Layer norm
        self.norm = nn.LayerNorm(hidden_dim)

        # Heads
        self.policy_head = nn.Linear(hidden_dim, policy_output_dim)
        if use_wdl_head:
            self.wdl_head = nn.Linear(hidden_dim, 3)
        if card_output_dim > 0:
            self.card_head = nn.Linear(hidden_dim, card_output_dim)

        self.policy_output_dim = policy_output_dim
        self.card_output_dim = card_output_dim
        self.use_wdl_head = use_wdl_head

    def forward(self, history_boards: torch.Tensor) -> torch.Tensor | tuple[torch.Tensor, ...]:
        """Forward pass.

        Parameters
        ----------
        history_boards: (batch, history_length, board_channels, 10, 10)

        Returns
        -------
        If only policy head -> policy_logits
        If WDL head active   -> (policy_logits, wdl_logits)
        If card head active  -> (policy_logits, wdl_logits, card_logits)
        """
        batch_size, T = history_boards.size(0), history_boards.size(1)

        # CNN encode each timestep
        cnn_features = []
        for t in range(T):
            feat = self.cnn_encoder(history_boards[:, t])  # (batch, hidden_dim, 1, 1)
            feat = feat.view(batch_size, self.hidden_dim)
            cnn_features.append(feat)

        # Stack into sequence
        x = torch.stack(cnn_features, dim=1)  # (batch, T, hidden_dim)

        # Mamba processing
        for mamba in self.mamba_layers:
            x = mamba(x)

        x = self.norm(x)

        # Final timestep features
        final_feat = x[:, -1]

        # Heads
        policy_logits = self.policy_head(final_feat)
        outputs: list[torch.Tensor] = [policy_logits]

        if self.use_wdl_head:
            wdl_logits = self.wdl_head(final_feat)
            outputs.append(wdl_logits)

        if self.card_output_dim > 0:
            card_logits = self.card_head(final_feat)
            outputs.append(card_logits)

        return tuple(outputs) if len(outputs) > 1 else outputs[0]

    def count_parameters(self) -> int:
        return sum(p.numel() for p in self.parameters())


if __name__ == "__main__":
    model = CNNMambaModel(card_output_dim=5, use_wdl_head=True)
    print(f"CNNMambaModel parameters: {model.count_parameters():,}")
    history = torch.zeros(2, 8, 5, 10, 10)
    out = model(history)
    print(f"Output tuple length: {len(out)}")
    print(f"Policy shape: {out[0].shape}")
    print(f"WDL shape:    {out[1].shape}")
    print(f"Card shape:   {out[2].shape}")
