#!/usr/bin/env python3
"""Train a pending-target ONNX model from self-play NDJSON."""

from __future__ import annotations

import argparse
import json
import os
from dataclasses import dataclass
from typing import Any

import torch
from torch import nn
from torch.nn import functional as F

import onnx_trainer_common as trainer_common
import train_policy_onnx as base


MODEL_SCHEMA_VERSION = base.MODEL_SCHEMA_VERSION
TARGET_PENDING_TYPES = [
    "FREE_PLACEMENT",
    "LAST_RESORT",
    "DESTROY_ONE_STONE",
    "STRONG_WIND_WILL",
    "SUPER_BUOYANCY_WILL",
    "SUPER_GRAVITY_WILL",
    "SACRIFICE_WILL",
    "SWAP_WITH_ENEMY",
    "POSITION_SWAP_WILL",
    "TRAP_WILL",
    "TEMPT_WILL",
    "GUARD_WILL",
    "GUARDIAN_GOD",
    "HYPERACTIVE_INHERIT_WILL",
    "EXTEND_LIFE_WILL",
    "CORROSION_WILL",
    "TIME_BOMB",
    "CLONE_WILL",
    "SPLIT_WILL",
    "TELEPORT_WILL",
    "CELL_TELEPORT_WILL",
    "BOARD_EXPANSION_WILL",
    "BOARD_EXPANSION_GOD",
    "BLOCKADE_WILL",
    "METEOR_WILL",
]
PENDING_TYPE_INDEX = {pending_type: idx for idx, pending_type in enumerate(TARGET_PENDING_TYPES)}
TARGET_BASE_INPUT_DIM = base.INPUT_DIM
TARGET_INPUT_DIM = TARGET_BASE_INPUT_DIM + len(TARGET_PENDING_TYPES)
TARGET_OUTPUT_DIM = base.PLACE_OUTPUT_DIM


@dataclass
class TargetDatasetBundle:
    x: torch.Tensor
    y_target: torch.Tensor
    sample_weight: torch.Tensor
    records_read: int
    train_records: int
    target_records: int
    winner_records: int
    loser_records: int
    draw_records: int
    tactical_miss_records: int


@dataclass
class TargetTrainSummary:
    target_acc: float
    target_samples: int


class TargetNet(nn.Module):
    def __init__(self, input_dim: int, hidden_size: int, output_dim: int):
        super().__init__()
        self.backbone = nn.Sequential(
            nn.Linear(input_dim, hidden_size),
            nn.ReLU(),
            nn.Linear(hidden_size, hidden_size),
            nn.ReLU(),
        )
        self.target_head = nn.Linear(hidden_size, output_dim)

    def forward(self, obs: torch.Tensor):
        features = self.backbone(obs)
        return self.target_head(features)


