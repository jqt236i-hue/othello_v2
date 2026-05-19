"""AlphaViT: Vision Transformer hybrid for board game AI.

Reference:
  Dosovitskiy et al. (2021) "An Image is Worth 16x16 Words"
  https://arxiv.org/abs/2010.11929

Adapted for 10x10 board with 2x2 patches.
"""

from __future__ import annotations

import torch
from torch import nn


class AlphaViT(nn.Module):
    """Vision Transformer for board game policy/value prediction.

    Parameters
    ----------
    board_size:
        Spatial board size (default 10).
    patch_size:
        Patch size for tokenization (default 2).
    board_channels:
        Input channels (default 5).
    embed_dim:
        Transformer embedding dimension.
    num_heads:
        Number of attention heads.
    num_layers:
        Number of transformer layers.
    policy_output_dim:
        Output dimension for policy head (default 100).
    card_output_dim:
        Output dimension for card head (default 0 to disable).
    use_wdl_head:
        Whether to use WDL value head.
    """

    def __init__(
        self,
        board_size: int = 10,
        patch_size: int = 2,
        board_channels: int = 5,
        embed_dim: int = 256,
        num_heads: int = 8,
        num_layers: int = 6,
        policy_output_dim: int = 100,
        card_output_dim: int = 0,
        use_wdl_head: bool = True,
    ) -> None:
        super().__init__()
        self.board_size = board_size
        self.patch_size = patch_size
        self.board_channels = board_channels
        self.embed_dim = embed_dim
        self.num_patches = (board_size // patch_size) ** 2

        # Patch embedding: Conv2d to embed_dim
        self.patch_embed = nn.Conv2d(
            board_channels, embed_dim,
            kernel_size=patch_size, stride=patch_size
        )

        # CLS token and positional encoding
        self.cls_token = nn.Parameter(torch.randn(1, 1, embed_dim))
        self.pos_embed = nn.Parameter(torch.randn(1, self.num_patches + 1, embed_dim))

        # Transformer encoder
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=embed_dim,
            nhead=num_heads,
            dim_feedforward=embed_dim * 4,
            dropout=0.1,
            batch_first=True,
        )
        self.transformer = nn.TransformerEncoder(encoder_layer, num_layers=num_layers)

        # Layer norm before heads
        self.norm = nn.LayerNorm(embed_dim)

        # Policy head
        self.policy_head = nn.Sequential(
            nn.Linear(embed_dim, embed_dim // 2),
            nn.ReLU(),
            nn.Linear(embed_dim // 2, policy_output_dim),
        )

        # WDL value head
        if use_wdl_head:
            self.wdl_head = nn.Sequential(
                nn.Linear(embed_dim, embed_dim // 2),
                nn.ReLU(),
                nn.Linear(embed_dim // 2, 3),
            )

        # Card head
        if card_output_dim > 0:
            self.card_head = nn.Sequential(
                nn.Linear(embed_dim, embed_dim // 2),
                nn.ReLU(),
                nn.Linear(embed_dim // 2, card_output_dim),
            )

        self.policy_output_dim = policy_output_dim
        self.card_output_dim = card_output_dim
        self.use_wdl_head = use_wdl_head

        # Initialize weights
        self._init_weights()

    def _init_weights(self):
        nn.init.normal_(self.cls_token, std=0.02)
        nn.init.normal_(self.pos_embed, std=0.02)
        nn.init.xavier_uniform_(self.patch_embed.weight)
        nn.init.zeros_(self.patch_embed.bias)

    def forward(self, board: torch.Tensor) -> torch.Tensor | tuple[torch.Tensor, ...]:
        """Forward pass.

        Parameters
        ----------
        board: (batch, board_channels, board_size, board_size)

        Returns
        -------
        If only policy head -> policy_logits
        If WDL head active   -> (policy_logits, wdl_logits)
        If card head active  -> (policy_logits, wdl_logits, card_logits)
        """
        batch_size = board.size(0)

        # Patch embedding
        patches = self.patch_embed(board)  # (batch, embed_dim, num_patches_h, num_patches_w)
        patches = patches.flatten(2).transpose(1, 2)  # (batch, num_patches, embed_dim)

        # Add CLS token
        cls_tokens = self.cls_token.expand(batch_size, -1, -1)
        x = torch.cat([cls_tokens, patches], dim=1)  # (batch, num_patches+1, embed_dim)

        # Add positional encoding
        x = x + self.pos_embed

        # Transformer
        x = self.transformer(x)
        x = self.norm(x)

        # CLS token output
        cls_output = x[:, 0]

        # Heads
        policy_logits = self.policy_head(cls_output)
        outputs: list[torch.Tensor] = [policy_logits]

        if self.use_wdl_head:
            wdl_logits = self.wdl_head(cls_output)
            outputs.append(wdl_logits)

        if self.card_output_dim > 0:
            card_logits = self.card_head(cls_output)
            outputs.append(card_logits)

        return tuple(outputs) if len(outputs) > 1 else outputs[0]

    def count_parameters(self) -> int:
        return sum(p.numel() for p in self.parameters())


def build_alpha_vit(
    *,
    board_size: int = 10,
    patch_size: int = 2,
    board_channels: int = 5,
    embed_dim: int = 256,
    num_heads: int = 8,
    num_layers: int = 6,
    policy_output_dim: int = 100,
    card_output_dim: int = 0,
    use_wdl_head: bool = True,
) -> AlphaViT:
    """Factory helper for AlphaViT."""
    return AlphaViT(
        board_size=board_size,
        patch_size=patch_size,
        board_channels=board_channels,
        embed_dim=embed_dim,
        num_heads=num_heads,
        num_layers=num_layers,
        policy_output_dim=policy_output_dim,
        card_output_dim=card_output_dim,
        use_wdl_head=use_wdl_head,
    )


if __name__ == "__main__":
    model = build_alpha_vit(card_output_dim=5, use_wdl_head=True)
    print(f"AlphaViT parameters: {model.count_parameters():,}")
    board = torch.zeros(2, 5, 10, 10)
    out = model(board)
    print(f"Output tuple length: {len(out)}")
    print(f"Policy shape: {out[0].shape}")
    print(f"WDL shape:    {out[1].shape}")
    print(f"Card shape:   {out[2].shape}")
