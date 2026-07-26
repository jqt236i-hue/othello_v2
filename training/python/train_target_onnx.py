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
    "SWAP_WITH_ENEMY",
    "POSITION_SWAP_WILL",
    "TRAP_WILL",
    "TEMPT_WILL",
    "GUARD_WILL",
    "GUARDIAN_GOD",
    "EXTEND_LIFE_WILL",
    "CORROSION_WILL",
    "TIME_BOMB",
    "CLONE_WILL",
    "TELEPORT_WILL",
    "CELL_TELEPORT_WILL",
    # Expansion sockets are identified by (row, col, directionKey), while this
    # head is coordinate-only. Keep them on the direction-aware heuristic lane.
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
    split_group_keys: list[str | None]
    records_read: int
    train_records: int
    target_records: int
    winner_records: int
    loser_records: int
    draw_records: int
    tactical_miss_records: int
    board_input_filter: dict[str, Any]


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
    return trainer_common.accuracy_from_logits(logits, target, base.IGNORE_INDEX)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train pending-target ONNX model from self-play NDJSON.")
    trainer_common.add_common_args(
        parser,
        onnx_out_default=os.path.join("data", "models", "policy-target.onnx"),
        include_balance_boosts=True,
    )
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
    split_group_keys: list[str | None] = []
    records_read = 0
    target_records = 0
    winner_records = 0
    loser_records = 0
    draw_records = 0
    tactical_miss_records = 0
    board_input_diagnostics = trainer_common.BoardInputFilterDiagnostics()

    with open(args.input, "r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            records_read += 1
            rec = json.loads(line)
            if not board_input_diagnostics.inspect(rec).accepted:
                continue
            target_t = target_index(rec)
            if target_t is None:
                continue

            xs.append(feature_vector(rec))
            y_target.append(target_t)
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
        trainer_common.raise_no_training_records(
            "no coordinate-based pending target records were found in input data",
            board_input_diagnostics,
        )

    return TargetDatasetBundle(
        x=torch.tensor(xs, dtype=torch.float32),
        y_target=torch.tensor(y_target, dtype=torch.long),
        sample_weight=torch.tensor(sample_weight, dtype=torch.float32),
        split_group_keys=split_group_keys,
        records_read=records_read,
        train_records=target_records,
        target_records=target_records,
        winner_records=winner_records,
        loser_records=loser_records,
        draw_records=draw_records,
        tactical_miss_records=tactical_miss_records,
        board_input_filter=board_input_diagnostics.to_meta(),
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
    val_split_mode: str,
    early_stop_patience: int,
    early_stop_min_delta: float,
    early_stop_min_epochs: int,
    early_stop_monitor: str,
    early_stop_smoothing_window: int,
    lr_plateau_patience: int,
    lr_plateau_factor: float,
    lr_plateau_min_lr: float,
    resume_checkpoint: str,
    resume_optimizer: bool,
    log_interval_steps: int,
) -> tuple[nn.Module, torch.optim.Optimizer, TargetTrainSummary, str | None, list[dict[str, Any]], dict[str, Any]]:
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
    trainer_common.validate_lr_plateau_args(
        lr_plateau_patience=lr_plateau_patience,
        lr_plateau_factor=lr_plateau_factor,
        lr_plateau_min_lr=lr_plateau_min_lr,
    )
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
    resumed_from = trainer_common.apply_resume_checkpoint(
        "train_target_onnx", model, optimizer, resume_checkpoint, resume_optimizer, device,
        expected_board_input_contract=trainer_common.BOARD_INPUT_CONTRACT_SCHEMA,
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
    y_train = y_target[train_indices]
    w_train = sample_weight[train_indices]
    x_val = x[val_indices] if int(val_indices.numel()) > 0 else None
    y_val = y_target[val_indices] if int(val_indices.numel()) > 0 else None
    w_val = sample_weight[val_indices] if int(val_indices.numel()) > 0 else None

    control = trainer_common.create_monitor_control_state()
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

        control_update = trainer_common.advance_monitor_control_state(
            control,
            model=model,
            optimizer=optimizer,
            epoch_number=epoch_index + 1,
            monitor_value=effective_monitor,
            early_stop_min_delta=early_stop_min_delta,
            lr_plateau_patience=lr_plateau_patience,
            lr_plateau_factor=lr_plateau_factor,
            lr_plateau_min_lr=lr_plateau_min_lr,
        )
        if control_update.lr_reduced:
            print(
                f"[train_target_onnx] lr-reduce epoch={epoch_index + 1} "
                f"old_lr={control_update.old_lr:.8f} new_lr={control_update.current_lr:.8f} drops={control.lr_drop_count}",
                flush=True,
            )
        metric_entry.update(
            trainer_common.build_monitor_control_metrics(control, current_lr=control_update.current_lr)
        )

        reached_min_epochs = (epoch_index + 1) >= early_stop_min_epochs
        if early_stop_patience > 0 and reached_min_epochs and control.no_improve_count >= early_stop_patience:
            stopped_early = True
            early_stop_epoch = epoch_index + 1
            print(
                f"[train_target_onnx] early-stop triggered at epoch={early_stop_epoch} best_epoch={control.best_epoch} best_{monitor}={control.best_monitor:.6f}",
                flush=True,
            )
            break

    trainer_common.restore_best_training_state(model, optimizer, control.best_state, control.best_optimizer_state)
    trainer_common.finalize_monitor_control_metrics(
        epoch_metrics,
        control,
        stopped_early=stopped_early,
        early_stop_epoch=early_stop_epoch,
    )

    with torch.no_grad():
        logits_all = model(x)
        target_correct_all, target_samples_all = accuracy_from_logits(logits_all, y_target)

    summary = TargetTrainSummary(
        target_acc=(target_correct_all / max(1, target_samples_all)),
        target_samples=target_samples_all,
    )
    return model, optimizer, summary, resumed_from, epoch_metrics, split_summary


def export_onnx(model: nn.Module, onnx_out: str) -> None:
    trainer_common.export_onnx_model(
        model, onnx_out, TARGET_INPUT_DIM,
        output_names=["target_logits"],
        dynamic_axes={"obs": {0: "batch"}, "target_logits": {0: "batch"}},
    )


def write_meta(
    path: str,
    args: argparse.Namespace,
    data: TargetDatasetBundle,
    train_summary: TargetTrainSummary,
    device: str,
    split_summary: dict[str, Any] | None,
) -> None:
    feature_spec = list(trainer_common.BASE_FEATURE_SPEC) + [
        "hand_card_counts_norm",
        "usable_card_mask",
        "pending_type_onehot",
    ]
    training = trainer_common.build_common_training_meta(args, device)
    trainer_common.apply_split_summary_meta(training, split_summary)
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
        **trainer_common.build_board_input_contract_meta(),
        "actionSpace": "pending_target_padded10",
        "pendingTypes": TARGET_PENDING_TYPES,
        "cardActionIds": base.CARD_ACTION_IDS,
        **trainer_common.build_deck_count_feature_meta(),
        "featureSpec": feature_spec,
        "training": training,
        "stats": {
            "recordsRead": data.records_read,
            "trainRecords": data.train_records,
            "targetRecords": data.target_records,
            "winnerRecords": data.winner_records,
            "loserRecords": data.loser_records,
            "drawRecords": data.draw_records,
            "tacticalMissRecords": data.tactical_miss_records,
            "boardInputFilter": data.board_input_filter,
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
    split_summary: dict[str, Any] | None,
) -> None:
    ckpt_training = trainer_common.build_common_checkpoint_training(args, device, resumed_from)
    trainer_common.apply_split_summary_meta(ckpt_training, split_summary)
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
            **trainer_common.build_board_input_contract_meta(),
            **trainer_common.build_deck_count_feature_meta(),
        },
        ckpt_training,
        {
            "recordsRead": int(data.records_read),
            "trainRecords": int(data.train_records),
            "targetRecords": int(data.target_records),
            "winnerRecords": int(data.winner_records),
            "loserRecords": int(data.loser_records),
            "drawRecords": int(data.draw_records),
            "tacticalMissRecords": int(data.tactical_miss_records),
            "boardInputFilter": data.board_input_filter,
            "trainTargetAccuracy": float(train_summary.target_acc),
            "trainTargetSamples": int(train_summary.target_samples),
        },
    )
    trainer_common.write_model_checkpoint(checkpoint_out, payload)


def main() -> int:
    args = parse_args()
    trainer_common.validate_sample_weight_args(args)
    device = base.choose_device(str(args.device).strip().lower())
    meta_out = trainer_common.resolve_meta_output_path(args.meta_out, args.onnx_out)

    data = load_target_dataset(args)
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
        lr_plateau_patience=int(args.lr_plateau_patience),
        lr_plateau_factor=float(args.lr_plateau_factor),
        lr_plateau_min_lr=float(args.lr_plateau_min_lr),
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
        "[train_target_onnx] "
        f"records={data.records_read} "
        f"train_records={data.train_records} "
        f"target_records={data.target_records} "
        f"winner_records={data.winner_records} "
        f"loser_records={data.loser_records} "
        f"draw_records={data.draw_records} "
        f"tactical_miss_records={data.tactical_miss_records} "
        f"board_rejected_records={data.board_input_filter['rejectedRecords']} "
        f"train_target_acc={train_summary.target_acc:.3f} "
        f"onnx={args.onnx_out}"
    )
    trainer_common.log_trainer_artifact_paths(
        "train_target_onnx",
        meta_out=meta_out,
        checkpoint_out=args.checkpoint_out,
        metrics_out=args.metrics_out,
        resumed_from=resumed_from,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
