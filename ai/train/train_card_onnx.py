#!/usr/bin/env python3
# pyright: reportUnknownMemberType=false, reportUnknownVariableType=false, reportUnknownArgumentType=false, reportUnknownParameterType=false, reportMissingTypeArgument=false
"""Train a card-specialist PyTorch network and export ONNX."""

from __future__ import annotations

import argparse
import json
import os
from dataclasses import dataclass
from typing import Any

import torch
from torch import nn
from torch.nn import functional as F

import train_policy_onnx as base


MODEL_SCHEMA_VERSION = base.MODEL_SCHEMA_VERSION


@dataclass
class CardDatasetBundle:
    x: torch.Tensor
    y_card: torch.Tensor
    sample_weight: torch.Tensor
    records_read: int
    train_records: int
    card_records: int
    winner_records: int
    loser_records: int
    draw_records: int
    tactical_miss_records: int


@dataclass
class CardTrainSummary:
    card_acc: float
    card_samples: int


class CardNet(nn.Module):
    def __init__(self, input_dim: int, hidden_size: int, card_output_dim: int):
        super().__init__()
        self.backbone = nn.Sequential(
            nn.Linear(input_dim, hidden_size),
            nn.ReLU(),
            nn.Linear(hidden_size, hidden_size),
            nn.ReLU(),
        )
        self.card_head = nn.Linear(hidden_size, card_output_dim)

    def forward(self, obs: torch.Tensor):
        features = self.backbone(obs)
        return self.card_head(features)


def accuracy_from_logits(logits: torch.Tensor, target: torch.Tensor) -> tuple[int, int]:
    mask = target != base.IGNORE_INDEX
    samples = int(mask.sum().item())
    if samples <= 0:
        return 0, 0
    pred = torch.argmax(logits, dim=1)
    correct = int((pred[mask] == target[mask]).sum().item())
    return correct, samples


