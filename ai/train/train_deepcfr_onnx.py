#!/usr/bin/env python3
"""Approximate DeepCFR/CFR+ training from self-play NDJSON and export ONNX."""

from __future__ import annotations

import argparse
import json
import os
import random
from dataclasses import dataclass
from typing import Dict

import torch
from torch import nn
from torch.nn import functional as F

import train_policy_onnx as onnx_base
import train_policy_table as policy_table


MODEL_SCHEMA_VERSION = "policy_onnx.v1"
POLICY_TABLE_SCHEMA_VERSION = "policy_table.v2"
IGNORE_INDEX = -100
INVERSE_TRANSFORM_ID = {
    0: 0,
    1: 3,
    2: 2,
    3: 1,
    4: 4,
    5: 5,
    6: 6,
    7: 7,
}


@dataclass
class ActionAggregate:
    visits: int = 0
    utility_sum: float = 0.0
    regret: float = 0.0
    avg_strategy_mass: float = 0.0

    @property
    def avg_utility(self) -> float:
        if self.visits <= 0:
            return 0.0
        return self.utility_sum / float(self.visits)


@dataclass
class DistillSample:
    features: list[float]
    infoset_key: str
    transform_id: int
    action_type: str
    place_index: int
    card_index: int
    had_usable_cards: bool


@dataclass
class DistillDataset:
    x: torch.Tensor
    place_target: torch.Tensor
    card_target: torch.Tensor
    place_mask: torch.Tensor
    card_mask: torch.Tensor
    records_read: int
    train_records: int
    place_records: int
    card_records: int


@dataclass
class DistillSummary:
    overall_acc: float
    place_acc: float
    card_acc: float | None
    place_samples: int
    card_samples: int


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Train DeepCFR/CFR+ distilled ONNX model from self-play NDJSON.")
    p.add_argument("--input", required=True, help="Path to NDJSON self-play data.")
    p.add_argument("--onnx-out", default=os.path.join("data", "models", "policy-net.onnx"), help="Output ONNX path.")
    p.add_argument("--meta-out", default=None, help="Output metadata JSON path (default: <onnx-out>.meta.json).")
    p.add_argument("--policy-table-out", default=os.path.join("data", "models", "policy-table.json"), help="Output policy-table JSON path.")
    p.add_argument("--report-out", default="", help="Optional detailed JSON report output path.")
    p.add_argument("--seed", type=int, default=7, help="Random seed (default: 7).")
    p.add_argument("--max-samples", type=int, default=600000, help="Max distillation samples (default: 600000).")
    p.add_argument("--cfr-iterations", type=int, default=12, help="CFR+ update iterations (default: 12).")
    p.add_argument("--cfr-regret-floor", type=float, default=0.0, help="CFR+ regret floor (default: 0.0).")
    p.add_argument("--cfr-strategy-decay", type=float, default=1.0, help="Average strategy decay in (0,1] (default: 1.0).")
    p.add_argument("--epochs", type=int, default=12, help="Distillation epochs (default: 12).")
    p.add_argument("--batch-size", type=int, default=2048, help="Batch size (default: 2048).")
    p.add_argument("--lr", type=float, default=8e-4, help="Learning rate (default: 8e-4).")
    p.add_argument("--hidden-size", type=int, default=384, help="Hidden size (default: 384).")
    p.add_argument("--val-split", type=float, default=0.1, help="Validation split ratio in [0,0.5). Default: 0.1")
    p.add_argument("--early-stop-patience", type=int, default=4, help="Stop if monitored metric does not improve for N epochs (default: 4).")
    p.add_argument("--early-stop-min-delta", type=float, default=0.0002, help="Minimum metric improvement to reset early-stop counter (default: 0.0002).")
    p.add_argument("--early-stop-monitor", default="val_loss", help="Metric for early stopping: val_loss or train_loss (default: val_loss).")
    p.add_argument("--log-interval-steps", type=int, default=0, help="If > 0, print batch loss every N steps (default: 0=off).")
    p.add_argument("--metrics-out", default="", help="Optional JSONL path for per-epoch metrics.")
    p.add_argument("--resume-checkpoint", default="", help="Optional checkpoint path to resume model/optimizer state from.")
    p.add_argument("--checkpoint-out", default="", help="Optional checkpoint output path (.pt).")
    p.add_argument("--device", default="auto", help="Device: auto/cpu/cuda (default: auto).")
    p.add_argument("--card-loss-weight", type=float, default=2.0, help="Loss weight for card action head (default: 2.0).")
    p.add_argument("--min-visits", type=int, default=12, help="Minimum visits per state to keep in policy-table output.")
    p.add_argument("--shape-immediate", type=float, default=0.25, help="Blend ratio [0..1] of immediate disc-diff delta into utility target.")
    return p.parse_args()


def is_supported_action(rec: dict) -> bool:
    action_type = rec.get("actionType")
    return action_type == "place" or action_type == "use_card"


