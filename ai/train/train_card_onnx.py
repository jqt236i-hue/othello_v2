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

import onnx_trainer_common as trainer_common
import train_policy_onnx as base


MODEL_SCHEMA_VERSION = base.MODEL_SCHEMA_VERSION


@dataclass
class CardDatasetBundle:
    x: torch.Tensor
    y_card: torch.Tensor
    sample_weight: torch.Tensor
    split_group_keys: list[str | None]
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
    return trainer_common.accuracy_from_logits(logits, target, base.IGNORE_INDEX)


def build_card_class_weights(
    y_card_train: torch.Tensor,
    device: str,
    no_action_weight: float,
    balance_power: float,
) -> torch.Tensor | None:
    return trainer_common.build_card_class_weights(
        y_card_train, device, base.CARD_ACTION_DIM, base.NO_CARD_ACTION_INDEX,
        no_action_weight, balance_power,
    )


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Train specialist ONNX card model from self-play NDJSON.")
    trainer_common.add_common_args(
        p,
        onnx_out_default=os.path.join("data", "models", "policy-card.onnx"),
        include_balance_boosts=False,
    )
    # Card-specific args
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
        split_group_keys=[
            source.split_group_keys[index]
            for index, include in enumerate(mask.tolist())
            if include
        ],
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
    card_no_action_weight: float,
    card_class_balance_power: float,
) -> tuple[nn.Module, torch.optim.Optimizer, CardTrainSummary, str | None, list[dict[str, Any]], dict[str, Any]]:
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
    if card_no_action_weight <= 0:
        raise ValueError("--card-no-action-weight must be > 0")
    if card_class_balance_power < 0 or card_class_balance_power > 1:
        raise ValueError("--card-class-balance-power must be in [0,1]")
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

    model = CardNet(base.INPUT_DIM, hidden_size, base.CARD_ACTION_DIM).to(device)
    x = data.x.to(device)
    y_card = data.y_card.to(device)
    sample_weight = data.sample_weight.to(device)
    opt = torch.optim.Adam(model.parameters(), lr=lr)
    resumed_from = trainer_common.apply_resume_checkpoint(
        "train_card_onnx", model, opt, resume_checkpoint, resume_optimizer, device,
    )

    train_idx, val_idx, split_summary = trainer_common.resolve_train_val_split(
        int(x.shape[0]),
        val_split,
        device,
        seed=seed,
        split_mode=val_split_mode,
        split_group_keys=data.split_group_keys,
    )

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
    control = trainer_common.create_monitor_control_state()
    stopped_early = False
    early_stop_epoch = None
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

        control_update = trainer_common.advance_monitor_control_state(
            control,
            model=model,
            optimizer=opt,
            epoch_number=epoch_index + 1,
            monitor_value=monitor_value,
            early_stop_min_delta=early_stop_min_delta,
            lr_plateau_patience=lr_plateau_patience,
            lr_plateau_factor=lr_plateau_factor,
            lr_plateau_min_lr=lr_plateau_min_lr,
        )
        if control_update.lr_reduced:
            print(
                f"[train_card_onnx] lr-reduce epoch={epoch_index + 1} "
                f"old_lr={control_update.old_lr:.8f} new_lr={control_update.current_lr:.8f} drops={control.lr_drop_count}",
                flush=True,
            )
        current_lr = control_update.current_lr

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
                "cardNoActionWeight": card_no_action_weight,
                "cardClassBalancePower": card_class_balance_power,
                **trainer_common.build_monitor_control_metrics(control, current_lr=current_lr),
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
        parts.append(f"lr={current_lr:.8f}")
        print(" ".join(parts), flush=True)

        reached_min_epochs = (epoch_index + 1) >= early_stop_min_epochs
        if early_stop_patience > 0 and reached_min_epochs and control.no_improve_count >= early_stop_patience:
            stopped_early = True
            early_stop_epoch = epoch_index + 1
            print(
                f"[train_card_onnx] early-stop triggered at epoch={early_stop_epoch} "
                f"best_epoch={control.best_epoch} best_{monitor}={control.best_monitor:.6f} "
                f"smoothing_window={early_stop_smoothing_window}",
                flush=True,
            )
            break

    trainer_common.restore_best_training_state(model, opt, control.best_state, control.best_optimizer_state)
    trainer_common.finalize_monitor_control_metrics(
        epoch_metrics,
        control,
        stopped_early=stopped_early,
        early_stop_epoch=early_stop_epoch,
    )

    with torch.no_grad():
        logits_all = model(x)
        card_correct_all, card_samples_all = accuracy_from_logits(logits_all, y_card)

    summary = CardTrainSummary(
        card_acc=(card_correct_all / max(1, card_samples_all)),
        card_samples=card_samples_all,
    )
    return model, opt, summary, resumed_from, epoch_metrics, split_summary