def build_card_class_weights(
    y_card_train: torch.Tensor,
    device: str,
    no_action_weight: float,
    balance_power: float,
) -> torch.Tensor | None:
    valid = y_card_train[y_card_train != base.IGNORE_INDEX]
    if int(valid.numel()) <= 0:
        return None

    weights = torch.ones((base.CARD_ACTION_DIM,), dtype=torch.float32)
    if balance_power > 0:
        valid_cpu = valid.detach().to("cpu")
        class_ids, class_counts = torch.unique(valid_cpu, return_counts=True)
        if int(class_counts.numel()) > 0:
            max_count = float(torch.max(class_counts).item())
            for idx_tensor, count_tensor in zip(class_ids, class_counts):
                idx = int(idx_tensor.item())
                count = max(1.0, float(count_tensor.item()))
                inv_freq = max_count / count
                weights[idx] = float(inv_freq ** balance_power)

    if base.NO_CARD_ACTION_INDEX is not None:
        weights[int(base.NO_CARD_ACTION_INDEX)] *= float(no_action_weight)

    weights = torch.clamp(weights, min=0.2, max=6.0)
    mean_w = float(torch.mean(weights).item())
    if mean_w > 0:
        weights = weights / mean_w
    return weights.to(device)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Train specialist ONNX card model from self-play NDJSON.")
    p.add_argument("--input", required=True, help="Path to NDJSON self-play data.")
    p.add_argument(
        "--onnx-out",
        default=os.path.join("data", "models", "policy-card.onnx"),
        help="Output ONNX path.",
    )
    p.add_argument(
        "--meta-out",
        default=None,
        help="Output metadata JSON path (default: <onnx-out>.meta.json).",
    )
    p.add_argument("--epochs", type=int, default=8, help="Training epochs (default: 8).")
    p.add_argument("--batch-size", type=int, default=2048, help="Batch size (default: 2048).")
    p.add_argument("--lr", type=float, default=1e-3, help="Learning rate (default: 1e-3).")
    p.add_argument("--hidden-size", type=int, default=256, help="MLP hidden size (default: 256).")
    p.add_argument("--seed", type=int, default=7, help="Random seed (default: 7).")
    p.add_argument(
        "--val-split",
        type=float,
        default=0.1,
        help="Validation split ratio in [0,0.5). Default: 0.1",
    )
    p.add_argument(
        "--early-stop-patience",
        type=int,
        default=0,
        help="Stop if monitored metric does not improve for N epochs (default: 0=disabled).",
    )
    p.add_argument(
        "--early-stop-min-delta",
        type=float,
        default=0.0,
        help="Minimum metric improvement to reset early-stop counter (default: 0.0).",
    )
    p.add_argument(
        "--early-stop-min-epochs",
        type=int,
        default=0,
        help="Do not allow early-stop before this epoch (default: 0).",
    )
    p.add_argument(
        "--early-stop-monitor",
        default="val_loss",
        help="Metric for early stopping: val_loss/train_loss (default: val_loss).",
    )
    p.add_argument(
        "--early-stop-smoothing-window",
        type=int,
        default=1,
        help="Moving-average window for early-stop monitor (default: 1=disabled).",
    )
    p.add_argument(
        "--log-interval-steps",
        type=int,
        default=0,
        help="If > 0, print batch loss every N steps (default: 0=off).",
    )
    p.add_argument(
        "--metrics-out",
        default="",
        help="Optional JSONL path for per-epoch metrics.",
    )
    p.add_argument(
        "--resume-checkpoint",
        default="",
        help="Optional checkpoint path to resume model/optimizer state from.",
    )
    p.add_argument(
        "--resume-optimizer",
        action="store_true",
        help="When set, also restore optimizer state from checkpoint (default: off).",
    )
    p.add_argument(
        "--checkpoint-out",
        default="",
        help="Optional checkpoint output path (.pt).",
    )
    p.add_argument(
        "--device",
        default="auto",
        help="Device: auto/cpu/cuda (default: auto).",
    )
    p.add_argument(
        "--card-no-action-weight",
        type=float,
        default=0.7,
        help="Relative class weight for __no_card__ label in card head (default: 0.7).",
    )
    p.add_argument(
        "--card-class-balance-power",
        type=float,
        default=0.25,
        help="Inverse-frequency balance strength for card classes in [0,1] (default: 0.25).",
    )
    p.add_argument(
        "--winner-sample-boost",
        type=float,
        default=0.35,
        help="Extra sample weight added to winner-side records (default: 0.35).",
    )
    p.add_argument(
        "--loser-sample-weight",
        type=float,
        default=0.8,
        help="Sample weight used for loser-side records (default: 0.8).",
    )
    p.add_argument(
        "--draw-sample-weight",
        type=float,
        default=1.0,
        help="Sample weight used for draw records (default: 1.0).",
    )
    p.add_argument(
        "--corner-emergency-sample-boost",
        type=float,
        default=0.0,
        help="Extra sample weight boost added when cornerEmergency is active (default: 0.0).",
    )
    p.add_argument(
        "--negative-future-disc-sample-boost",
        type=float,
        default=0.0,
        help="Extra sample weight boost added when futureDiscDelta3Ply is below threshold (default: 0.0).",
    )
    p.add_argument(
        "--negative-future-disc-threshold",
        type=float,
        default=-1.0,
        help="Danger threshold for futureDiscDelta3Ply (default: -1.0).",
    )
    p.add_argument(
        "--tactical-miss-sample-boost",
        type=float,
        default=0.0,
        help="Extra sample weight boost when tacticalScoreMissRatio exceeds threshold (default: 0.0).",
    )
    p.add_argument(
        "--tactical-miss-threshold",
        type=float,
        default=0.08,
        help="Threshold for tacticalScoreMissRatio danger boost (default: 0.08).",
    )
    p.add_argument(
        "--hand-pressure-sample-boost",
        type=float,
        default=0.0,
        help="Extra sample weight boost when handCards length is >= 4 (default: 0.0).",
    )
    p.add_argument(
        "--pending-target-sample-boost",
        type=float,
        default=0.0,
        help="Extra sample weight boost when pendingType is active (default: 0.0).",
    )
    return p.parse_args()