def reservoir_append(reservoir: list[DistillSample], sample: DistillSample, seen_index: int, max_samples: int, rng: random.Random) -> None:
    if max_samples <= 0:
        reservoir.append(sample)
        return
    if len(reservoir) < max_samples:
        reservoir.append(sample)
        return
    replacement = rng.randint(0, seen_index)
    if replacement < max_samples:
        reservoir[replacement] = sample


def parse_place_action(action_key: str) -> tuple[int, int] | None:
    parts = str(action_key or "").split(":")
    if len(parts) != 3 or parts[0] != "place":
        return None
    try:
        row = int(parts[1])
        col = int(parts[2])
    except ValueError:
        return None
    if row < 0 or row >= onnx_base.BOARD_SIZE or col < 0 or col >= onnx_base.BOARD_SIZE:
        return None
    return row, col


def transform_place_to_original(row: int, col: int, transform_id: int) -> tuple[int, int]:
    inverse_id = INVERSE_TRANSFORM_ID.get(int(transform_id), 0)
    rr, cc = policy_table.transform_coord(row, col, onnx_base.BOARD_SIZE, inverse_id)
    return int(rr), int(cc)


def run_cfr_plus(infosets: Dict[str, Dict[str, ActionAggregate]], iterations: int, regret_floor: float, strategy_decay: float) -> dict:
    if iterations < 1:
        raise ValueError("--cfr-iterations must be >= 1")
    if strategy_decay <= 0 or strategy_decay > 1:
        raise ValueError("--cfr-strategy-decay must be in (0,1]")
    if len(infosets) <= 0:
        raise ValueError("no infosets available for CFR+")

    for _ in range(iterations):
        for action_map in infosets.values():
            actions = list(action_map.keys())
            if len(actions) <= 0:
                continue
            positive_sum = 0.0
            for action_key in actions:
                reg = action_map[action_key].regret
                if reg > regret_floor:
                    positive_sum += reg

            strategy: dict[str, float] = {}
            if positive_sum > 0:
                for action_key in actions:
                    reg = action_map[action_key].regret
                    strategy[action_key] = max(0.0, reg) / positive_sum
            else:
                uniform = 1.0 / float(len(actions))
                for action_key in actions:
                    strategy[action_key] = uniform

            expected_utility = 0.0
            for action_key in actions:
                expected_utility += strategy[action_key] * action_map[action_key].avg_utility

            for action_key in actions:
                agg = action_map[action_key]
                instant_regret = agg.avg_utility - expected_utility
                agg.regret = max(regret_floor, agg.regret + instant_regret)
                agg.avg_strategy_mass = (agg.avg_strategy_mass * strategy_decay) + strategy[action_key]

    final_policy: dict[str, dict[str, float]] = {}
    for infoset_key, action_map in infosets.items():
        total_mass = 0.0
        for agg in action_map.values():
            total_mass += max(0.0, agg.avg_strategy_mass)
        if total_mass <= 0:
            uniform = 1.0 / float(max(1, len(action_map)))
            final_policy[infoset_key] = {k: uniform for k in action_map.keys()}
            continue
        final_policy[infoset_key] = {action_key: max(0.0, agg.avg_strategy_mass) / total_mass for action_key, agg in action_map.items()}
    return final_policy


def load_infosets_and_samples(input_path: str, max_samples: int, seed: int, shape_immediate: float) -> tuple[Dict[str, Dict[str, ActionAggregate]], list[DistillSample], dict]:
    if shape_immediate < 0 or shape_immediate > 1:
        raise ValueError("--shape-immediate must be in [0,1]")

    infosets: Dict[str, Dict[str, ActionAggregate]] = {}
    samples: list[DistillSample] = []
    rng = random.Random(seed)

    records_read = 0
    train_records = 0
    place_records = 0
    card_records = 0

    with open(input_path, "r", encoding="utf-8") as f:
        for raw in f:
            line = raw.strip()
            if not line:
                continue
            records_read += 1
            rec = json.loads(line)
            if not isinstance(rec, dict):
                continue
            if not is_supported_action(rec):
                continue
            outcome = rec.get("outcome")
            if outcome is None:
                continue

            place_index = onnx_base.place_target_index(rec)
            card_index = onnx_base.card_target_index(rec)
            if place_index is None and card_index is None:
                continue

            target = policy_table.compute_training_target(rec, float(outcome), shape_immediate)
            infoset_key, transform_id = policy_table.build_state_key(rec)
            action_key = policy_table.build_action_key(rec, transform_id)
            action_map = infosets.setdefault(infoset_key, {})
            agg = action_map.get(action_key)
            if agg is None:
                agg = ActionAggregate()
                action_map[action_key] = agg
            agg.visits += 1
            agg.utility_sum += float(target)

            sample = DistillSample(
                features=onnx_base.feature_vector(rec),
                infoset_key=infoset_key,
                transform_id=int(transform_id),
                action_type=str(rec.get("actionType") or ""),
                place_index=int(place_index) if place_index is not None else IGNORE_INDEX,
                card_index=int(card_index) if card_index is not None else IGNORE_INDEX,
                had_usable_cards=any(
                    isinstance(one, str) and one.strip()
                    for one in (rec.get("usableCardIds") if isinstance(rec.get("usableCardIds"), list) else [])
                ),
            )
            reservoir_append(samples, sample, train_records, max_samples, rng)

            train_records += 1
            if place_index is not None:
                place_records += 1
            if card_index is not None:
                card_records += 1

    stats = {
        "recordsRead": records_read,
        "trainRecords": train_records,
        "placeRecords": place_records,
        "cardRecords": card_records,
        "sampledRecords": len(samples),
    }
    if train_records <= 0:
        raise ValueError("no training records were found in input data")
    return infosets, samples, stats

