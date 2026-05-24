#!/usr/bin/env python3
"""Train/export a small normal-Othello policy/value ONNX model.

The input dataset is produced by build-onnx-teacher-dataset.py.  This trainer
is intentionally compact so it can be used as a preflight before committing to
larger distillation runs.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import random
from dataclasses import dataclass
from typing import Any

import torch
from torch import nn
from torch.nn import functional as F


SCHEMA_VERSION = "othello_policy_value_onnx.v1"
DATASET_SCHEMA_VERSION = "othello_onnx_teacher_dataset.v1"
BOARD_SIZE = 8
BOARD_CELLS = BOARD_SIZE * BOARD_SIZE
AUX_FEATURE_DIM = 16
INPUT_DIM = BOARD_CELLS + AUX_FEATURE_DIM
POLICY_DIM = BOARD_CELLS


@dataclass
class DatasetBundle:
    x: torch.Tensor
    y_policy: torch.Tensor
    y_value: torch.Tensor
    player_is_white: torch.Tensor
    records_read: int
    records_used: int
    policy_table_samples: int
    selfplay_policy_samples: int
    value_table_samples: int
    fallback_value_samples: int


class OthelloPolicyValueNet(nn.Module):
    def __init__(self, input_dim: int, hidden_dim: int, depth: int, dropout: float) -> None:
        super().__init__()
        layers: list[nn.Module] = []
        prev = input_dim
        for _ in range(max(1, depth)):
            layers.append(nn.Linear(prev, hidden_dim))
            layers.append(nn.ReLU())
            if dropout > 0:
                layers.append(nn.Dropout(dropout))
            prev = hidden_dim
        self.trunk = nn.Sequential(*layers)
        self.policy_head = nn.Linear(prev, POLICY_DIM)
        self.value_head = nn.Sequential(nn.Linear(prev, 1), nn.Tanh())

    def forward(self, obs: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        h = self.trunk(obs)
        return self.policy_head(h), self.value_head(h)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train normal-Othello policy/value ONNX model.")
    parser.add_argument("--dataset", required=True, help="Teacher JSONL dataset path.")
    parser.add_argument(
        "--onnx-out",
        default=os.path.join("data", "models", "othello", "policy-value.onnx"),
        help="Output ONNX path.",
    )
    parser.add_argument("--meta-out", default="", help="Output metadata JSON path. Default: <onnx-out>.meta.json")
    parser.add_argument("--metrics-out", default="", help="Optional metrics JSON path.")
    parser.add_argument("--max-records", type=int, default=0, help="Maximum JSONL records to load; 0 means all.")
    parser.add_argument("--epochs", type=int, default=6)
    parser.add_argument("--batch-size", type=int, default=512)
    parser.add_argument("--hidden-dim", type=int, default=192)
    parser.add_argument("--depth", type=int, default=3)
    parser.add_argument("--dropout", type=float, default=0.05)
    parser.add_argument("--lr", type=float, default=0.001)
    parser.add_argument("--value-loss-weight", type=float, default=0.35)
    parser.add_argument("--white-sample-weight", type=float, default=1.0)
    parser.add_argument("--black-sample-weight", type=float, default=1.0)
    parser.add_argument("--val-split", type=float, default=0.15)
    parser.add_argument("--seed", type=int, default=20260523)
    parser.add_argument("--device", default="cpu", choices=("cpu", "cuda"))
    return parser.parse_args()


def safe_float(value: Any, default: float = 0.0) -> float:
    try:
        n = float(value)
    except (TypeError, ValueError):
        return default
    return n if math.isfinite(n) else default


def safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def parse_board(board_text: Any) -> list[list[str]]:
    if not isinstance(board_text, str):
        return []
    rows = board_text.strip().split("/")
    if len(rows) != BOARD_SIZE:
        return []
    board: list[list[str]] = []
    for row in rows:
        if len(row) != BOARD_SIZE:
            return []
        board.append(list(row))
    return board


def board_counts(board: list[list[str]], player: str) -> tuple[int, int, int, int, int, int]:
    own_ch = "B" if player == "black" else "W"
    opp_ch = "W" if player == "black" else "B"
    own = opp = empty = 0
    own_corners = opp_corners = 0
    corner_coords = {(0, 0), (0, 7), (7, 0), (7, 7)}
    for r in range(BOARD_SIZE):
        for c in range(BOARD_SIZE):
            ch = board[r][c]
            if ch == own_ch:
                own += 1
                if (r, c) in corner_coords:
                    own_corners += 1
            elif ch == opp_ch:
                opp += 1
                if (r, c) in corner_coords:
                    opp_corners += 1
            else:
                empty += 1
    return own, opp, empty, own_corners, opp_corners, own - opp


def build_features(record: dict[str, Any]) -> list[float] | None:
    player = "black" if record.get("player") == "black" else "white"
    board = parse_board(record.get("board"))
    if not board:
        return None
    own_ch = "B" if player == "black" else "W"
    opp_ch = "W" if player == "black" else "B"
    out = [0.0] * INPUT_DIM
    idx = 0
    edge_own = edge_opp = 0
    for r in range(BOARD_SIZE):
        for c in range(BOARD_SIZE):
            ch = board[r][c]
            if ch == own_ch:
                out[idx] = 1.0
                if r in (0, 7) or c in (0, 7):
                    edge_own += 1
            elif ch == opp_ch:
                out[idx] = -1.0
                if r in (0, 7) or c in (0, 7):
                    edge_opp += 1
            idx += 1

    own, opp, empty, own_corners, opp_corners, disc_diff = board_counts(board, player)
    legal_moves = max(0, safe_int(record.get("legalMoves"), 0))
    phase = str(record.get("phase") or "")
    aux = BOARD_CELLS
    out[aux + 0] = legal_moves / 30.0
    out[aux + 1] = disc_diff / 64.0
    out[aux + 2] = own / 64.0
    out[aux + 3] = opp / 64.0
    out[aux + 4] = empty / 64.0
    out[aux + 5] = own_corners / 4.0
    out[aux + 6] = opp_corners / 4.0
    out[aux + 7] = edge_own / 28.0
    out[aux + 8] = edge_opp / 28.0
    out[aux + 9] = 1.0 if player == "black" else -1.0
    out[aux + 10] = 1.0 if phase == "opening" else 0.0
    out[aux + 11] = 1.0 if phase == "mid" else 0.0
    out[aux + 12] = 1.0 if phase == "end" else 0.0
    # Keep the final slots reserved/zero so train-time features match browser runtime.
    out[aux + 13] = 0.0
    out[aux + 14] = 0.0
    out[aux + 15] = 0.0
    return out


def load_dataset(path: str, max_records: int) -> DatasetBundle:
    xs: list[list[float]] = []
    policies: list[int] = []
    values: list[float] = []
    player_is_white: list[float] = []
    records_read = 0
    policy_table_samples = 0
    selfplay_policy_samples = 0
    value_table_samples = 0
    fallback_value_samples = 0

    with open(path, "r", encoding="utf-8") as handle:
        for line in handle:
            if max_records > 0 and records_read >= max_records:
                break
            records_read += 1
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue
            if rec.get("schemaVersion") != DATASET_SCHEMA_VERSION:
                continue
            target = safe_int(rec.get("policyTarget"), -1)
            if target < 0 or target >= POLICY_DIM:
                continue
            features = build_features(rec)
            if features is None:
                continue
            xs.append(features)
            policies.append(target)
            values.append(max(-1.0, min(1.0, safe_float(rec.get("valueTarget"), 0.0))))
            player_is_white.append(1.0 if rec.get("player") == "white" else 0.0)
            if rec.get("policySource") == "policy_table":
                policy_table_samples += 1
            else:
                selfplay_policy_samples += 1
            if str(rec.get("valueSource") or "").startswith("value_table"):
                value_table_samples += 1
            else:
                fallback_value_samples += 1

    if not xs:
        raise ValueError(f"no usable records loaded from {path}")

    return DatasetBundle(
        x=torch.tensor(xs, dtype=torch.float32),
        y_policy=torch.tensor(policies, dtype=torch.long),
        y_value=torch.tensor(values, dtype=torch.float32).view(-1, 1),
        player_is_white=torch.tensor(player_is_white, dtype=torch.float32).view(-1, 1),
        records_read=records_read,
        records_used=len(xs),
        policy_table_samples=policy_table_samples,
        selfplay_policy_samples=selfplay_policy_samples,
        value_table_samples=value_table_samples,
        fallback_value_samples=fallback_value_samples,
    )


def split_indices(n: int, val_split: float, seed: int) -> tuple[list[int], list[int]]:
    indices = list(range(n))
    rng = random.Random(seed)
    rng.shuffle(indices)
    val_count = int(round(n * max(0.0, min(0.5, val_split))))
    if n >= 10:
        val_count = max(1, val_count)
    val = indices[:val_count]
    train = indices[val_count:] or indices
    return train, val


def batch_iter(indices: list[int], batch_size: int, seed: int):
    shuffled = indices[:]
    random.Random(seed).shuffle(shuffled)
    for start in range(0, len(shuffled), batch_size):
        yield shuffled[start:start + batch_size]


def sample_weights(dataset: DatasetBundle, idx: torch.Tensor, device: str, white_weight: float, black_weight: float) -> torch.Tensor:
    is_white = dataset.player_is_white[idx].to(device).view(-1)
    white = max(0.01, float(white_weight))
    black = max(0.01, float(black_weight))
    weights = torch.where(is_white > 0.5, torch.full_like(is_white, white), torch.full_like(is_white, black))
    return weights / torch.clamp(torch.mean(weights), min=0.01)


def weighted_mean(values: torch.Tensor, weights: torch.Tensor) -> torch.Tensor:
    return torch.sum(values * weights) / torch.clamp(torch.sum(weights), min=0.01)


def evaluate(
    model: nn.Module,
    dataset: DatasetBundle,
    indices: list[int],
    device: str,
    value_loss_weight: float,
    white_sample_weight: float,
    black_sample_weight: float,
) -> dict[str, float]:
    if not indices:
        return {"loss": 0.0, "policyLoss": 0.0, "valueLoss": 0.0, "policyAcc": 0.0, "valueMae": 0.0}
    model.eval()
    with torch.no_grad():
        idx = torch.tensor(indices, dtype=torch.long)
        x = dataset.x[idx].to(device)
        y_policy = dataset.y_policy[idx].to(device)
        y_value = dataset.y_value[idx].to(device)
        weights = sample_weights(dataset, idx, device, white_sample_weight, black_sample_weight)
        logits, value = model(x)
        policy_loss_by_sample = F.cross_entropy(logits, y_policy, reduction="none")
        value_loss_by_sample = torch.mean(torch.square(value - y_value), dim=1)
        policy_loss = weighted_mean(policy_loss_by_sample, weights)
        value_loss = weighted_mean(value_loss_by_sample, weights)
        pred = torch.argmax(logits, dim=1)
        acc = weighted_mean((pred == y_policy).float(), weights)
        mae = weighted_mean(torch.abs(value - y_value).view(-1), weights)
        loss = policy_loss + (value_loss * value_loss_weight)
    return {
        "loss": float(loss.cpu()),
        "policyLoss": float(policy_loss.cpu()),
        "valueLoss": float(value_loss.cpu()),
        "policyAcc": float(acc.cpu()),
        "valueMae": float(mae.cpu()),
    }


def ensure_parent(path: str) -> None:
    parent = os.path.dirname(os.path.abspath(path))
    if parent:
        os.makedirs(parent, exist_ok=True)


def write_json(path: str, payload: dict[str, Any]) -> None:
    ensure_parent(path)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=True, indent=2)


def main() -> None:
    args = parse_args()
    random.seed(args.seed)
    torch.manual_seed(args.seed)
    device = args.device if args.device == "cuda" and torch.cuda.is_available() else "cpu"
    dataset = load_dataset(args.dataset, args.max_records)
    train_idx, val_idx = split_indices(dataset.records_used, args.val_split, args.seed)

    model = OthelloPolicyValueNet(INPUT_DIM, args.hidden_dim, args.depth, args.dropout).to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)

    batch_size = max(1, int(args.batch_size))
    history: list[dict[str, Any]] = []
    for epoch in range(1, max(1, args.epochs) + 1):
        model.train()
        train_loss_total = 0.0
        train_batches = 0
        for batch in batch_iter(train_idx, batch_size, args.seed + epoch):
            idx = torch.tensor(batch, dtype=torch.long)
            x = dataset.x[idx].to(device)
            y_policy = dataset.y_policy[idx].to(device)
            y_value = dataset.y_value[idx].to(device)
            weights = sample_weights(dataset, idx, device, args.white_sample_weight, args.black_sample_weight)
            optimizer.zero_grad(set_to_none=True)
            logits, value = model(x)
            policy_loss = weighted_mean(F.cross_entropy(logits, y_policy, reduction="none"), weights)
            value_loss = weighted_mean(torch.mean(torch.square(value - y_value), dim=1), weights)
            loss = policy_loss + (value_loss * args.value_loss_weight)
            loss.backward()
            optimizer.step()
            train_loss_total += float(loss.detach().cpu())
            train_batches += 1

        train_metrics = evaluate(model, dataset, train_idx, device, args.value_loss_weight, args.white_sample_weight, args.black_sample_weight)
        val_metrics = evaluate(model, dataset, val_idx, device, args.value_loss_weight, args.white_sample_weight, args.black_sample_weight)
        one = {
            "epoch": epoch,
            "trainBatchLoss": train_loss_total / max(1, train_batches),
            "train": train_metrics,
            "val": val_metrics,
        }
        history.append(one)
        print(
            f"[othello-onnx] epoch={epoch} "
            f"train_acc={train_metrics['policyAcc']:.4f} val_acc={val_metrics['policyAcc']:.4f} "
            f"train_mae={train_metrics['valueMae']:.4f} val_mae={val_metrics['valueMae']:.4f}",
            flush=True,
        )

    onnx_out = args.onnx_out
    meta_out = args.meta_out.strip() or (onnx_out + ".meta.json")
    ensure_parent(onnx_out)
    model.eval()
    dummy = torch.zeros((1, INPUT_DIM), dtype=torch.float32, device=device)
    torch.onnx.export(
        model,
        dummy,
        onnx_out,
        input_names=["obs"],
        output_names=["logits", "value"],
        dynamic_axes={"obs": {0: "batch"}, "logits": {0: "batch"}, "value": {0: "batch"}},
        opset_version=17,
    )

    final_train = evaluate(model, dataset, train_idx, device, args.value_loss_weight, args.white_sample_weight, args.black_sample_weight)
    final_val = evaluate(model, dataset, val_idx, device, args.value_loss_weight, args.white_sample_weight, args.black_sample_weight)
    meta = {
        "schemaVersion": SCHEMA_VERSION,
        "datasetSchemaVersion": DATASET_SCHEMA_VERSION,
        "inputName": "obs",
        "placeOutputName": "logits",
        "valueOutputName": "value",
        "inputDim": INPUT_DIM,
        "baseInputDim": INPUT_DIM,
        "outputDim": POLICY_DIM,
        "boardSize": BOARD_SIZE,
        "featureSpec": [
            "board_8x8_perspective_flat",
            "legal_moves_norm",
            "disc_diff_norm",
            "own_count_norm",
            "opp_count_norm",
            "empty_count_norm",
            "own_corners_norm",
            "opp_corners_norm",
            "own_edges_norm",
            "opp_edges_norm",
            "player_sign",
            "phase_opening_flag",
            "phase_mid_flag",
            "phase_end_flag",
            "reserved_zero_0",
            "reserved_zero_1",
            "reserved_zero_2",
        ],
        "model": {
            "hiddenDim": args.hidden_dim,
            "depth": args.depth,
            "dropout": args.dropout,
        },
        "training": {
            "dataset": os.path.abspath(args.dataset),
            "recordsRead": dataset.records_read,
            "recordsUsed": dataset.records_used,
            "trainSamples": len(train_idx),
            "valSamples": len(val_idx),
            "policyTableSamples": dataset.policy_table_samples,
            "selfplayPolicySamples": dataset.selfplay_policy_samples,
            "valueTableSamples": dataset.value_table_samples,
            "fallbackValueSamples": dataset.fallback_value_samples,
            "epochs": args.epochs,
            "batchSize": batch_size,
            "lr": args.lr,
            "valueLossWeight": args.value_loss_weight,
            "whiteSampleWeight": args.white_sample_weight,
            "blackSampleWeight": args.black_sample_weight,
            "seed": args.seed,
            "device": device,
        },
        "metrics": {
            "train": final_train,
            "val": final_val,
        },
    }
    write_json(meta_out, meta)
    if args.metrics_out.strip():
        write_json(args.metrics_out, {"schemaVersion": "othello_policy_value_onnx_metrics.v1", "history": history, "final": meta})

    print(f"[othello-onnx] onnx={onnx_out}")
    print(f"[othello-onnx] meta={meta_out}")
    print(json.dumps(meta["metrics"], ensure_ascii=True))


if __name__ == "__main__":
    main()
