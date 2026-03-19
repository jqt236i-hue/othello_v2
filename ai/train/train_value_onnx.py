#!/usr/bin/env python3
"""Train a value ONNX model from self-play NDJSON."""

from __future__ import annotations

import argparse
import json
import math
import os
from dataclasses import dataclass
from typing import Any

import torch
from torch import nn

import train_policy_onnx as base


MODEL_SCHEMA_VERSION = base.MODEL_SCHEMA_VERSION
VALUE_INPUT_DIM = base.INPUT_DIM


@dataclass
class ValueDatasetBundle:
    x: torch.Tensor
    y_value: torch.Tensor
    sample_weight: torch.Tensor
    records_read: int
    train_records: int
    winner_records: int
    loser_records: int
    draw_records: int
    tactical_miss_records: int


@dataclass
class ValueTrainSummary:
    rmse: float
    mae: float
    sign_acc: float
    samples: int


class ValueNet(nn.Module):
    def __init__(self, input_dim: int, hidden_size: int):
        super().__init__()
        self.backbone = nn.Sequential(
            nn.Linear(input_dim, hidden_size),
            nn.ReLU(),
            nn.Linear(hidden_size, hidden_size),
            nn.ReLU(),
        )
        self.value_head = nn.Linear(hidden_size, 1)

    def forward(self, obs: torch.Tensor):
        features = self.backbone(obs)
        return torch.tanh(self.value_head(features))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train value ONNX model from self-play NDJSON.")
    parser.add_argument("--input", required=True, help="Path to NDJSON self-play data.")
    parser.add_argument(
        "--onnx-out",
        default=os.path.join("data", "models", "policy-value.onnx"),
        help="Output ONNX path.",
    )
    parser.add_argument(
        "--meta-out",
        default=None,
        help="Output metadata JSON path (default: <onnx-out>.meta.json).",
    )
    parser.add_argument("--epochs", type=int, default=8, help="Training epochs (default: 8).")
    parser.add_argument("--batch-size", type=int, default=2048, help="Batch size (default: 2048).")
    parser.add_argument("--lr", type=float, default=1e-3, help="Learning rate (default: 1e-3).")
    parser.add_argument("--hidden-size", type=int, default=256, help="MLP hidden size (default: 256).")
    parser.add_argument("--seed", type=int, default=7, help="Random seed (default: 7).")
    parser.add_argument("--val-split", type=float, default=0.1, help="Validation split ratio in [0,0.5).")
    parser.add_argument("--early-stop-patience", type=int, default=0, help="Early-stop patience (default: 0=off).")
    parser.add_argument("--early-stop-min-delta", type=float, default=0.0, help="Early-stop min delta.")
    parser.add_argument("--early-stop-min-epochs", type=int, default=0, help="Minimum epochs before early-stop.")
    parser.add_argument("--early-stop-monitor", default="val_loss", help="Metric for early stopping: val_loss/train_loss.")
    parser.add_argument("--early-stop-smoothing-window", type=int, default=1, help="Moving-average window for early-stop monitor.")
    parser.add_argument("--log-interval-steps", type=int, default=0, help="If > 0, print batch loss every N steps.")
    parser.add_argument("--metrics-out", default="", help="Optional JSONL path for per-epoch metrics.")
    parser.add_argument("--resume-checkpoint", default="", help="Optional checkpoint path to resume model/optimizer state from.")
    parser.add_argument("--resume-optimizer", action="store_true", help="When set, also restore optimizer state.")
    parser.add_argument("--checkpoint-out", default="", help="Optional checkpoint output path (.pt).")
    parser.add_argument("--device", default="auto", help="Device: auto/cpu/cuda.")
    parser.add_argument("--winner-sample-boost", type=float, default=0.35, help="Extra sample weight added to winner-side records.")
    parser.add_argument("--loser-sample-weight", type=float, default=0.8, help="Sample weight used for loser-side records.")
    parser.add_argument("--draw-sample-weight", type=float, default=1.0, help="Sample weight used for draw records.")
    parser.add_argument("--corner-emergency-sample-boost", type=float, default=0.0, help="Extra weight boost when cornerEmergency is active.")
    parser.add_argument("--negative-future-disc-sample-boost", type=float, default=0.0, help="Extra weight boost when futureDiscDelta3Ply is below threshold.")
    parser.add_argument("--negative-future-disc-threshold", type=float, default=-1.0, help="Danger threshold for futureDiscDelta3Ply.")
    parser.add_argument("--tactical-miss-sample-boost", type=float, default=0.0, help="Extra weight boost when tacticalScoreMissRatio exceeds threshold.")
    parser.add_argument("--tactical-miss-threshold", type=float, default=0.08, help="Threshold for tacticalScoreMissRatio danger boost.")
    parser.add_argument("--hand-pressure-sample-boost", type=float, default=0.0, help="Extra weight boost when handCards length is >= 4.")
    parser.add_argument("--pending-target-sample-boost", type=float, default=0.0, help="Extra weight boost when pendingType is active.")
    parser.add_argument("--corner-balance-sample-boost", type=float, default=0.0, help="Extra sample boost scaled by corner-control pressure in [0,1].")
    parser.add_argument("--edge-balance-sample-boost", type=float, default=0.0, help="Extra sample boost scaled by edge-control pressure in [0,1].")
    parser.add_argument("--economy-balance-sample-boost", type=float, default=0.0, help="Extra sample boost scaled by charge/bonus economy pressure in [0,1].")
    parser.add_argument("--value-target-corner-weight", type=float, default=0.0, help="Corner-control auxiliary weight blended into the value target.")
    parser.add_argument("--value-target-edge-weight", type=float, default=0.0, help="Edge-control auxiliary weight blended into the value target.")
    parser.add_argument("--value-target-economy-weight", type=float, default=0.0, help="Charge/bonus economy auxiliary weight blended into the value target.")
    parser.add_argument("--value-target-corner-emergency-weight", type=float, default=0.0, help="Corner-emergency penalty weight blended into the value target.")
    return parser.parse_args()


