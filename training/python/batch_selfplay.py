"""GPU batch self-play for accelerated training data generation.

Reference:
  Pgx: https://github.com/sotetsuk/pgx
  AlphaZero.jl: https://github.com/jonathan-laurent/AlphaZero.jl

This prototype demonstrates batched game simulation on GPU.
For full integration, adapt to the existing Node.js self-play pipeline.
"""

from __future__ import annotations

import time
from typing import Any

import torch
from torch import nn


class BatchGameState:
    """Simple batched game state for Reversi-like games."""

    def __init__(self, batch_size: int, board_size: int = 8) -> None:
        self.batch_size = batch_size
        self.board_size = board_size
        # Board: 0=empty, 1=black, -1=white
        self.boards = torch.zeros(batch_size, board_size, board_size, dtype=torch.int8)
        # Initialize center pieces
        mid = board_size // 2
        self.boards[:, mid - 1, mid - 1] = -1
        self.boards[:, mid - 1, mid] = 1
        self.boards[:, mid, mid - 1] = 1
        self.boards[:, mid, mid] = -1
        self.current_player = torch.ones(batch_size, dtype=torch.int8)  # 1=black, -1=white
        self.done = torch.zeros(batch_size, dtype=torch.bool)
        self.winner = torch.zeros(batch_size, dtype=torch.int8)


class BatchSelfPlay:
    """Batched self-play engine.

    Parameters
    ----------
    model:
        Neural network model (policy + value).
    batch_size:
        Number of games to run in parallel.
    device:
        'cuda' or 'cpu'.
    """

    def __init__(self, model: nn.Module, batch_size: int = 256, device: str = 'cuda') -> None:
        self.model = model.to(device)
        self.batch_size = batch_size
        self.device = device
        self.games = [BatchGameState(1, board_size=8) for _ in range(batch_size)]

    def run_batch(self, max_moves: int = 60) -> list[dict[str, Any]]:
        """Run a batch of games until completion or max moves.

        Returns
        -------
        List of game results with 'winner', 'moves', 'final_board'.
        """
        states = BatchGameState(self.batch_size)
        states.boards = states.boards.to(self.device)
        states.current_player = states.current_player.to(self.device)
        states.done = states.done.to(self.device)

        move_history = [[] for _ in range(self.batch_size)]

        for move_num in range(max_moves):
            # Check which games are still active
            active = ~states.done
            if not active.any():
                break

            # Get active game indices
            active_indices = active.nonzero(as_tuple=True)[0]
            num_active = len(active_indices)

            if num_active == 0:
                break

            # Prepare batch input for active games
            # (Simplified: just use boards as input)
            active_boards = states.boards[active_indices].float()
            active_boards = active_boards.unsqueeze(1)  # Add channel dim

            # Batch inference
            with torch.no_grad():
                # Add dummy aux/hand inputs if needed
                outputs = self.model(active_boards)
                if isinstance(outputs, tuple):
                    policies = outputs[0]
                else:
                    policies = outputs

            # Sample moves for each active game
            for i, game_idx in enumerate(active_indices):
                policy = policies[i]
                # Greedy selection (simplified)
                move_idx = policy.argmax().item()
                row = move_idx // 8
                col = move_idx % 8

                # Apply move (simplified)
                if 0 <= row < states.board_size and 0 <= col < states.board_size:
                    states.boards[game_idx, row, col] = states.current_player[game_idx]
                    move_history[game_idx].append((row, col))

                # Switch player
                states.current_player[game_idx] *= -1

                # Check game end (simplified: after 60 moves)
                if move_num >= 59:
                    states.done[game_idx] = True
                    # Count discs
                    black_count = (states.boards[game_idx] == 1).sum().item()
                    white_count = (states.boards[game_idx] == -1).sum().item()
                    if black_count > white_count:
                        states.winner[game_idx] = 1
                    elif white_count > black_count:
                        states.winner[game_idx] = -1
                    else:
                        states.winner[game_idx] = 0

        # Collect results
        results = []
        for i in range(self.batch_size):
            black_count = (states.boards[i] == 1).sum().item()
            white_count = (states.boards[i] == -1).sum().item()
            winner = states.winner[i].item()
            results.append({
                'winner': 'black' if winner == 1 else 'white' if winner == -1 else 'draw',
                'black_count': black_count,
                'white_count': white_count,
                'moves': move_history[i],
                'final_board': states.boards[i].cpu().numpy().tolist(),
            })

        return results

    def benchmark(self, num_games: int = 1000) -> dict[str, float]:
        """Benchmark batched self-play speed.

        Returns
        -------
        Dictionary with 'games_per_second', 'total_time', 'total_games'.
        """
        start = time.time()
        total_games = 0
        batch_size = self.batch_size
        num_batches = (num_games + batch_size - 1) // batch_size

        for _ in range(num_batches):
            results = self.run_batch(max_moves=60)
            total_games += len(results)

        elapsed = time.time() - start
        gps = total_games / elapsed if elapsed > 0 else 0

        return {
            'games_per_second': gps,
            'total_time': elapsed,
            'total_games': total_games,
            'batch_size': batch_size,
        }


if __name__ == "__main__":
    # Quick benchmark with dummy model
    from models.cnn_resnet_policy_v2 import build_cnn_model_v2

    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    print(f"Using device: {device}")

    model = build_cnn_model_v2(card_output_dim=5, use_wdl_head=True)
    engine = BatchSelfPlay(model, batch_size=64, device=device)

    print("Running benchmark...")
    result = engine.benchmark(num_games=256)
    print(f"Results: {result}")