def build_distill_dataset(samples: list[DistillSample], final_policy: dict[str, dict[str, float]]) -> DistillDataset:
    if len(samples) <= 0:
        raise ValueError("no samples available for distillation")

    n = len(samples)
    input_dim = onnx_base.INPUT_DIM
    place_dim = onnx_base.PLACE_OUTPUT_DIM
    card_dim = onnx_base.CARD_ACTION_DIM

    x = torch.zeros((n, input_dim), dtype=torch.float32)
    place_target = torch.zeros((n, place_dim), dtype=torch.float32)
    card_target = torch.zeros((n, card_dim), dtype=torch.float32) if card_dim > 0 else torch.zeros((n, 1), dtype=torch.float32)
    place_mask = torch.zeros((n,), dtype=torch.bool)
    card_mask = torch.zeros((n,), dtype=torch.bool)

    place_records = 0
    card_records = 0
    no_card_idx = onnx_base.NO_CARD_ACTION_INDEX if hasattr(onnx_base, "NO_CARD_ACTION_INDEX") else None

    for i, sample in enumerate(samples):
        x[i] = torch.tensor(sample.features, dtype=torch.float32)
        action_probs = final_policy.get(sample.infoset_key, {})
        if sample.action_type == "place":
            place_mask[i] = True
            for action_key, prob in action_probs.items():
                parsed = parse_place_action(action_key)
                if parsed is None:
                    continue
                rr, cc = transform_place_to_original(parsed[0], parsed[1], sample.transform_id)
                if rr < 0 or rr >= onnx_base.BOARD_SIZE or cc < 0 or cc >= onnx_base.BOARD_SIZE:
                    continue
                idx = (rr * onnx_base.BOARD_SIZE) + cc
                place_target[i, idx] += float(prob)
            total = float(place_target[i].sum().item())
            if total > 0:
                place_target[i] /= total
            elif sample.place_index >= 0:
                place_target[i, sample.place_index] = 1.0
            else:
                place_target[i].fill_(1.0 / float(place_dim))
            place_records += 1

            # Teach explicit "hold card" decision when cards were usable but a place move was taken.
            if (
                card_dim > 0 and
                sample.had_usable_cards and
                isinstance(no_card_idx, int) and
                no_card_idx >= 0 and
                no_card_idx < card_dim
            ):
                card_mask[i] = True
                card_target[i, no_card_idx] = 1.0
                card_records += 1
            continue

        if sample.action_type == "use_card" and card_dim > 0:
            card_mask[i] = True
            for action_key, prob in action_probs.items():
                parts = str(action_key).split(":", 1)
                if len(parts) != 2 or parts[0] != "use_card":
                    continue
                card_id = parts[1]
                idx = onnx_base.CARD_ACTION_INDEX.get(card_id)
                if idx is None:
                    continue
                card_target[i, idx] += float(prob)
            total = float(card_target[i].sum().item())
            if total > 0:
                card_target[i] /= total
            elif sample.card_index >= 0:
                card_target[i, sample.card_index] = 1.0
            elif card_dim > 0:
                card_target[i].fill_(1.0 / float(card_dim))
            card_records += 1

    if int(place_mask.sum().item()) <= 0:
        raise ValueError("no place-action samples were found for distillation")

    return DistillDataset(
        x=x,
        place_target=place_target,
        card_target=card_target,
        place_mask=place_mask,
        card_mask=card_mask,
        records_read=n,
        train_records=n,
        place_records=place_records,
        card_records=card_records,
    )


def _soft_accuracy(logits: torch.Tensor, target_prob: torch.Tensor) -> tuple[int, int]:
    if logits.numel() <= 0 or target_prob.numel() <= 0:
        return 0, 0
    target_idx = torch.argmax(target_prob, dim=1)
    pred_idx = torch.argmax(logits, dim=1)
    samples = int(target_idx.shape[0])
    if samples <= 0:
        return 0, 0
    correct = int((pred_idx == target_idx).sum().item())
    return correct, samples


def _kl_loss(logits: torch.Tensor, target_prob: torch.Tensor) -> torch.Tensor:
    logp = F.log_softmax(logits, dim=1)
    return F.kl_div(logp, target_prob, reduction="batchmean")


