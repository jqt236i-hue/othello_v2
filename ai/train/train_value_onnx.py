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

import onnx_trainer_common as trainer_common
import train_policy_onnx as base


MODEL_SCHEMA_VERSION = base.MODEL_SCHEMA_VERSION
VALUE_INPUT_DIM = base.INPUT_DIM


@dataclass
class ValueDatasetBundle:
    x: torch.Tensor
    y_value: torch.Tensor
    sample_weight: torch.Tensor
    split_group_keys: list[str | None]
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
    trainer_common.add_common_args(
        parser,
        onnx_out_default=os.path.join("data", "models", "policy-value.onnx"),
        include_balance_boosts=True,
    )
    # Value-specific args
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
    split_group_keys: list[str | None] = []
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
            split_group_keys.append(trainer_common.build_record_group_key(rec))
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
        split_group_keys=split_group_keys,
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
    val_split_mode: str,
    early_stop_patience: int,
    early_stop_min_delta: float,
    early_stop_min_epochs: int,
    early_stop_monitor: str,
    early_stop_smoothing_window: int,
    resume_checkpoint: str,
    resume_optimizer: bool,
    log_interval_steps: int,
) -> tuple[nn.Module, torch.optim.Optimizer, ValueTrainSummary, str | None, list[dict[str, Any]], dict[str, Any]]:
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

    model = ValueNet(VALUE_INPUT_DIM, hidden_size).to(device)
    x = data.x.to(device)
    y_value = data.y_value.to(device)
    sample_weight = data.sample_weight.to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    resumed_from = trainer_common.apply_resume_checkpoint(
        "train_value_onnx", model, optimizer, resume_checkpoint, resume_optimizer, device,
    )

    train_indices, val_indices, split_summary = trainer_common.resolve_train_val_split(
        int(x.shape[0]),
        val_split,
        device,
        seed=seed,
        split_mode=val_split_mode,
        split_group_keys=data.split_group_keys,
    )

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
    return model, optimizer, summary, resumed_from, epoch_metrics, split_summary


def export_onnx(model: nn.Module, onnx_out: str) -> None:
    trainer_common.export_onnx_model(
        model, onnx_out, VALUE_INPUT_DIM,
        output_names=["value"],
        dynamic_axes={"obs": {0: "batch"}, "value": {0: "batch"}},
    )


def write_meta(
    path: str,
    args: argparse.Namespace,
    data: ValueDatasetBundle,
    train_summary: ValueTrainSummary,
    device: str,
    split_summary: dict[str, Any] | None,
) -> None:
    feature_spec = list(trainer_common.BASE_FEATURE_SPEC) + [
        "hand_card_counts_norm",
        "usable_card_mask",
    ]
    training = trainer_common.build_common_training_meta(args, device)
    trainer_common.apply_split_summary_meta(training, split_summary)
    training.update({
        "valueTargetCornerWeight": args.value_target_corner_weight,
        "valueTargetEdgeWeight": args.value_target_edge_weight,
        "valueTargetEconomyWeight": args.value_target_economy_weight,
        "valueTargetCornerEmergencyWeight": args.value_target_corner_emergency_weight,
    })
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
        "paddedBoardMinCoord": base.PADDED_BOARD_MIN,
        "paddedBoardMaxCoord": base.PADDED_BOARD_MAX,
        "paddedBoardSize": base.PADDED_BOARD_SIZE,
        "boardEnvelopeField": "boardEnvelope",
        "boardMinRowField": "boardMinRow",
        "boardMinColField": "boardMinCol",
        "actionSpace": "position_value",
        "cardActionIds": base.CARD_ACTION_IDS,
        "valueRange": [-1, 1],
        **trainer_common.build_deck_count_feature_meta(),
        "featureSpec": feature_spec,
        "training": training,
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
    trainer_common.write_json_payload(path, payload)


def maybe_write_checkpoint(
    checkpoint_out: str,
    model: nn.Module,
    optimizer: torch.optim.Optimizer,
    args: argparse.Namespace,
    data: ValueDatasetBundle,
    train_summary: ValueTrainSummary,
    device: str,
    resumed_from: str | None,
    split_summary: dict[str, Any] | None,
) -> None:
    ckpt_training = trainer_common.build_common_checkpoint_training(args, device, resumed_from)
    trainer_common.apply_split_summary_meta(ckpt_training, split_summary)
    ckpt_training.update({
        "valueTargetCornerWeight": float(args.value_target_corner_weight),
        "valueTargetEdgeWeight": float(args.value_target_edge_weight),
        "valueTargetEconomyWeight": float(args.value_target_economy_weight),
        "valueTargetCornerEmergencyWeight": float(args.value_target_corner_emergency_weight),
    })
    payload = trainer_common.build_model_checkpoint_payload(
        MODEL_SCHEMA_VERSION,
        model,
        optimizer,
        {
            "inputDim": VALUE_INPUT_DIM,
            "baseInputDim": base.BASE_INPUT_DIM,
            "outputDim": 1,
            "boardSize": base.BOARD_SIZE,
            "paddedBoardMinCoord": base.PADDED_BOARD_MIN,
            "paddedBoardMaxCoord": base.PADDED_BOARD_MAX,
            "paddedBoardSize": base.PADDED_BOARD_SIZE,
            "cardActionIds": base.CARD_ACTION_IDS,
            **trainer_common.build_deck_count_feature_meta(),
        },
        ckpt_training,
        {
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
    )
    trainer_common.write_model_checkpoint(checkpoint_out, payload)


def main() -> int:
    args = parse_args()
    trainer_common.validate_sample_weight_args(args)
    device = base.choose_device(str(args.device).strip().lower())
    meta_out = trainer_common.resolve_meta_output_path(args.meta_out, args.onnx_out)

    data = load_value_dataset(args)
    model, optimizer, train_summary, resumed_from, epoch_metrics, split_summary = train_model(
        data=data,
        epochs=int(args.epochs),
        batch_size=int(args.batch_size),
        lr=float(args.lr),
        hidden_size=int(args.hidden_size),
        device=device,
        seed=int(args.seed),
        val_split=float(args.val_split),
        val_split_mode=str(args.val_split_mode or ""),
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
    write_meta(meta_out, args, data, train_summary, device, split_summary)
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
        split_summary=split_summary,
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