def validate_value_target_blend_args(args: argparse.Namespace) -> None:
    weighted_args = [
        ("--value-target-corner-weight", float(args.value_target_corner_weight)),
        ("--value-target-edge-weight", float(args.value_target_edge_weight)),
        ("--value-target-economy-weight", float(args.value_target_economy_weight)),
        ("--value-target-corner-emergency-weight", float(args.value_target_corner_emergency_weight)),
    ]
    for flag_name, value in weighted_args:
        if value < 0 or value > 1:
            raise ValueError(f"{flag_name} must be in [0,1]")
    aux_total = sum(value for _, value in weighted_args)
    if aux_total > 0.5:
        raise ValueError("value-target auxiliary weights must sum to <= 0.5")


def value_target(
    rec: dict,
    *,
    corner_weight: float = 0.0,
    edge_weight: float = 0.0,
    economy_weight: float = 0.0,
    corner_emergency_weight: float = 0.0,
) -> float | None:
    outcome = rec.get("outcome")
    if isinstance(outcome, (int, float)):
        base_target = base.clamp_float(float(outcome), -1.0, 1.0)
    else:
        winner = rec.get("winner")
        player = rec.get("player")
        if not isinstance(winner, str) or not isinstance(player, str):
            return None
        winner_norm = winner.strip().lower()
        player_norm = player.strip().lower()
        if winner_norm == "draw":
            base_target = 0.0
        elif winner_norm in ("black", "white") and player_norm in ("black", "white"):
            base_target = 1.0 if winner_norm == player_norm else -1.0
        else:
            return None

    aux_total = float(corner_weight) + float(edge_weight) + float(economy_weight) + float(corner_emergency_weight)
    if aux_total <= 0:
        return base_target

    blended = (
        (max(0.0, 1.0 - aux_total) * float(base_target)) +
        (float(corner_weight) * base.normalized_corner_balance(rec)) +
        (float(edge_weight) * base.normalized_edge_balance(rec)) +
        (float(economy_weight) * base.normalized_economy_balance(rec)) +
        (float(corner_emergency_weight) * (-base.normalized_flag(rec.get("cornerEmergency", 0))))
    )
    return base.clamp_float(blended, -1.0, 1.0)