def export_onnx(model: nn.Module, onnx_out: str) -> None:
    trainer_common.export_onnx_model(
        model, onnx_out, base.INPUT_DIM,
        output_names=["card_logits"],
        dynamic_axes={"obs": {0: "batch"}, "card_logits": {0: "batch"}},
    )


def write_meta(
    path: str,
    args: argparse.Namespace,
    data: CardDatasetBundle,
    train_summary: CardTrainSummary,
    device: str,
    split_summary: dict[str, Any] | None,
) -> None:
    feature_spec = list(trainer_common.BASE_FEATURE_SPEC) + [
        "hand_card_counts_norm",
        "card_candidate_mask",
    ]
    training = trainer_common.build_common_training_meta(args, device)
    trainer_common.apply_split_summary_meta(training, split_summary)
    training.update({
        "cardNoActionWeight": args.card_no_action_weight,
        "cardClassBalancePower": args.card_class_balance_power,
    })
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
        "paddedBoardMinCoord": base.PADDED_BOARD_MIN,
        "paddedBoardMaxCoord": base.PADDED_BOARD_MAX,
        "paddedBoardSize": base.PADDED_BOARD_SIZE,
        "boardEnvelopeField": "boardEnvelope",
        "boardMinRowField": "boardMinRow",
        "boardMinColField": "boardMinCol",
        "actionSpace": "card_choice",
        "cardActionIds": base.CARD_ACTION_IDS,
        "cardDecisionKinds": ["keep", "use", "destroy", "sell"],
        **trainer_common.build_deck_count_feature_meta(),
        "featureSpec": feature_spec,
        "training": training,
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
    trainer_common.write_json_payload(path, payload)


def maybe_write_checkpoint(
    checkpoint_out: str,
    model: nn.Module,
    optimizer: torch.optim.Optimizer,
    args: argparse.Namespace,
    data: CardDatasetBundle,
    train_summary: CardTrainSummary,
    device: str,
    resumed_from: str | None,
    split_summary: dict[str, Any] | None,
) -> None:
    ckpt_training = trainer_common.build_common_checkpoint_training(args, device, resumed_from)
    trainer_common.apply_split_summary_meta(ckpt_training, split_summary)
    ckpt_training.update({
        "cardNoActionWeight": float(args.card_no_action_weight),
        "cardClassBalancePower": float(args.card_class_balance_power),
    })
    payload = trainer_common.build_model_checkpoint_payload(
        MODEL_SCHEMA_VERSION,
        model,
        optimizer,
        {
            "inputDim": base.INPUT_DIM,
            "baseInputDim": base.BASE_INPUT_DIM,
            "cardOutputDim": base.CARD_ACTION_DIM,
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
            "cardRecords": int(data.card_records),
            "winnerRecords": int(data.winner_records),
            "loserRecords": int(data.loser_records),
            "drawRecords": int(data.draw_records),
            "tacticalMissRecords": int(data.tactical_miss_records),
            "trainCardAccuracy": float(train_summary.card_acc),
            "trainCardSamples": int(train_summary.card_samples),
        },
    )
    trainer_common.write_model_checkpoint(checkpoint_out, payload)


def main() -> int:
    args = parse_args()
    trainer_common.validate_sample_weight_args(args)
    device = base.choose_device(str(args.device).strip().lower())
    meta_out = trainer_common.resolve_meta_output_path(args.meta_out, args.onnx_out)

    data = load_card_dataset(args)
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
        card_no_action_weight=float(args.card_no_action_weight),
        card_class_balance_power=float(args.card_class_balance_power),
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
