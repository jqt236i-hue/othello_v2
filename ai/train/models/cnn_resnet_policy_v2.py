"""CNN+ResNet policy/value network with hand encoder and WDL head.

Inputs:
  board: (N, 5, 10, 10) float32  [own, opp, corner_mask, edge_mask, empty_mask]
  aux:   (N, 16) float32         scalar features
  hand:  (N, 5, 11) float32      [card_id_idx, cost_norm, type_onehot(9)] per card

Outputs:
  place_logits: (N, 100) float32
  wdl_logits:   (N, 3)  float32  [Win, Draw, Loss] probabilities
  card_logits:  (N, card_action_dim) float32 (optional)

The network is intentionally lightweight so that onnxruntime-web can run it
within the browser CPU-turn latency budget (~1s per move).
"""

from __future__ import annotations

import torch
from torch import nn
from torch.nn import functional as F

from .hand_encoder import HandEncoder


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


class WDLValueHead(nn.Module):
    """WDL (Win/Draw/Loss) distribution head.

    Outputs 3 logits that are converted to probabilities via softmax.
    Expected value: +1 * p_win + 0 * p_draw + (-1) * p_loss
    """

    def __init__(self, input_dim: int) -> None:
        super().__init__()
        self.fc1 = nn.Linear(input_dim, 256)
        self.fc2 = nn.Linear(256, 3)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = F.relu(self.fc1(x))
        return self.fc2(x)

    def expected_value(self, wdl_logits: torch.Tensor) -> torch.Tensor:
        """Convert WDL logits to scalar expected value."""
        probs = F.softmax(wdl_logits, dim=-1)
        values = torch.tensor([1.0, 0.0, -1.0], device=probs.device, dtype=probs.dtype)
        return torch.sum(probs * values, dim=-1, keepdim=True)


class HistoryBoardEncoder(nn.Module):
    """Encode T=8 board history into a compressed feature tensor.

    Stacks history_length boards as channels, then compresses via Conv2d.
    """

    def __init__(self, history_length: int = 8, board_channels: int = 5) -> None:
        super().__init__()
        self.history_length = history_length
        self.board_channels = board_channels
        # Compress history_length * board_channels down to board_channels * 2
        self.history_conv = nn.Conv2d(
            board_channels * history_length,
            board_channels * 2,
            kernel_size=3,
            padding=1,
            bias=False,
        )
        self.bn = nn.BatchNorm2d(board_channels * 2)

    def forward(self, history_boards: torch.Tensor) -> torch.Tensor:
        """Forward pass.

        Parameters
        ----------
        history_boards: (batch, history_length, board_channels, 10, 10)

        Returns
        -------
        (batch, board_channels * 2, 10, 10)
        """
        batch_size = history_boards.size(0)
        # Flatten history into channels
        x = history_boards.view(
            batch_size,
            self.history_length * self.board_channels,
            history_boards.size(3),
            history_boards.size(4),
        )
        return F.relu(self.bn(self.history_conv(x)))