def load_value_dataset(args: argparse.Namespace) -> ValueDatasetBundle:
    xs: list[list[float]] = []
    y_value: list[float] = []
    sample_weight: list[float] = []
    records_read = 0
    train_records = 0
    winner_records = 0
    loser_records = 0
    draw_records = 0
    tactical_miss_records = 0

    validate_value_target_blend_args(args)

    with open(args.input, "r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            records_read += 1
            rec = json.loads(line)
            target = value_target(
                rec,
                corner_weight=float(args.value_target_corner_weight),
                edge_weight=float(args.value_target_edge_weight),
                economy_weight=float(args.value_target_economy_weight),
                corner_emergency_weight=float(args.value_target_corner_emergency_weight),
            )
            if target is None:
                continue

            xs.append(base.feature_vector(rec))
            y_value.append(float(target))
            weight_value, weight_label = base.sample_weight_for_record(
                rec,
                winner_sample_boost=float(args.winner_sample_boost),
                loser_sample_weight=float(args.loser_sample_weight),
                draw_sample_weight=float(args.draw_sample_weight),
                corner_emergency_sample_boost=float(args.corner_emergency_sample_boost),
                negative_future_disc_sample_boost=float(args.negative_future_disc_sample_boost),
                negative_future_disc_threshold=float(args.negative_future_disc_threshold),
                tactical_miss_sample_boost=float(args.tactical_miss_sample_boost),
                tactical_miss_threshold=float(args.tactical_miss_threshold),
                hand_pressure_sample_boost=float(args.hand_pressure_sample_boost),
                pending_target_sample_boost=float(args.pending_target_sample_boost),
                corner_balance_sample_boost=float(args.corner_balance_sample_boost),
                edge_balance_sample_boost=float(args.edge_balance_sample_boost),
                economy_balance_sample_boost=float(args.economy_balance_sample_boost),
            )
            sample_weight.append(float(weight_value))
            train_records += 1
            if weight_label == "winner":
                winner_records += 1
            elif weight_label == "loser":
                loser_records += 1
            elif weight_label == "draw":
                draw_records += 1
            try:
                if float(rec.get("tacticalScoreMissRatio", 0) or 0) >= float(args.tactical_miss_threshold):
                    tactical_miss_records += 1
            except (TypeError, ValueError):
                pass

    if train_records <= 0:
        raise ValueError("no value training records were found in input data")

    return ValueDatasetBundle(
        x=torch.tensor(xs, dtype=torch.float32),
        y_value=torch.tensor(y_value, dtype=torch.float32),
        sample_weight=torch.tensor(sample_weight, dtype=torch.float32),
        records_read=records_read,
        train_records=train_records,
        winner_records=winner_records,
        loser_records=loser_records,
        draw_records=draw_records,
        tactical_miss_records=tactical_miss_records,
    )


def train_model(
    data: ValueDatasetBundle,
    epochs: int,
    batch_size: int,
    lr: float,
    hidden_size: int,
    device: str,
    seed: int,
    val_split: float,
    early_stop_patience: int,
    early_stop_min_delta: float,
    early_stop_min_epochs: int,
    early_stop_monitor: str,
    early_stop_smoothing_window: int,
    resume_checkpoint: str,
    resume_optimizer: bool,
    log_interval_steps: int,
) -> tuple[nn.Module, torch.optim.Optimizer, ValueTrainSummary, str | None, list[dict[str, Any]]]:
    if epochs < 1:
        raise ValueError("--epochs must be >= 1")
    if batch_size < 1:
        raise ValueError("--batch-size must be >= 1")
    if lr <= 0:
        raise ValueError("--lr must be > 0")
    if hidden_size < 8:
        raise ValueError("--hidden-size must be >= 8")
    if log_interval_steps < 0:
        raise ValueError("--log-interval-steps must be >= 0")
    if val_split < 0 or val_split >= 0.5:
        raise ValueError("--val-split must be in [0,0.5)")
    if early_stop_patience < 0:
        raise ValueError("--early-stop-patience must be >= 0")
    if early_stop_min_delta < 0:
        raise ValueError("--early-stop-min-delta must be >= 0")
    if early_stop_min_epochs < 0:
        raise ValueError("--early-stop-min-epochs must be >= 0")
    if early_stop_smoothing_window < 1:
        raise ValueError("--early-stop-smoothing-window must be >= 1")

    monitor = str(early_stop_monitor or "").strip().lower()
    if monitor not in ("val_loss", "train_loss"):
        raise ValueError("--early-stop-monitor must be val_loss/train_loss")

    torch.manual_seed(seed)
    if device == "cuda":
        torch.cuda.manual_seed_all(seed)

    model = ValueNet(VALUE_INPUT_DIM, hidden_size).to(device)
    x = data.x.to(device)
    y_value = data.y_value.to(device)
    sample_weight = data.sample_weight.to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    resumed_from: str | None = None

    resume_path = (resume_checkpoint or "").strip()
    if resume_path:
        if not os.path.exists(resume_path):
            raise ValueError(f"resume checkpoint not found: {resume_path}")
        checkpoint = torch.load(resume_path, map_location=device)
        state = checkpoint.get("model_state") if isinstance(checkpoint, dict) else None
        if state is None and isinstance(checkpoint, dict):
            state = checkpoint
        if not isinstance(state, dict):
            raise ValueError(f"invalid checkpoint format: {resume_path}")
        try:
            model.load_state_dict(state)
            if resume_optimizer and isinstance(checkpoint, dict) and isinstance(checkpoint.get("optimizer_state"), dict):
                optimizer.load_state_dict(checkpoint["optimizer_state"])
            resumed_from = resume_path
        except Exception as exc:
            print(f"[train_value_onnx] resume checkpoint incompatible; ignored: {resume_path} ({exc})", flush=True)

    total_records = int(x.shape[0])
    val_count = int(total_records * val_split)
    train_count = max(1, total_records - val_count)
    if train_count >= total_records:
        train_indices = torch.arange(total_records)
        val_indices = torch.empty((0,), dtype=torch.long)
    else:
        perm = torch.randperm(total_records)
        train_indices = perm[:train_count]
        val_indices = perm[train_count:]

    x_train = x[train_indices]
    y_train = y_value[train_indices]
    w_train = sample_weight[train_indices]
    x_val = x[val_indices] if int(val_indices.numel()) > 0 else None
    y_val = y_value[val_indices] if int(val_indices.numel()) > 0 else None
    w_val = sample_weight[val_indices] if int(val_indices.numel()) > 0 else None

    best_state = None
    best_epoch = 0
    best_monitor = float("inf")
    no_improve_count = 0
    stopped_early = False
    early_stop_epoch = 0
    history: list[float] = []
    epoch_metrics: list[dict[str, Any]] = []

    for epoch_index in range(epochs):
        model.train()
        perm = torch.randperm(int(x_train.shape[0]), device=device)
        train_loss_sum = 0.0
        train_weight_sum = 0.0
        step_count = 0

        for start in range(0, int(x_train.shape[0]), batch_size):
            step_count += 1
            batch_idx = perm[start:start + batch_size]
            xb = x_train[batch_idx]
            yb = y_train[batch_idx]
            wb = w_train[batch_idx]

            optimizer.zero_grad(set_to_none=True)
            pred = model(xb).squeeze(1)
            losses = (pred - yb) ** 2
            loss = (losses * wb).sum() / torch.clamp(wb.sum(), min=1e-6)
            loss.backward()
            optimizer.step()

            train_loss_sum += float((losses * wb).sum().item())
            train_weight_sum += float(wb.sum().item())

            if log_interval_steps > 0 and step_count % log_interval_steps == 0:
                print(
                    f"[train_value_onnx] epoch={epoch_index + 1} step={step_count} loss={float(loss.item()):.6f}",
                    flush=True,
                )

        model.eval()
        with torch.no_grad():
            train_pred = model(x_train).squeeze(1)
            train_loss = train_loss_sum / max(1e-6, train_weight_sum)

            val_loss = None
            if x_val is not None and y_val is not None and w_val is not None and int(x_val.shape[0]) > 0:
                val_pred = model(x_val).squeeze(1)
                val_losses = (val_pred - y_val) ** 2
                val_loss = float(((val_losses * w_val).sum() / torch.clamp(w_val.sum(), min=1e-6)).item())

        metric_entry: dict[str, Any] = {
            "epoch": epoch_index + 1,
            "trainLoss": train_loss,
            "valLoss": val_loss,
        }
        epoch_metrics.append(metric_entry)

        monitor_value = val_loss if monitor == "val_loss" else train_loss
        if monitor_value is None:
            monitor_value = train_loss
        history.append(float(monitor_value))
        smoothed = history[-early_stop_smoothing_window:]
        effective_monitor = sum(smoothed) / max(1, len(smoothed))

        if effective_monitor + early_stop_min_delta < best_monitor:
            best_monitor = effective_monitor
            best_epoch = epoch_index + 1
            best_state = {key: value.detach().cpu().clone() for key, value in model.state_dict().items()}
            no_improve_count = 0
        else:
            no_improve_count += 1

        reached_min_epochs = (epoch_index + 1) >= early_stop_min_epochs
        if early_stop_patience > 0 and reached_min_epochs and no_improve_count >= early_stop_patience:
            stopped_early = True
            early_stop_epoch = epoch_index + 1
            print(
                f"[train_value_onnx] early-stop triggered at epoch={early_stop_epoch} best_epoch={best_epoch} best_{monitor}={best_monitor:.6f}",
                flush=True,
            )
            break

    if best_state is not None:
        model.load_state_dict(best_state)
    if epoch_metrics:
        epoch_metrics[-1]["stoppedEarly"] = stopped_early
        epoch_metrics[-1]["earlyStopEpoch"] = early_stop_epoch
        epoch_metrics[-1]["bestEpoch"] = best_epoch
        epoch_metrics[-1]["bestMonitor"] = best_monitor

    with torch.no_grad():
        pred_all = model(x).squeeze(1)
        diff = pred_all - y_value
        rmse = float(torch.sqrt(torch.mean(diff * diff)).item())
        mae = float(torch.mean(torch.abs(diff)).item())
        sign_acc = float(torch.mean((torch.sign(pred_all) == torch.sign(y_value)).float()).item())

    summary = ValueTrainSummary(
        rmse=rmse,
        mae=mae,
        sign_acc=sign_acc,
        samples=int(y_value.shape[0]),
    )
    return model, optimizer, summary, resumed_from, epoch_metrics


def export_onnx(model: nn.Module, onnx_out: str) -> None:
    os.makedirs(os.path.dirname(onnx_out) or ".", exist_ok=True)
    model.eval()
    dummy = torch.zeros((1, VALUE_INPUT_DIM), dtype=torch.float32)
    torch.onnx.export(
        model.cpu(),
        (dummy,),
        onnx_out,
        input_names=["obs"],
        output_names=["value"],
        dynamic_axes={
            "obs": {0: "batch"},
            "value": {0: "batch"},
        },
        opset_version=17,
    )


def write_meta(
    path: str,
    args: argparse.Namespace,
    data: ValueDatasetBundle,
    train_summary: ValueTrainSummary,
    device: str,
) -> None:
    payload = {
        "schemaVersion": MODEL_SCHEMA_VERSION,
        "inputName": "obs",
        "outputName": "value",
        "outputNames": ["value"],
        "valueOutputName": "value",
        "inputDim": VALUE_INPUT_DIM,
        "baseInputDim": base.BASE_INPUT_DIM,
        "outputDim": 1,
        "boardSize": base.BOARD_SIZE,
        "actionSpace": "position_value",
        "cardActionIds": base.CARD_ACTION_IDS,
        "valueRange": [-1, 1],
        "featureSpec": [
            "board_8x8_perspective_flat",
            "legal_moves_norm",
            "disc_diff_before_norm",
            "own_charge_norm",
            "opp_charge_norm",
            "deck_count_norm",
            "pending_flag",
            "own_corners_norm",
            "opp_corners_norm",
            "own_edges_norm",
            "opp_edges_norm",
            "has_corner_move_now_flag",
            "has_edge_move_now_flag",
            "corner_emergency_flag",
            "corner_hold_mode_flag",
            "high_bonus_move_available_flag",
            "max_legal_move_bonus_norm",
            "hand_card_counts_norm",
            "usable_card_mask",
        ],
        "training": {
            "epochs": args.epochs,
            "batchSize": args.batch_size,
            "lr": args.lr,
            "hiddenSize": args.hidden_size,
            "seed": args.seed,
            "device": device,
            "valSplit": args.val_split,
            "earlyStopPatience": args.early_stop_patience,
            "earlyStopMinDelta": args.early_stop_min_delta,
            "earlyStopMinEpochs": args.early_stop_min_epochs,
            "earlyStopMonitor": args.early_stop_monitor,
            "earlyStopSmoothingWindow": args.early_stop_smoothing_window,
            "winnerSampleBoost": args.winner_sample_boost,
            "loserSampleWeight": args.loser_sample_weight,
            "drawSampleWeight": args.draw_sample_weight,
            "cornerEmergencySampleBoost": args.corner_emergency_sample_boost,
            "negativeFutureDiscSampleBoost": args.negative_future_disc_sample_boost,
            "negativeFutureDiscThreshold": args.negative_future_disc_threshold,
            "tacticalMissSampleBoost": args.tactical_miss_sample_boost,
            "tacticalMissThreshold": args.tactical_miss_threshold,
            "handPressureSampleBoost": args.hand_pressure_sample_boost,
            "pendingTargetSampleBoost": args.pending_target_sample_boost,
            "cornerBalanceSampleBoost": args.corner_balance_sample_boost,
            "edgeBalanceSampleBoost": args.edge_balance_sample_boost,
            "economyBalanceSampleBoost": args.economy_balance_sample_boost,
            "valueTargetCornerWeight": args.value_target_corner_weight,
            "valueTargetEdgeWeight": args.value_target_edge_weight,
            "valueTargetEconomyWeight": args.value_target_economy_weight,
            "valueTargetCornerEmergencyWeight": args.value_target_corner_emergency_weight,
            "resumeCheckpoint": (args.resume_checkpoint or "").strip() or None,
            "resumeOptimizer": bool(args.resume_optimizer),
            "checkpointOut": (args.checkpoint_out or "").strip() or None,
        },
        "stats": {
            "recordsRead": data.records_read,
            "trainRecords": data.train_records,
            "winnerRecords": data.winner_records,
            "loserRecords": data.loser_records,
            "drawRecords": data.draw_records,
            "tacticalMissRecords": data.tactical_miss_records,
            "trainRmse": train_summary.rmse,
            "trainMae": train_summary.mae,
            "trainSignAccuracy": train_summary.sign_acc,
            "trainSamples": train_summary.samples,
        },
    }
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)


