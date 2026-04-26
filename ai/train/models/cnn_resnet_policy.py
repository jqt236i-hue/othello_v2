"""CNN+ResNet policy/value network for browser ONNX inference.

Input:
  board: (N, 2, 10, 10) float32  [own stones, opponent stones]
  aux:   (N, 16) float32         [legal_moves_norm, disc_diff, own_charge, opp_charge,
                                   deck_count_ratio, pending_flag, own_corners, opp_corners,
                                   own_edges, opp_edges, has_corner_move, has_edge_move,
                                   corner_emergency, corner_hold_mode, high_bonus_move,
                                   max_legal_bonus_norm]
Output:
  policy_logits: (N, 100) float32   # 10x10 padded board cell scores
  value:         (N, 1)  float32   # tanh-scaled win probability from current player's view
  card_logits:   (N, card_action_dim) float32  (optional)

The network is intentionally lightweight so that onnxruntime-web can run it
within the browser CPU-turn latency budget (~1s per move).
"""

from __future__ import annotations

import torch
from torch import nn
from torch.nn import functional as F


class ResBlock(nn.Module):
    """Residual block for 10x10 board features."""

    def __init__(self, channels: int) -> None:
        super().__init__()
        self.conv1 = nn.Conv2d(channels, channels, kernel_size=3, padding=1, bias=False)
        self.bn1 = nn.BatchNorm2d(channels)
        self.conv2 = nn.Conv2d(channels, channels, kernel_size=3, padding=1, bias=False)
        self.bn2 = nn.BatchNorm2d(channels)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        residual = x
        out = F.relu(self.bn1(self.conv1(x)))
        out = self.bn2(self.conv2(out))
        out += residual
        return F.relu(out)


class CnnResNetPolicy(nn.Module):
    """Lightweight CNN+ResNet with dual policy / value heads.

    Parameters
    ----------
    board_size:
        Spatial size of the padded board (default 10 for 8x8 + 1-cell border).
    board_channels:
        Number of input planes.  Default 2 (own stones, opponent stones).
    aux_dim:
        Dimension of the scalar auxiliary feature vector.
    hidden_channels:
        Base channel count for the residual tower.  Keep small for browser speed.
    num_res_blocks:
        Number of residual blocks.  2-4 is a good trade-off for this problem size.
    policy_output_dim:
        Usually ``board_size * board_size`` (100).
    value_output_dim:
        Always 1 for a scalar win-probability.
    card_output_dim:
        Set to 0 to disable the optional card-action head.
    use_value_head:
        When ``False`` the value head is omitted (legacy compatibility).
    """

    def __init__(
        self,
        board_size: int = 10,
        board_channels: int = 2,
        aux_dim: int = 16,
        hidden_channels: int = 32,
        num_res_blocks: int = 3,
        policy_output_dim: int = 100,
        value_output_dim: int = 1,
        card_output_dim: int = 0,
        use_value_head: bool = True,
    ) -> None:
        super().__init__()
        self.board_size = board_size
        self.board_channels = board_channels
        self.aux_dim = aux_dim
        self.hidden_channels = hidden_channels
        self.num_res_blocks = num_res_blocks
        self.policy_output_dim = policy_output_dim
        self.value_output_dim = value_output_dim
        self.card_output_dim = card_output_dim
        self.use_value_head = use_value_head

        # ----- Board tower -----
        self.conv_initial = nn.Conv2d(
            board_channels, hidden_channels, kernel_size=3, padding=1, bias=False
        )
        self.bn_initial = nn.BatchNorm2d(hidden_channels)
        self.res_blocks = nn.ModuleList(
            [ResBlock(hidden_channels) for _ in range(num_res_blocks)]
        )
        # After GAP we get (N, hidden_channels)
        self.board_flat_dim = hidden_channels

        # ----- Aux tower -----
        self.aux_fc = nn.Linear(aux_dim, 32)

        # ----- Combined trunk -----
        combined_dim = self.board_flat_dim + 32

        # ----- Policy head -----
        self.policy_fc1 = nn.Linear(combined_dim, 64)
        self.policy_fc2 = nn.Linear(64, policy_output_dim)

        # ----- Value head -----
        if use_value_head:
            self.value_fc1 = nn.Linear(combined_dim, 32)
            self.value_fc2 = nn.Linear(32, value_output_dim)

        # ----- Card head -----
        if card_output_dim > 0:
            self.card_fc1 = nn.Linear(combined_dim, 64)
            self.card_fc2 = nn.Linear(64, card_output_dim)

    def forward(
        self, board: torch.Tensor, aux: torch.Tensor
    ) -> torch.Tensor | tuple[torch.Tensor, ...]:
        """Forward pass.

        Parameters
        ----------
        board:
            (N, board_channels, board_size, board_size)
        aux:
            (N, aux_dim)

        Returns
        -------
        If only policy head is active -> policy_logits (N, policy_output_dim)
        If value head is also active  -> (policy_logits, value)
        If card head is also active   -> (policy_logits, value, card_logits)
        """
        # Board tower
        x = F.relu(self.bn_initial(self.conv_initial(board)))
        for block in self.res_blocks:
            x = block(x)
        x_board = F.adaptive_avg_pool2d(x, (1, 1)).view(-1, self.board_flat_dim)

        # Aux tower
        x_aux = F.relu(self.aux_fc(aux))

        # Combined representation
        x_combined = torch.cat([x_board, x_aux], dim=1)

        # Policy head
        policy_logits = self.policy_fc2(F.relu(self.policy_fc1(x_combined)))

        outputs: list[torch.Tensor] = [policy_logits]

        # Value head
        if self.use_value_head:
            value = torch.tanh(self.value_fc2(F.relu(self.value_fc1(x_combined))))
            outputs.append(value)

        # Card head
        if self.card_output_dim > 0:
            card_logits = self.card_fc2(F.relu(self.card_fc1(x_combined)))
            outputs.append(card_logits)

        return tuple(outputs) if len(outputs) > 1 else outputs[0]

    def count_parameters(self) -> int:
        return sum(p.numel() for p in self.parameters())


def build_cnn_model(
    *,
    board_size: int = 10,
    board_channels: int = 2,
    aux_dim: int = 16,
    hidden_channels: int = 32,
    num_res_blocks: int = 3,
    policy_output_dim: int = 100,
    card_output_dim: int = 0,
    use_value_head: bool = True,
) -> CnnResNetPolicy:
    """Factory helper that creates a ``CnnResNetPolicy`` with the requested heads."""
    return CnnResNetPolicy(
        board_size=board_size,
        board_channels=board_channels,
        aux_dim=aux_dim,
        hidden_channels=hidden_channels,
        num_res_blocks=num_res_blocks,
        policy_output_dim=policy_output_dim,
        card_output_dim=card_output_dim,
        use_value_head=use_value_head,
    )


if __name__ == "__main__":
    # Quick smoke test
    model = build_cnn_model(card_output_dim=5, use_value_head=True)
    print(f"Parameters: {model.count_parameters():,}")
    board = torch.zeros(2, 2, 10, 10)
    aux = torch.zeros(2, 16)
    out = model(board, aux)
    print(f"Output tuple length: {len(out)}")
    print(f"Policy shape: {out[0].shape}")
    print(f"Value shape:  {out[1].shape}")
    print(f"Card shape:   {out[2].shape}")