class CnnResNetPolicyV2(nn.Module):
    """Lightweight CNN+ResNet with hand encoder, history encoder, and WDL value head.

    Parameters
    ----------
    board_size:
        Spatial size of the padded board (default 10).
    board_channels:
        Number of input planes. Default 5.
    aux_dim:
        Dimension of the scalar auxiliary feature vector.
    hand_size:
        Max number of cards in hand.
    hidden_channels:
        Base channel count for the residual tower.
    num_res_blocks:
        Number of residual blocks.
    policy_output_dim:
        Usually ``board_size * board_size`` (100).
    card_output_dim:
        Set to 0 to disable the optional card-action head.
    use_wdl_head:
        When False the WDL head is omitted.
    history_length:
        Board history length (T). Default 1 (no history).
        When > 1, expects 4D history input during forward.
    """

    def __init__(
        self,
        board_size: int = 10,
        board_channels: int = 5,
        aux_dim: int = 16,
        hand_size: int = 5,
        hidden_channels: int = 32,
        num_res_blocks: int = 3,
        policy_output_dim: int = 100,
        card_output_dim: int = 0,
        use_wdl_head: bool = True,
        history_length: int = 1,
    ) -> None:
        super().__init__()
        self.board_size = board_size
        self.board_channels = board_channels
        self.aux_dim = aux_dim
        self.hand_size = hand_size
        self.hidden_channels = hidden_channels
        self.num_res_blocks = num_res_blocks
        self.policy_output_dim = policy_output_dim
        self.card_output_dim = card_output_dim
        self.use_wdl_head = use_wdl_head
        self.history_length = history_length

        # ----- History encoder (optional, active when history_length > 1) -----
        if history_length > 1:
            self.history_encoder = HistoryBoardEncoder(history_length, board_channels)
            tower_input_channels = board_channels * 2
        else:
            self.history_encoder = None
            tower_input_channels = board_channels

        # ----- Board tower -----
        self.conv_initial = nn.Conv2d(
            tower_input_channels, hidden_channels, kernel_size=3, padding=1, bias=False
        )
        self.bn_initial = nn.BatchNorm2d(hidden_channels)
        self.res_blocks = nn.ModuleList(
            [ResBlock(hidden_channels) for _ in range(num_res_blocks)]
        )
        self.board_flat_dim = hidden_channels

        # ----- Aux tower -----
        self.aux_fc = nn.Linear(aux_dim, 32)

        # ----- Hand encoder -----
        self.hand_encoder = HandEncoder(hand_size=hand_size, card_id_embedding_dim=8)
        self.hand_flat_dim = 64

        # ----- Combined trunk -----
        combined_dim = self.board_flat_dim + 32 + self.hand_flat_dim

        # ----- Policy head -----
        self.policy_fc1 = nn.Linear(combined_dim, 64)
        self.policy_fc2 = nn.Linear(64, policy_output_dim)

        # ----- WDL value head -----
        if use_wdl_head:
            self.wdl_head = WDLValueHead(combined_dim)

        # ----- Card head -----
        if card_output_dim > 0:
            self.card_fc1 = nn.Linear(combined_dim, 64)
            self.card_fc2 = nn.Linear(64, card_output_dim)

    def forward(
        self,
        board: torch.Tensor,
        aux: torch.Tensor,
        hand: torch.Tensor | None = None,
        history_boards: torch.Tensor | None = None,
    ) -> torch.Tensor | tuple[torch.Tensor, ...]:
        """Forward pass.

        Parameters
        ----------
        board:
            (N, board_channels, board_size, board_size) — current board.
            If history_boards is None, this is fed directly to the board tower.
        aux:
            (N, aux_dim)
        hand:
            (N, hand_size, 11) or None.  If None, a zero hand is assumed.
        history_boards:
            (N, history_length, board_channels, board_size, board_size) or None.
            When provided, board is ignored and history_boards are encoded first.

        Returns
        -------
        If only policy head -> policy_logits
        If WDL head active   -> (policy_logits, wdl_logits)
        If card head active  -> (policy_logits, wdl_logits, card_logits)
        """
        batch_size = board.size(0)

        # Board tower (with optional history)
        if self.history_encoder is not None and history_boards is not None:
            x = self.history_encoder(history_boards)
        else:
            x = board
        x = F.relu(self.bn_initial(self.conv_initial(x)))
        for block in self.res_blocks:
            x = block(x)
        x_board = F.adaptive_avg_pool2d(x, (1, 1)).view(batch_size, self.board_flat_dim)

        # Aux tower
        x_aux = F.relu(self.aux_fc(aux))

        # Hand tower
        if hand is None:
            hand = torch.zeros(
                batch_size, self.hand_size, 1 + 1 + 9,
                device=board.device, dtype=board.dtype
            )
        x_hand = self.hand_encoder(hand)

        # Combined representation
        x_combined = torch.cat([x_board, x_aux, x_hand], dim=1)

        # Policy head
        policy_logits = self.policy_fc2(F.relu(self.policy_fc1(x_combined)))
        outputs: list[torch.Tensor] = [policy_logits]

        # WDL head
        if self.use_wdl_head:
            wdl_logits = self.wdl_head(x_combined)
            outputs.append(wdl_logits)

        # Card head
        if self.card_output_dim > 0:
            card_logits = self.card_fc2(F.relu(self.card_fc1(x_combined)))
            outputs.append(card_logits)

        return tuple(outputs) if len(outputs) > 1 else outputs[0]

    def count_parameters(self) -> int:
        return sum(p.numel() for p in self.parameters())


def build_cnn_model_v2(
    *,
    board_size: int = 10,
    board_channels: int = 5,
    aux_dim: int = 16,
    hand_size: int = 5,
    hidden_channels: int = 32,
    num_res_blocks: int = 3,
    policy_output_dim: int = 100,
    card_output_dim: int = 0,
    use_wdl_head: bool = True,
    history_length: int = 1,
) -> CnnResNetPolicyV2:
    """Factory helper that creates a ``CnnResNetPolicyV2``."""
    return CnnResNetPolicyV2(
        board_size=board_size,
        board_channels=board_channels,
        aux_dim=aux_dim,
        hand_size=hand_size,
        hidden_channels=hidden_channels,
        num_res_blocks=num_res_blocks,
        policy_output_dim=policy_output_dim,
        card_output_dim=card_output_dim,
        use_wdl_head=use_wdl_head,
        history_length=history_length,
    )


if __name__ == "__main__":
    # Quick smoke test without history
    print("=== Test without history ===")
    model = build_cnn_model_v2(card_output_dim=5, use_wdl_head=True)
    print(f"Parameters: {model.count_parameters():,}")
    board = torch.zeros(2, 5, 10, 10)
    aux = torch.zeros(2, 16)
    hand = torch.zeros(2, 5, 11)
    out = model(board, aux, hand)
    print(f"Output tuple length: {len(out)}")
    print(f"Policy shape: {out[0].shape}")
    print(f"WDL shape:    {out[1].shape}")
    print(f"Card shape:   {out[2].shape}")

    # Quick smoke test with T=8 history
    print("\n=== Test with T=8 history ===")
    model_hist = build_cnn_model_v2(card_output_dim=5, use_wdl_head=True, history_length=8)
    print(f"Parameters: {model_hist.count_parameters():,}")
    history = torch.zeros(2, 8, 5, 10, 10)
    out2 = model_hist(board, aux, hand, history_boards=history)
    print(f"Output tuple length: {len(out2)}")
    print(f"Policy shape: {out2[0].shape}")
    print(f"WDL shape:    {out2[1].shape}")
    print(f"Card shape:   {out2[2].shape}")