def accuracy_from_logits(logits: torch.Tensor, target: torch.Tensor) -> tuple[int, int]:
    mask = target != base.IGNORE_INDEX
    samples = int(mask.sum().item())
    if samples <= 0:
        return 0, 0
    pred = torch.argmax(logits, dim=1)
    correct = int((pred[mask] == target[mask]).sum().item())
    return correct, samples


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train pending-target ONNX model from self-play NDJSON.")
    parser.add_argument("--input", required=True, help="Path to NDJSON self-play data.")
    parser.add_argument(
        "--onnx-out",
        default=os.path.join("data", "models", "policy-target.onnx"),
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
    return parser.parse_args()


def normalize_pending_type(raw: object) -> str | None:
    if not isinstance(raw, str):
        return None
    pending_type = raw.strip()
    if not pending_type:
        return None
    return pending_type if pending_type in PENDING_TYPE_INDEX else None


def feature_vector(rec: dict) -> list[float]:
    base_features = base.feature_vector(rec)
    out = [0.0] * TARGET_INPUT_DIM
    limit = min(len(base_features), TARGET_BASE_INPUT_DIM)
    for idx in range(limit):
        out[idx] = float(base_features[idx])

    pending_type = normalize_pending_type(rec.get("pendingType"))
    pending_index = PENDING_TYPE_INDEX.get(pending_type) if pending_type else None
    if pending_index is not None:
        out[TARGET_BASE_INPUT_DIM + pending_index] = 1.0
    return out


def target_index(rec: dict) -> int | None:
    pending_type = normalize_pending_type(rec.get("pendingType"))
    if pending_type is None:
        return None

    selection = rec.get("pendingSelection")
    if not isinstance(selection, dict) or selection.get("kind") != "board_cell":
        return None

    return base.board_cell_index_for_record(rec, selection.get("row"), selection.get("col"))


def load_target_dataset(args: argparse.Namespace) -> TargetDatasetBundle:
    xs: list[list[float]] = []
    y_target: list[int] = []
    sample_weight: list[float] = []
    records_read = 0
    target_records = 0
    winner_records = 0
    loser_records = 0
    draw_records = 0
    tactical_miss_records = 0

    with open(args.input, "r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            records_read += 1
            rec = json.loads(line)
            target_t = target_index(rec)
            if target_t is None:
                continue

            xs.append(feature_vector(rec))
            y_target.append(target_t)
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
            )
            sample_weight.append(float(weight_value))
            target_records += 1
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

    if target_records <= 0:
        raise ValueError("no coordinate-based pending target records were found in input data")

    return TargetDatasetBundle(
        x=torch.tensor(xs, dtype=torch.float32),
        y_target=torch.tensor(y_target, dtype=torch.long),
        sample_weight=torch.tensor(sample_weight, dtype=torch.float32),
        records_read=records_read,
        train_records=target_records,
        target_records=target_records,
        winner_records=winner_records,
        loser_records=loser_records,
        draw_records=draw_records,
        tactical_miss_records=tactical_miss_records,
    )


def train_model(
    data: TargetDatasetBundle,
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
) -> tuple[nn.Module, torch.optim.Optimizer, TargetTrainSummary, str | None, list[dict[str, Any]]]:
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
    monitor = trainer_common.normalize_early_stop_monitor(
        early_stop_monitor,
        early_stop_patience=early_stop_patience,
        early_stop_min_delta=early_stop_min_delta,
        early_stop_min_epochs=early_stop_min_epochs,
        early_stop_smoothing_window=early_stop_smoothing_window,
        allowed_monitors=("val_loss", "train_loss"),
        allowed_monitors_label="val_loss/train_loss",
    )

    torch.manual_seed(seed)
    if device == "cuda":
        torch.cuda.manual_seed_all(seed)

    model = TargetNet(TARGET_INPUT_DIM, hidden_size, TARGET_OUTPUT_DIM).to(device)
    x = data.x.to(device)
    y_target = data.y_target.to(device)
    sample_weight = data.sample_weight.to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    resumed_from: str | None = None

    resume_path, checkpoint, state = trainer_common.read_resume_checkpoint(resume_checkpoint, device)
    if resume_path and state is not None:
        try:
            model.load_state_dict(state)
            if resume_optimizer and isinstance(checkpoint, dict) and isinstance(checkpoint.get("optimizer_state"), dict):
                optimizer.load_state_dict(checkpoint["optimizer_state"])
            resumed_from = resume_path
        except Exception as exc:
            trainer_common.log_ignored_resume_checkpoint("train_target_onnx", resume_path, exc)

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
    y_train = y_target[train_indices]
    w_train = sample_weight[train_indices]
    x_val = x[val_indices] if int(val_indices.numel()) > 0 else None
    y_val = y_target[val_indices] if int(val_indices.numel()) > 0 else None
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
            logits = model(xb)
            losses = F.cross_entropy(logits, yb, reduction="none")
            loss = (losses * wb).sum() / torch.clamp(wb.sum(), min=1e-6)
            loss.backward()
            optimizer.step()

            train_loss_sum += float((losses * wb).sum().item())
            train_weight_sum += float(wb.sum().item())

            if log_interval_steps > 0 and step_count % log_interval_steps == 0:
                print(
                    f"[train_target_onnx] epoch={epoch_index + 1} step={step_count} loss={float(loss.item()):.6f}",
                    flush=True,
                )

        model.eval()
        with torch.no_grad():
            train_logits = model(x_train)
            train_correct, train_samples = accuracy_from_logits(train_logits, y_train)
            train_loss = train_loss_sum / max(1e-6, train_weight_sum)

            val_loss = None
            val_acc = None
            val_samples = 0
            if x_val is not None and y_val is not None and w_val is not None and int(x_val.shape[0]) > 0:
                val_logits = model(x_val)
                val_losses = F.cross_entropy(val_logits, y_val, reduction="none")
                val_loss = float(((val_losses * w_val).sum() / torch.clamp(w_val.sum(), min=1e-6)).item())
                val_correct, val_samples = accuracy_from_logits(val_logits, y_val)
                val_acc = val_correct / max(1, val_samples)

        metric_entry: dict[str, Any] = {
            "epoch": epoch_index + 1,
            "trainLoss": train_loss,
            "trainTargetAccuracy": train_correct / max(1, train_samples),
            "trainTargetSamples": train_samples,
            "valLoss": val_loss,
            "valTargetAccuracy": val_acc,
            "valTargetSamples": val_samples,
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
                f"[train_target_onnx] early-stop triggered at epoch={early_stop_epoch} best_epoch={best_epoch} best_{monitor}={best_monitor:.6f}",
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
        logits_all = model(x)
        target_correct_all, target_samples_all = accuracy_from_logits(logits_all, y_target)

    summary = TargetTrainSummary(
        target_acc=(target_correct_all / max(1, target_samples_all)),
        target_samples=target_samples_all,
    )
    return model, optimizer, summary, resumed_from, epoch_metrics


def export_onnx(model: nn.Module, onnx_out: str) -> None:
    os.makedirs(os.path.dirname(onnx_out) or ".", exist_ok=True)
    model.eval()
    dummy = torch.zeros((1, TARGET_INPUT_DIM), dtype=torch.float32)
    torch.onnx.export(
        model.cpu(),
        (dummy,),
        onnx_out,
        input_names=["obs"],
        output_names=["target_logits"],
        dynamic_axes={
            "obs": {0: "batch"},
            "target_logits": {0: "batch"},
        },
        opset_version=17,
    )


def write_meta(
    path: str,
    args: argparse.Namespace,
    data: TargetDatasetBundle,
    train_summary: TargetTrainSummary,
    device: str,
) -> None:
    payload = {
        "schemaVersion": MODEL_SCHEMA_VERSION,
        "inputName": "obs",
        "outputName": "target_logits",
        "outputNames": ["target_logits"],
        "targetOutputName": "target_logits",
        "inputDim": TARGET_INPUT_DIM,
        "baseInputDim": base.BASE_INPUT_DIM,
        "baseModelInputDim": TARGET_BASE_INPUT_DIM,
        "outputDim": TARGET_OUTPUT_DIM,
        "boardSize": base.BOARD_SIZE,
        "paddedBoardMinCoord": base.PADDED_BOARD_MIN,
        "paddedBoardMaxCoord": base.PADDED_BOARD_MAX,
        "paddedBoardSize": base.PADDED_BOARD_SIZE,
        "boardEnvelopeField": "boardEnvelope",
        "boardMinRowField": "boardMinRow",
        "boardMinColField": "boardMinCol",
        "actionSpace": "pending_target_padded10",
        "pendingTypes": TARGET_PENDING_TYPES,
        "cardActionIds": base.CARD_ACTION_IDS,
        "featureSpec": [
            "board_padded_10x10_perspective_flat",
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
            "pending_type_onehot",
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
            "resumeCheckpoint": (args.resume_checkpoint or "").strip() or None,
            "resumeOptimizer": bool(args.resume_optimizer),
            "checkpointOut": (args.checkpoint_out or "").strip() or None,
        },
        "stats": {
            "recordsRead": data.records_read,
            "trainRecords": data.train_records,
            "targetRecords": data.target_records,
            "winnerRecords": data.winner_records,
            "loserRecords": data.loser_records,
            "drawRecords": data.draw_records,
            "tacticalMissRecords": data.tactical_miss_records,
            "trainTargetAccuracy": train_summary.target_acc,
            "trainTargetSamples": train_summary.target_samples,
        },
    }
    trainer_common.write_json_payload(path, payload)


def maybe_write_checkpoint(
    checkpoint_out: str,
    model: nn.Module,
    optimizer: torch.optim.Optimizer,
    args: argparse.Namespace,
    data: TargetDatasetBundle,
    train_summary: TargetTrainSummary,
    device: str,
    resumed_from: str | None,
) -> None:
    payload = trainer_common.build_model_checkpoint_payload(
        MODEL_SCHEMA_VERSION,
        model,
        optimizer,
        {
            "inputDim": TARGET_INPUT_DIM,
            "baseInputDim": base.BASE_INPUT_DIM,
            "baseModelInputDim": TARGET_BASE_INPUT_DIM,
            "targetOutputDim": TARGET_OUTPUT_DIM,
            "boardSize": base.BOARD_SIZE,
            "paddedBoardMinCoord": base.PADDED_BOARD_MIN,
            "paddedBoardMaxCoord": base.PADDED_BOARD_MAX,
            "paddedBoardSize": base.PADDED_BOARD_SIZE,
            "pendingTypes": TARGET_PENDING_TYPES,
            "cardActionIds": base.CARD_ACTION_IDS,
        },
        {
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
            "resumedFrom": resumed_from,
            "resumeOptimizer": bool(args.resume_optimizer),
        },
        {
            "recordsRead": int(data.records_read),
            "trainRecords": int(data.train_records),
            "targetRecords": int(data.target_records),
            "winnerRecords": int(data.winner_records),
            "loserRecords": int(data.loser_records),
            "drawRecords": int(data.draw_records),
            "tacticalMissRecords": int(data.tactical_miss_records),
            "trainTargetAccuracy": float(train_summary.target_acc),
            "trainTargetSamples": int(train_summary.target_samples),
        },
    )
    trainer_common.write_model_checkpoint(checkpoint_out, payload)


def main() -> int:
    args = parse_args()
    device = base.choose_device(str(args.device).strip().lower())
    meta_out = trainer_common.resolve_meta_output_path(args.meta_out, args.onnx_out)

    data = load_target_dataset(args)
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
        "[train_target_onnx] "
        f"records={data.records_read} "
        f"train_records={data.train_records} "
        f"target_records={data.target_records} "
        f"winner_records={data.winner_records} "
        f"loser_records={data.loser_records} "
        f"draw_records={data.draw_records} "
        f"tactical_miss_records={data.tactical_miss_records} "
        f"train_target_acc={train_summary.target_acc:.3f} "
        f"onnx={args.onnx_out}"
    )
    print(f"[train_target_onnx] meta={meta_out}")
    if (args.checkpoint_out or "").strip():
        print(f"[train_target_onnx] checkpoint={args.checkpoint_out}")
    if (args.metrics_out or "").strip():
        print(f"[train_target_onnx] metrics={args.metrics_out}")
    if resumed_from:
        print(f"[train_target_onnx] resumed_from={resumed_from}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