def train_distillation(
    data: DistillDataset,
    epochs: int,
    batch_size: int,
    lr: float,
    hidden_size: int,
    device: str,
    seed: int,
    val_split: float,
    early_stop_patience: int,
    early_stop_min_delta: float,
    early_stop_monitor: str,
    resume_checkpoint: str,
    log_interval_steps: int,
    card_loss_weight: float,
) -> tuple[nn.Module, torch.optim.Optimizer, DistillSummary, str | None, list[dict]]:
    if epochs < 1:
        raise ValueError("--epochs must be >= 1")
    if batch_size < 1:
        raise ValueError("--batch-size must be >= 1")
    if lr <= 0:
        raise ValueError("--lr must be > 0")
    if hidden_size < 8:
        raise ValueError("--hidden-size must be >= 8")
    if val_split < 0 or val_split >= 0.5:
        raise ValueError("--val-split must be in [0,0.5)")
    if early_stop_patience < 0:
        raise ValueError("--early-stop-patience must be >= 0")
    if early_stop_min_delta < 0:
        raise ValueError("--early-stop-min-delta must be >= 0")
    if log_interval_steps < 0:
        raise ValueError("--log-interval-steps must be >= 0")
    if card_loss_weight <= 0:
        raise ValueError("--card-loss-weight must be > 0")
    monitor = str(early_stop_monitor or "").strip().lower()
    if monitor not in ("val_loss", "train_loss"):
        raise ValueError("--early-stop-monitor must be val_loss or train_loss")

    torch.manual_seed(seed)
    if device == "cuda":
        torch.cuda.manual_seed_all(seed)

    model = onnx_base.PolicyNet(onnx_base.INPUT_DIM, hidden_size, onnx_base.PLACE_OUTPUT_DIM, onnx_base.CARD_ACTION_DIM).to(device)
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
        model.load_state_dict(state)
        if isinstance(ckpt, dict):
            optimizer_state = ckpt.get("optimizer_state")
            if optimizer_state:
                try:
                    opt.load_state_dict(optimizer_state)
                except Exception:
                    pass
        resumed_from = resume_path

    x = data.x.to(device)
    place_target = data.place_target.to(device)
    card_target = data.card_target.to(device)
    place_mask = data.place_mask.to(device)
    card_mask = data.card_mask.to(device)

    n = int(x.shape[0])
    all_perm = torch.randperm(n, device=device)
    val_size = int(n * val_split)
    if val_size > 0:
        val_idx = all_perm[:val_size]
        train_idx = all_perm[val_size:]
    else:
        val_idx = torch.empty((0,), dtype=torch.long, device=device)
        train_idx = all_perm
    if int(train_idx.shape[0]) <= 0:
        raise ValueError("training split became empty; reduce --val-split")

    def select_rows(t: torch.Tensor, idx: torch.Tensor) -> torch.Tensor:
        return t[idx] if idx.numel() > 0 else t.new_zeros((0,) + t.shape[1:])

    x_train = x[train_idx]
    p_train = place_target[train_idx]
    c_train = card_target[train_idx]
    pm_train = place_mask[train_idx]
    cm_train = card_mask[train_idx]
    x_val = select_rows(x, val_idx)
    p_val = select_rows(place_target, val_idx)
    c_val = select_rows(card_target, val_idx)
    pm_val = place_mask[val_idx] if val_idx.numel() > 0 else place_mask.new_zeros((0,))
    cm_val = card_mask[val_idx] if val_idx.numel() > 0 else card_mask.new_zeros((0,))

    train_n = int(x_train.shape[0])
    global_step = 0
    best_monitor = float("inf")
    best_epoch = 0
    no_improve_count = 0
    stopped_early = False
    early_stop_epoch = None
    best_state: dict | None = None
    epoch_metrics: list[dict] = []

    for epoch_index in range(epochs):
        perm = torch.randperm(train_n, device=device)
        xb = x_train[perm]
        pb = p_train[perm]
        cb = c_train[perm]
        pmb = pm_train[perm]
        cmb = cm_train[perm]

        epoch_loss_sum = 0.0
        epoch_samples = 0
        epoch_place_correct = 0
        epoch_place_samples = 0
        epoch_card_correct = 0
        epoch_card_samples = 0

        for start in range(0, train_n, batch_size):
            end = start + batch_size
            x_batch = xb[start:end]
            p_batch = pb[start:end]
            c_batch = cb[start:end]
            pm_batch = pmb[start:end]
            cm_batch = cmb[start:end]

            outputs = model(x_batch)
            place_logits, card_logits = onnx_base._split_outputs(outputs)

            losses = []
            if int(pm_batch.sum().item()) > 0:
                losses.append(_kl_loss(place_logits[pm_batch], p_batch[pm_batch]))
                with torch.no_grad():
                    correct, samples = _soft_accuracy(place_logits[pm_batch], p_batch[pm_batch])
                    epoch_place_correct += correct
                    epoch_place_samples += samples
            if card_logits is not None and onnx_base.CARD_ACTION_DIM > 0 and int(cm_batch.sum().item()) > 0:
                losses.append(_kl_loss(card_logits[cm_batch], c_batch[cm_batch]) * card_loss_weight)
                with torch.no_grad():
                    correct, samples = _soft_accuracy(card_logits[cm_batch], c_batch[cm_batch])
                    epoch_card_correct += correct
                    epoch_card_samples += samples
            if len(losses) <= 0:
                continue

            loss = losses[0]
            for extra in losses[1:]:
                loss = loss + extra

            opt.zero_grad(set_to_none=True)
            loss.backward()
            opt.step()

            global_step += 1
            batch_size_now = int(x_batch.shape[0])
            epoch_samples += batch_size_now
            epoch_loss_sum += float(loss.item()) * batch_size_now

            if log_interval_steps > 0 and (global_step % log_interval_steps) == 0:
                print(f"[train_deepcfr_onnx] step={global_step} epoch={epoch_index + 1}/{epochs} loss={float(loss.item()):.6f}", flush=True)

        train_loss = epoch_loss_sum / max(1, epoch_samples)
        train_place_acc = epoch_place_correct / max(1, epoch_place_samples)
        train_card_acc = None
        if epoch_card_samples > 0:
            train_card_acc = epoch_card_correct / epoch_card_samples
        train_total_samples = epoch_place_samples + epoch_card_samples
        train_total_correct = epoch_place_correct + epoch_card_correct
        train_acc = train_total_correct / max(1, train_total_samples)

        val_loss = None
        val_acc = None
        val_place_acc = None
        val_card_acc = None
        if int(x_val.shape[0]) > 0:
            with torch.no_grad():
                outputs_val = model(x_val)
                place_logits_val, card_logits_val = onnx_base._split_outputs(outputs_val)
                val_losses = []
                val_place_correct = 0
                val_place_samples = 0
                val_card_correct = 0
                val_card_samples = 0

                if int(pm_val.sum().item()) > 0:
                    val_losses.append(_kl_loss(place_logits_val[pm_val], p_val[pm_val]))
                    val_place_correct, val_place_samples = _soft_accuracy(place_logits_val[pm_val], p_val[pm_val])
                if card_logits_val is not None and onnx_base.CARD_ACTION_DIM > 0 and int(cm_val.sum().item()) > 0:
                    val_losses.append(_kl_loss(card_logits_val[cm_val], c_val[cm_val]) * card_loss_weight)
                    val_card_correct, val_card_samples = _soft_accuracy(card_logits_val[cm_val], c_val[cm_val])

                if len(val_losses) > 0:
                    total_val_loss = val_losses[0]
                    for extra in val_losses[1:]:
                        total_val_loss = total_val_loss + extra
                    val_loss = float(total_val_loss.item())

                    val_place_acc = val_place_correct / max(1, val_place_samples)
                    if val_card_samples > 0:
                        val_card_acc = val_card_correct / val_card_samples
                    total_val_samples = val_place_samples + val_card_samples
                    total_val_correct = val_place_correct + val_card_correct
                    val_acc = total_val_correct / max(1, total_val_samples)

        monitor_value = train_loss
        if monitor == "val_loss" and val_loss is not None:
            monitor_value = val_loss

        improved = (best_monitor - monitor_value) > early_stop_min_delta
        if improved:
            best_monitor = monitor_value
            best_epoch = epoch_index + 1
            no_improve_count = 0
            best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}
        else:
            no_improve_count += 1

        epoch_metrics.append({
            "epoch": epoch_index + 1,
            "epochs": epochs,
            "globalStep": global_step,
            "avgLoss": train_loss,
            "trainLoss": train_loss,
            "trainAcc": train_acc,
            "trainPlaceAcc": train_place_acc,
            "trainCardAcc": train_card_acc,
            "valLoss": val_loss,
            "valAcc": val_acc,
            "valPlaceAcc": val_place_acc,
            "valCardAcc": val_card_acc,
            "monitor": monitor,
            "monitorValue": monitor_value,
            "bestMonitor": best_monitor,
            "bestEpoch": best_epoch,
            "noImproveCount": no_improve_count,
            "cardLossWeight": card_loss_weight,
        })

        parts = [
            f"[train_deepcfr_onnx] epoch={epoch_index + 1}/{epochs}",
            f"avg_loss={train_loss:.6f}",
            f"train_acc={train_acc:.3f}",
            f"train_place_acc={train_place_acc:.3f}",
        ]
        if train_card_acc is not None:
            parts.append(f"train_card_acc={train_card_acc:.3f}")
        if val_loss is not None and val_acc is not None:
            parts.append(f"val_loss={val_loss:.6f}")
            parts.append(f"val_acc={val_acc:.3f}")
            if val_place_acc is not None:
                parts.append(f"val_place_acc={val_place_acc:.3f}")
            if val_card_acc is not None:
                parts.append(f"val_card_acc={val_card_acc:.3f}")
        parts.append(f"monitor={monitor}")
        parts.append(f"monitor_value={monitor_value:.6f}")
        print(" ".join(parts), flush=True)

        if early_stop_patience > 0 and no_improve_count >= early_stop_patience:
            stopped_early = True
            early_stop_epoch = epoch_index + 1
            print(
                f"[train_deepcfr_onnx] early-stop triggered at epoch={early_stop_epoch} best_epoch={best_epoch} best_{monitor}={best_monitor:.6f}",
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
        outputs_all = model(x)
        place_logits_all, card_logits_all = onnx_base._split_outputs(outputs_all)
        all_place_correct = 0
        all_place_samples = 0
        all_card_correct = 0
        all_card_samples = 0
        if int(place_mask.sum().item()) > 0:
            all_place_correct, all_place_samples = _soft_accuracy(place_logits_all[place_mask], place_target[place_mask])
        if card_logits_all is not None and onnx_base.CARD_ACTION_DIM > 0 and int(card_mask.sum().item()) > 0:
            all_card_correct, all_card_samples = _soft_accuracy(card_logits_all[card_mask], card_target[card_mask])

    place_acc_all = all_place_correct / max(1, all_place_samples)
    card_acc_all = None
    if all_card_samples > 0:
        card_acc_all = all_card_correct / all_card_samples
    total_samples = all_place_samples + all_card_samples
    total_correct = all_place_correct + all_card_correct
    overall_acc = total_correct / max(1, total_samples)

    summary = DistillSummary(
        overall_acc=overall_acc,
        place_acc=place_acc_all,
        card_acc=card_acc_all,
        place_samples=all_place_samples,
        card_samples=all_card_samples,
    )
    return model, opt, summary, resumed_from, epoch_metrics

def build_policy_table_model(
    infosets: Dict[str, Dict[str, ActionAggregate]],
    final_policy: dict[str, dict[str, float]],
    min_visits: int,
    shape_immediate: float,
    cfr_iterations: int,
    regret_floor: float,
    strategy_decay: float,
) -> dict:
    states = {}
    for infoset_key, action_map in infosets.items():
        total_visits = sum(agg.visits for agg in action_map.values())
        if total_visits < min_visits:
            continue
        probs = final_policy.get(infoset_key, {})
        if len(probs) <= 0:
            uniform = 1.0 / float(max(1, len(action_map)))
            probs = {k: uniform for k in action_map.keys()}
        best_action = max(probs.keys(), key=lambda k: (probs[k], action_map[k].avg_utility, action_map[k].visits))
        states[infoset_key] = {
            "visits": int(total_visits),
            "bestAction": best_action,
            "bestActionVisits": int(action_map[best_action].visits),
            "bestActionAvgOutcome": float(action_map[best_action].avg_utility),
            "actions": {
                action_key: {
                    "visits": int(max(1, round(action_map[action_key].visits * max(1e-6, probs.get(action_key, 0.0))))),
                    "avgOutcome": float(action_map[action_key].avg_utility),
                    "policyProb": float(probs.get(action_key, 0.0)),
                    "regret": float(action_map[action_key].regret),
                }
                for action_key in action_map.keys()
            },
        }

    return {
        "schemaVersion": POLICY_TABLE_SCHEMA_VERSION,
        "normalization": policy_table.NORMALIZATION,
        "createdAt": policy_table.dt.datetime.utcnow().isoformat() + "Z",
        "algorithm": "deepcfr_cfrplus_distill.v1",
        "stats": {
            "statesRaw": len(infosets),
            "statesKept": len(states),
            "minVisits": int(min_visits),
            "shapeImmediate": float(shape_immediate),
            "cfrIterations": int(cfr_iterations),
            "cfrRegretFloor": float(regret_floor),
            "cfrStrategyDecay": float(strategy_decay),
        },
        "states": states,
        "abstractStates": {},
    }


def write_meta(path: str, args: argparse.Namespace, stats: dict, summary: DistillSummary, device: str) -> None:
    feature_spec = [
        "board_8x8_perspective_flat",
        "legal_moves_norm",
        "disc_diff_before_norm",
        "own_charge_norm",
        "opp_charge_norm",
        "deck_count_norm",
        "pending_flag",
    ]
    if onnx_base.CARD_ACTION_DIM > 0:
        feature_spec += ["hand_card_counts_norm", "usable_card_mask"]

    payload = {
        "schemaVersion": MODEL_SCHEMA_VERSION,
        "inputName": "obs",
        "outputName": "place_logits",
        "outputNames": ["place_logits"] + (["card_logits"] if onnx_base.CARD_ACTION_DIM > 0 else []),
        "placeOutputName": "place_logits",
        "cardOutputName": "card_logits" if onnx_base.CARD_ACTION_DIM > 0 else None,
        "inputDim": onnx_base.INPUT_DIM,
        "baseInputDim": onnx_base.BASE_INPUT_DIM,
        "outputDim": onnx_base.PLACE_OUTPUT_DIM,
        "cardOutputDim": onnx_base.CARD_ACTION_DIM,
        "boardSize": onnx_base.BOARD_SIZE,
        "actionSpace": "place_8x8+use_card",
        "cardActionIds": onnx_base.CARD_ACTION_IDS,
        "featureSpec": feature_spec,
        "algorithm": "deepcfr_cfrplus_distill.v1",
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
            "earlyStopMonitor": str(args.early_stop_monitor),
            "cardLossWeight": float(args.card_loss_weight),
            "resumeCheckpoint": (args.resume_checkpoint or "").strip() or None,
            "checkpointOut": (args.checkpoint_out or "").strip() or None,
            "cfrIterations": int(args.cfr_iterations),
            "cfrRegretFloor": float(args.cfr_regret_floor),
            "cfrStrategyDecay": float(args.cfr_strategy_decay),
        },
        "stats": {
            "recordsRead": int(stats["recordsRead"]),
            "trainRecords": int(stats["trainRecords"]),
            "sampledRecords": int(stats["sampledRecords"]),
            "placeRecords": int(stats["placeRecords"]),
            "cardRecords": int(stats["cardRecords"]),
            "trainAccuracy": float(summary.overall_acc),
            "trainPlaceAccuracy": float(summary.place_acc),
            "trainCardAccuracy": float(summary.card_acc) if summary.card_acc is not None else None,
            "trainPlaceSamples": int(summary.place_samples),
            "trainCardSamples": int(summary.card_samples),
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
    stats: dict,
    summary: DistillSummary,
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
        "algorithm": "deepcfr_cfrplus_distill.v1",
        "model_state": model.cpu().state_dict(),
        "optimizer_state": optimizer.state_dict(),
        "modelConfig": {
            "inputDim": onnx_base.INPUT_DIM,
            "baseInputDim": onnx_base.BASE_INPUT_DIM,
            "placeOutputDim": onnx_base.PLACE_OUTPUT_DIM,
            "cardOutputDim": onnx_base.CARD_ACTION_DIM,
            "cardActionIds": onnx_base.CARD_ACTION_IDS,
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
            "earlyStopMonitor": str(args.early_stop_monitor),
            "cardLossWeight": float(args.card_loss_weight),
            "resumedFrom": resumed_from,
            "cfrIterations": int(args.cfr_iterations),
            "cfrRegretFloor": float(args.cfr_regret_floor),
            "cfrStrategyDecay": float(args.cfr_strategy_decay),
        },
        "stats": {
            "recordsRead": int(stats["recordsRead"]),
            "trainRecords": int(stats["trainRecords"]),
            "sampledRecords": int(stats["sampledRecords"]),
            "placeRecords": int(stats["placeRecords"]),
            "cardRecords": int(stats["cardRecords"]),
            "trainAccuracy": float(summary.overall_acc),
            "trainPlaceAccuracy": float(summary.place_acc),
            "trainCardAccuracy": float(summary.card_acc) if summary.card_acc is not None else None,
            "trainPlaceSamples": int(summary.place_samples),
            "trainCardSamples": int(summary.card_samples),
        },
    }
    torch.save(payload, out)


def maybe_write_json(path_value: str, payload: dict) -> None:
    out = (path_value or "").strip()
    if not out:
        return
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)