def load_card_dataset(args: argparse.Namespace) -> CardDatasetBundle:
    source = base.load_dataset(
        args.input,
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
    mask = source.y_card != base.IGNORE_INDEX
    train_records = int(mask.sum().item())
    if train_records <= 0:
        raise ValueError("no card training records were found in input data")
    return CardDatasetBundle(
        x=source.x[mask],
        y_card=source.y_card[mask],
        sample_weight=source.sample_weight[mask],
        records_read=source.records_read,
        train_records=train_records,
        card_records=train_records,
        winner_records=source.winner_records,
        loser_records=source.loser_records,
        draw_records=source.draw_records,
        tactical_miss_records=source.tactical_miss_records,
    )


def train_model(
    data: CardDatasetBundle,
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
    card_no_action_weight: float,
    card_class_balance_power: float,
) -> tuple[nn.Module, torch.optim.Optimizer, CardTrainSummary, str | None, list[dict[str, Any]]]:
    if base.CARD_ACTION_DIM <= 0:
        raise ValueError("card action space is empty")
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
    if card_no_action_weight <= 0:
        raise ValueError("--card-no-action-weight must be > 0")
    if card_class_balance_power < 0 or card_class_balance_power > 1:
        raise ValueError("--card-class-balance-power must be in [0,1]")
    monitor = str(early_stop_monitor or "").strip().lower()
    if monitor not in ("val_loss", "train_loss"):
        raise ValueError("--early-stop-monitor must be val_loss/train_loss")

    torch.manual_seed(seed)
    if device == "cuda":
        torch.cuda.manual_seed_all(seed)

    model = CardNet(base.INPUT_DIM, hidden_size, base.CARD_ACTION_DIM).to(device)
    x = data.x.to(device)
    y_card = data.y_card.to(device)
    sample_weight = data.sample_weight.to(device)
    opt = torch.optim.Adam(model.parameters(), lr=lr)
    resumed_from: str | None = None

    resume_path = (resume_checkpoint or "").strip()
    if resume_path:
        if not os.path.exists(resume_path):
            raise ValueError(f"resume checkpoint not found: {resume_path}")
        ckpt = torch.load(resume_path, map_location=device)
        state = ckpt.get("model_state") if isinstance(ckpt, dict) else None
        if state is None and isinstance(ckpt, dict):
            state = ckpt
        if not isinstance(state, dict):
            raise ValueError(f"invalid checkpoint format: {resume_path}")
        try:
            model.load_state_dict(state)
        except Exception as exc:
            msg = str(exc)
            if "size mismatch for" in msg or "Missing key(s) in state_dict" in msg or "Unexpected key(s) in state_dict" in msg:
                print(f"[train_card_onnx] resume checkpoint incompatible; ignored: {resume_path} ({msg})", flush=True)
                ckpt = None
                state = None
            else:
                raise ValueError(f"failed to load model checkpoint: {resume_path}: {exc}") from exc
        if resume_optimizer and isinstance(ckpt, dict) and state is not None:
            optimizer_state = ckpt.get("optimizer_state")
            if optimizer_state:
                try:
                    opt.load_state_dict(optimizer_state)
                except Exception:
                    pass
        if state is not None:
            resumed_from = resume_path

    n = x.shape[0]
    all_perm = torch.randperm(n, device=device)
    val_size = int(n * val_split)
    if val_size > 0:
        val_idx = all_perm[:val_size]
        train_idx = all_perm[val_size:]
    else:
        val_idx = torch.empty((0,), dtype=torch.long, device=device)
        train_idx = all_perm
    if train_idx.shape[0] <= 0:
        raise ValueError("training split became empty; reduce --val-split")

    x_train = x[train_idx]
    y_card_train = y_card[train_idx]
    sample_weight_train = sample_weight[train_idx]
    x_val = x[val_idx] if val_idx.shape[0] > 0 else None
    y_card_val = y_card[val_idx] if val_idx.shape[0] > 0 else None
    train_n = int(x_train.shape[0])
    card_class_weights = build_card_class_weights(
        y_card_train=y_card_train,
        device=device,
        no_action_weight=card_no_action_weight,
        balance_power=card_class_balance_power,
    )
    if card_class_weights is None:
        raise ValueError("no valid card classes were found in training split")
    if base.NO_CARD_ACTION_INDEX is not None:
        print(
            "[train_card_onnx] "
            f"card_class_weights enabled no_card_weight={float(card_class_weights[int(base.NO_CARD_ACTION_INDEX)].item()):.4f} "
            f"balance_power={card_class_balance_power:.3f}",
            flush=True,
        )

    epoch_metrics: list[dict[str, Any]] = []
    global_step = 0
    best_monitor = float("inf")
    best_epoch = 0
    no_improve_count = 0
    stopped_early = False
    early_stop_epoch = None
    best_state: dict[str, Any] | None = None
    monitor_window_values: list[float] = []

    for epoch_index in range(epochs):
        perm = torch.randperm(train_n, device=device)
        x_epoch = x_train[perm]
        y_card_epoch = y_card_train[perm]
        sample_weight_epoch = sample_weight_train[perm]
        epoch_loss_sum = 0.0
        epoch_samples = 0
        epoch_card_correct = 0
        epoch_card_samples = 0

        for i in range(0, train_n, batch_size):
            xb = x_epoch[i:i + batch_size]
            yb_card = y_card_epoch[i:i + batch_size]
            wb = sample_weight_epoch[i:i + batch_size]
            card_logits = model(xb)

            card_loss_raw = F.cross_entropy(
                card_logits,
                yb_card,
                weight=card_class_weights,
                reduction="none",
            )
            card_weight_sum = torch.clamp(wb.sum(), min=1.0)
            loss = torch.sum(card_loss_raw * wb) / card_weight_sum

            with torch.no_grad():
                card_correct, card_samples = accuracy_from_logits(card_logits, yb_card)
                epoch_card_correct += card_correct
                epoch_card_samples += card_samples
                batch_size_now = int(yb_card.shape[0])
                epoch_samples += batch_size_now
                epoch_loss_sum += float(loss.item()) * batch_size_now
            opt.zero_grad(set_to_none=True)
            loss.backward()
            opt.step()
            global_step += 1
            if log_interval_steps > 0 and (global_step % log_interval_steps) == 0:
                print(
                    f"[train_card_onnx] step={global_step} epoch={epoch_index + 1}/{epochs} loss={float(loss.item()):.6f}",
                    flush=True,
                )

        train_loss = epoch_loss_sum / max(1, epoch_samples)
        train_card_acc = epoch_card_correct / max(1, epoch_card_samples)
        val_loss = None
        val_card_acc = None
        if x_val is not None and y_card_val is not None and int(y_card_val.shape[0]) > 0:
            with torch.no_grad():
                val_card_logits = model(x_val)
                val_loss_t = F.cross_entropy(val_card_logits, y_card_val, weight=card_class_weights)
                val_loss = float(val_loss_t.item())
                val_card_correct, val_card_samples = accuracy_from_logits(val_card_logits, y_card_val)
                val_card_acc = val_card_correct / max(1, val_card_samples)

        monitor_raw_value = val_loss if (monitor == "val_loss" and val_loss is not None) else train_loss
        monitor_window_values.append(float(monitor_raw_value))
        if len(monitor_window_values) > early_stop_smoothing_window:
            monitor_window_values.pop(0)
        monitor_value = float(sum(monitor_window_values) / len(monitor_window_values))

        improved = (best_monitor - monitor_value) > early_stop_min_delta
        if improved:
            best_monitor = monitor_value
            best_epoch = epoch_index + 1
            no_improve_count = 0
            best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}
        else:
            no_improve_count += 1

        epoch_metrics.append(
            {
                "epoch": epoch_index + 1,
                "epochs": epochs,
                "globalStep": global_step,
                "avgLoss": train_loss,
                "trainLoss": train_loss,
                "trainCardAcc": train_card_acc,
                "valLoss": val_loss,
                "valCardAcc": val_card_acc,
                "monitor": monitor,
                "monitorRawValue": monitor_raw_value,
                "monitorValue": monitor_value,
                "monitorSmoothingWindow": early_stop_smoothing_window,
                "bestMonitor": best_monitor,
                "bestEpoch": best_epoch,
                "noImproveCount": no_improve_count,
                "cardNoActionWeight": card_no_action_weight,
                "cardClassBalancePower": card_class_balance_power,
            }
        )

        parts = [
            f"[train_card_onnx] epoch={epoch_index + 1}/{epochs}",
            f"avg_loss={train_loss:.6f}",
            f"train_card_acc={train_card_acc:.3f}",
        ]
        if val_loss is not None:
            parts.append(f"val_loss={val_loss:.6f}")
        if val_card_acc is not None:
            parts.append(f"val_card_acc={val_card_acc:.3f}")
        parts.append(f"monitor={monitor}")
        if early_stop_smoothing_window > 1:
            parts.append(f"monitor_value_sma={monitor_value:.6f}")
        else:
            parts.append(f"monitor_value={monitor_value:.6f}")
        print(" ".join(parts), flush=True)

        reached_min_epochs = (epoch_index + 1) >= early_stop_min_epochs
        if early_stop_patience > 0 and reached_min_epochs and no_improve_count >= early_stop_patience:
            stopped_early = True
            early_stop_epoch = epoch_index + 1
            print(
                f"[train_card_onnx] early-stop triggered at epoch={early_stop_epoch} "
                f"best_epoch={best_epoch} best_{monitor}={best_monitor:.6f} "
                f"smoothing_window={early_stop_smoothing_window}",
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
        card_correct_all, card_samples_all = accuracy_from_logits(logits_all, y_card)

    summary = CardTrainSummary(
        card_acc=(card_correct_all / max(1, card_samples_all)),
        card_samples=card_samples_all,
    )
    return model, opt, summary, resumed_from, epoch_metrics


def export_onnx(model: nn.Module, onnx_out: str) -> None:
    os.makedirs(os.path.dirname(onnx_out) or ".", exist_ok=True)
    model.eval()
    dummy = torch.zeros((1, base.INPUT_DIM), dtype=torch.float32)
    torch.onnx.export(
        model.cpu(),
        (dummy,),
        onnx_out,
        input_names=["obs"],
        output_names=["card_logits"],
        dynamic_axes={
            "obs": {0: "batch"},
            "card_logits": {0: "batch"},
        },
        opset_version=17,
    )


def write_meta(
    path: str,
    args: argparse.Namespace,
    data: CardDatasetBundle,
    train_summary: CardTrainSummary,
    device: str,
) -> None:
    payload = {
        "schemaVersion": MODEL_SCHEMA_VERSION,
        "inputName": "obs",
        "outputName": "card_logits",
        "outputNames": ["card_logits"],
        "cardOutputName": "card_logits",
        "inputDim": base.INPUT_DIM,
        "baseInputDim": base.BASE_INPUT_DIM,
        "outputDim": base.CARD_ACTION_DIM,
        "cardOutputDim": base.CARD_ACTION_DIM,
        "boardSize": base.BOARD_SIZE,
        "actionSpace": "card_choice",
        "cardActionIds": base.CARD_ACTION_IDS,
        "cardDecisionKinds": ["keep", "use", "destroy", "sell"],
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
            "card_candidate_mask",
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
            "cardNoActionWeight": args.card_no_action_weight,
            "cardClassBalancePower": args.card_class_balance_power,
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
            "cardRecords": data.card_records,
            "winnerRecords": data.winner_records,
            "loserRecords": data.loser_records,
            "drawRecords": data.draw_records,
            "tacticalMissRecords": data.tactical_miss_records,
            "trainCardAccuracy": train_summary.card_acc,
            "trainCardSamples": train_summary.card_samples,
        },
    }
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)