def maybe_write_checkpoint(
    checkpoint_out: str,
    model: nn.Module,
    optimizer: torch.optim.Optimizer,
    args: argparse.Namespace,
    data: ValueDatasetBundle,
    train_summary: ValueTrainSummary,
    device: str,
    resumed_from: str | None,
) -> None:
    out = (checkpoint_out or "").strip()
    if not out:
        return
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    payload = {
        "formatVersion": 1,
        "schemaVersion": MODEL_SCHEMA_VERSION,
        "model_state": model.cpu().state_dict(),
        "optimizer_state": optimizer.state_dict(),
        "modelConfig": {
            "inputDim": VALUE_INPUT_DIM,
            "baseInputDim": base.BASE_INPUT_DIM,
            "outputDim": 1,
            "cardActionIds": base.CARD_ACTION_IDS,
        },
        "training": {
            "epochs": int(args.epochs),
            "batchSize": int(args.batch_size),
            "lr": float(args.lr),
            "hiddenSize": int(args.hidden_size),
            "seed": int(args.seed),
            "device": device,
            "valSplit": float(args.val_split),
            "earlyStopPatience": int(args.early_stop_patience),
            "earlyStopMinDelta": float(args.early_stop_min_delta),
            "earlyStopMinEpochs": int(args.early_stop_min_epochs),
            "earlyStopMonitor": str(args.early_stop_monitor),
            "earlyStopSmoothingWindow": int(args.early_stop_smoothing_window),
            "winnerSampleBoost": float(args.winner_sample_boost),
            "loserSampleWeight": float(args.loser_sample_weight),
            "drawSampleWeight": float(args.draw_sample_weight),
            "cornerEmergencySampleBoost": float(args.corner_emergency_sample_boost),
            "negativeFutureDiscSampleBoost": float(args.negative_future_disc_sample_boost),
            "negativeFutureDiscThreshold": float(args.negative_future_disc_threshold),
            "tacticalMissSampleBoost": float(args.tactical_miss_sample_boost),
            "tacticalMissThreshold": float(args.tactical_miss_threshold),
            "handPressureSampleBoost": float(args.hand_pressure_sample_boost),
            "pendingTargetSampleBoost": float(args.pending_target_sample_boost),
            "cornerBalanceSampleBoost": float(args.corner_balance_sample_boost),
            "edgeBalanceSampleBoost": float(args.edge_balance_sample_boost),
            "economyBalanceSampleBoost": float(args.economy_balance_sample_boost),
            "valueTargetCornerWeight": float(args.value_target_corner_weight),
            "valueTargetEdgeWeight": float(args.value_target_edge_weight),
            "valueTargetEconomyWeight": float(args.value_target_economy_weight),
            "valueTargetCornerEmergencyWeight": float(args.value_target_corner_emergency_weight),
            "resumedFrom": resumed_from,
            "resumeOptimizer": bool(args.resume_optimizer),
        },
        "stats": {
            "recordsRead": int(data.records_read),
            "trainRecords": int(data.train_records),
            "winnerRecords": int(data.winner_records),
            "loserRecords": int(data.loser_records),
            "drawRecords": int(data.draw_records),
            "tacticalMissRecords": int(data.tactical_miss_records),
            "trainRmse": float(train_summary.rmse),
            "trainMae": float(train_summary.mae),
            "trainSignAccuracy": float(train_summary.sign_acc),
            "trainSamples": int(train_summary.samples),
        },
    }
    torch.save(payload, out)