def maybe_write_metrics(metrics_out: str, metrics: list[dict]) -> None:
    out = (metrics_out or "").strip()
    if not out:
        return
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        for entry in metrics:
            f.write(json.dumps(entry, ensure_ascii=False))
            f.write("\n")


def maybe_write_policy_table(path_value: str, model_payload: dict) -> None:
    out = (path_value or "").strip()
    if not out:
        return
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(model_payload, f, ensure_ascii=False, indent=2)


def main() -> int:
    args = parse_args()
    device = onnx_base.choose_device(str(args.device).strip().lower())
    meta_out = args.meta_out or (args.onnx_out + ".meta.json")

    if args.min_visits < 1:
        raise ValueError("--min-visits must be >= 1")

    infosets, samples, stats = load_infosets_and_samples(
        input_path=args.input,
        max_samples=int(args.max_samples),
        seed=int(args.seed),
        shape_immediate=float(args.shape_immediate),
    )
    final_policy = run_cfr_plus(
        infosets=infosets,
        iterations=int(args.cfr_iterations),
        regret_floor=float(args.cfr_regret_floor),
        strategy_decay=float(args.cfr_strategy_decay),
    )
    distill_data = build_distill_dataset(samples, final_policy)

    model, optimizer, train_summary, resumed_from, epoch_metrics = train_distillation(
        data=distill_data,
        epochs=int(args.epochs),
        batch_size=int(args.batch_size),
        lr=float(args.lr),
        hidden_size=int(args.hidden_size),
        device=device,
        seed=int(args.seed),
        val_split=float(args.val_split),
        early_stop_patience=int(args.early_stop_patience),
        early_stop_min_delta=float(args.early_stop_min_delta),
        early_stop_monitor=str(args.early_stop_monitor or ""),
        resume_checkpoint=str(args.resume_checkpoint or ""),
        log_interval_steps=int(args.log_interval_steps),
        card_loss_weight=float(args.card_loss_weight),
    )

    onnx_base.export_onnx(model, args.onnx_out)
    write_meta(meta_out, args, stats, train_summary, device)
    maybe_write_metrics(str(args.metrics_out or ""), epoch_metrics)
    maybe_write_checkpoint(
        checkpoint_out=str(args.checkpoint_out or ""),
        model=model,
        optimizer=optimizer,
        args=args,
        stats=stats,
        summary=train_summary,
        device=device,
        resumed_from=resumed_from,
    )

    policy_table_model = build_policy_table_model(
        infosets=infosets,
        final_policy=final_policy,
        min_visits=int(args.min_visits),
        shape_immediate=float(args.shape_immediate),
        cfr_iterations=int(args.cfr_iterations),
        regret_floor=float(args.cfr_regret_floor),
        strategy_decay=float(args.cfr_strategy_decay),
    )
    maybe_write_policy_table(str(args.policy_table_out or ""), policy_table_model)

    report_payload = {
        "schemaVersion": "deepcfr_report.v1",
        "algorithm": "deepcfr_cfrplus_distill.v1",
        "input": os.path.abspath(args.input),
        "outputs": {
            "onnx": os.path.abspath(args.onnx_out),
            "meta": os.path.abspath(meta_out),
            "policyTable": os.path.abspath(args.policy_table_out) if (args.policy_table_out or "").strip() else None,
            "checkpoint": os.path.abspath(args.checkpoint_out) if (args.checkpoint_out or "").strip() else None,
            "metrics": os.path.abspath(args.metrics_out) if (args.metrics_out or "").strip() else None,
        },
        "stats": {
            **stats,
            "infosets": len(infosets),
            "policyStates": len(policy_table_model.get("states", {})),
            "distillSamples": int(distill_data.train_records),
            "distillPlaceRecords": int(distill_data.place_records),
            "distillCardRecords": int(distill_data.card_records),
        },
        "accuracy": {
            "overall": float(train_summary.overall_acc),
            "place": float(train_summary.place_acc),
            "card": float(train_summary.card_acc) if train_summary.card_acc is not None else None,
            "placeSamples": int(train_summary.place_samples),
            "cardSamples": int(train_summary.card_samples),
        },
        "training": {
            "device": device,
            "epochs": int(args.epochs),
            "batchSize": int(args.batch_size),
            "learningRate": float(args.lr),
            "hiddenSize": int(args.hidden_size),
            "valSplit": float(args.val_split),
            "earlyStopPatience": int(args.early_stop_patience),
            "earlyStopMinDelta": float(args.early_stop_min_delta),
            "earlyStopMonitor": str(args.early_stop_monitor),
            "cardLossWeight": float(args.card_loss_weight),
            "resumedFrom": resumed_from,
            "cfrIterations": int(args.cfr_iterations),
            "cfrRegretFloor": float(args.cfr_regret_floor),
            "cfrStrategyDecay": float(args.cfr_strategy_decay),
            "shapeImmediate": float(args.shape_immediate),
        },
        "metricsCount": len(epoch_metrics),
    }
    maybe_write_json(str(args.report_out or ""), report_payload)

    card_acc_text = (
        f" train_card_acc={train_summary.card_acc:.3f}"
        if train_summary.card_acc is not None
        else ""
    )
    print(
        "[train_deepcfr_onnx] "
        f"records={stats['recordsRead']} "
        f"train_records={stats['trainRecords']} "
        f"sampled_records={stats['sampledRecords']} "
        f"place_records={stats['placeRecords']} "
        f"card_records={stats['cardRecords']} "
        f"infosets={len(infosets)} "
        f"states={len(policy_table_model.get('states', {}))} "
        f"train_acc={train_summary.overall_acc:.3f} "
        f"train_place_acc={train_summary.place_acc:.3f}"
        f"{card_acc_text} "
        f"onnx={args.onnx_out}"
    )
    if (args.policy_table_out or "").strip():
        print(f"[train_deepcfr_onnx] policy_table={args.policy_table_out}")
    print(f"[train_deepcfr_onnx] meta={meta_out}")
    if (args.checkpoint_out or "").strip():
        print(f"[train_deepcfr_onnx] checkpoint={args.checkpoint_out}")
    if (args.metrics_out or "").strip():
        print(f"[train_deepcfr_onnx] metrics={args.metrics_out}")
    if (args.report_out or "").strip():
        print(f"[train_deepcfr_onnx] report={args.report_out}")
    if resumed_from:
        print(f"[train_deepcfr_onnx] resumed_from={resumed_from}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