def maybe_write_checkpoint(
    checkpoint_out: str,
    model: nn.Module,
    optimizer: torch.optim.Optimizer,
    args: argparse.Namespace,
    data: CardDatasetBundle,
    train_summary: CardTrainSummary,
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
            "inputDim": base.INPUT_DIM,
            "baseInputDim": base.BASE_INPUT_DIM,
            "cardOutputDim": base.CARD_ACTION_DIM,
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
            "cardNoActionWeight": float(args.card_no_action_weight),
            "cardClassBalancePower": float(args.card_class_balance_power),
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
        "stats": {
            "recordsRead": int(data.records_read),
            "trainRecords": int(data.train_records),
            "cardRecords": int(data.card_records),
            "winnerRecords": int(data.winner_records),
            "loserRecords": int(data.loser_records),
            "drawRecords": int(data.draw_records),
            "tacticalMissRecords": int(data.tactical_miss_records),
            "trainCardAccuracy": float(train_summary.card_acc),
            "trainCardSamples": int(train_summary.card_samples),
        },
    }
    torch.save(payload, out)


def main() -> int:
    args = parse_args()
    device = base.choose_device(str(args.device).strip().lower())
    meta_out = args.meta_out or (args.onnx_out + ".meta.json")

    data = load_card_dataset(args)
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
        card_no_action_weight=float(args.card_no_action_weight),
        card_class_balance_power=float(args.card_class_balance_power),
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
        "[train_card_onnx] "
        f"records={data.records_read} "
        f"train_records={data.train_records} "
        f"card_records={data.card_records} "
        f"winner_records={data.winner_records} "
        f"loser_records={data.loser_records} "
        f"draw_records={data.draw_records} "
        f"tactical_miss_records={data.tactical_miss_records} "
        f"train_card_acc={train_summary.card_acc:.3f} "
        f"onnx={args.onnx_out}"
    )
    print(f"[train_card_onnx] meta={meta_out}")
    if (args.checkpoint_out or "").strip():
        print(f"[train_card_onnx] checkpoint={args.checkpoint_out}")
    if (args.metrics_out or "").strip():
        print(f"[train_card_onnx] metrics={args.metrics_out}")
    if resumed_from:
        print(f"[train_card_onnx] resumed_from={resumed_from}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