def main() -> int:
    args = parse_args()
    device = base.choose_device(str(args.device).strip().lower())
    meta_out = args.meta_out or (args.onnx_out + ".meta.json")

    data = load_value_dataset(args)
    model, optimizer, train_summary, resumed_from, epoch_metrics = train_model(
        data=data,
        epochs=int(args.epochs),
        batch_size=int(args.batch_size),
        lr=float(args.lr),
        hidden_size=int(args.hidden_size),
        device=device,
        seed=int(args.seed),
        val_split=float(args.val_split),
        early_stop_patience=int(args.early_stop_patience),
        early_stop_min_delta=float(args.early_stop_min_delta),
        early_stop_min_epochs=int(args.early_stop_min_epochs),
        early_stop_monitor=str(args.early_stop_monitor or ""),
        early_stop_smoothing_window=int(args.early_stop_smoothing_window),
        resume_checkpoint=str(args.resume_checkpoint or ""),
        resume_optimizer=bool(args.resume_optimizer),
        log_interval_steps=int(args.log_interval_steps),
    )
    export_onnx(model, args.onnx_out)
    write_meta(meta_out, args, data, train_summary, device)
    base.maybe_write_metrics(str(args.metrics_out or ""), epoch_metrics)
    maybe_write_checkpoint(
        checkpoint_out=str(args.checkpoint_out or ""),
        model=model,
        optimizer=optimizer,
        args=args,
        data=data,
        train_summary=train_summary,
        device=device,
        resumed_from=resumed_from,
    )

    print(
        "[train_value_onnx] "
        f"records={data.records_read} "
        f"train_records={data.train_records} "
        f"winner_records={data.winner_records} "
        f"loser_records={data.loser_records} "
        f"draw_records={data.draw_records} "
        f"tactical_miss_records={data.tactical_miss_records} "
        f"train_rmse={train_summary.rmse:.4f} "
        f"train_mae={train_summary.mae:.4f} "
        f"train_sign_acc={train_summary.sign_acc:.3f} "
        f"onnx={args.onnx_out}"
    )
    print(f"[train_value_onnx] meta={meta_out}")
    if (args.checkpoint_out or "").strip():
        print(f"[train_value_onnx] checkpoint={args.checkpoint_out}")
    if (args.metrics_out or "").strip():
        print(f"[train_value_onnx] metrics={args.metrics_out}")
    if resumed_from:
        print(f"[train_value_onnx] resumed_from={resumed_from}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
