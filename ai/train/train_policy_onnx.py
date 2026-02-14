#!/usr/bin/env python3
"""Train a small PyTorch policy network and export ONNX (+ optional policy-table fallback)."""

from __future__ import annotations

import argparse
import json
import os
from collections import Counter
from dataclasses import dataclass

import torch
from torch import nn

import train_policy_table as policy_table


MODEL_SCHEMA_VERSION = "policy_onnx.v1"
BOARD_SIZE = 8
BASE_INPUT_DIM = 70
PLACE_OUTPUT_DIM = BOARD_SIZE * BOARD_SIZE
IGNORE_INDEX = -100
MAX_HAND_SIZE = 5.0
NO_CARD_ACTION_ID = "__no_card__"


def load_card_action_ids() -> list[str]:
    catalog_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "cards", "catalog.json")
    )
    try:
        with open(catalog_path, "r", encoding="utf-8") as f:
            payload = json.load(f)
        cards = payload.get("cards") if isinstance(payload, dict) else None
        if not isinstance(cards, list):
            return []

        out: list[str] = []
        seen: set[str] = set()
        for one in cards:
            if not isinstance(one, dict):
                continue
            if one.get("enabled") is False:
                continue
            card_id = one.get("id")
            if not isinstance(card_id, str):
                continue
            card_id = card_id.strip()
            if not card_id or card_id in seen:
                continue
            seen.add(card_id)
            out.append(card_id)
        if len(out) <= 0:
            return []
        return [NO_CARD_ACTION_ID] + out
    except Exception:
        return []


CARD_ACTION_IDS = load_card_action_ids()
CARD_ACTION_INDEX = {card_id: idx for idx, card_id in enumerate(CARD_ACTION_IDS)}
CARD_ACTION_DIM = len(CARD_ACTION_IDS)
NO_CARD_ACTION_INDEX = CARD_ACTION_INDEX.get(NO_CARD_ACTION_ID)
INPUT_DIM = BASE_INPUT_DIM + (CARD_ACTION_DIM * 2)


@dataclass
class DatasetBundle:
    x: torch.Tensor
    y_place: torch.Tensor
    y_card: torch.Tensor
    records_read: int
    train_records: int
    place_records: int
    card_records: int


@dataclass
class TrainSummary:
    overall_acc: float
    place_acc: float
    card_acc: float | None
    place_samples: int
    card_samples: int


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Train ONNX policy model from self-play NDJSON.")
    p.add_argument("--input", required=True, help="Path to NDJSON self-play data.")
    p.add_argument(
        "--onnx-out",
        default=os.path.join("data", "models", "policy-net.onnx"),
        help="Output ONNX path.",
    )
    p.add_argument(
        "--meta-out",
        default=None,
        help="Output metadata JSON path (default: <onnx-out>.meta.json).",
    )
    p.add_argument(
        "--policy-table-out",
        default=os.path.join("data", "models", "policy-table.json"),
        help="Optional compatibility policy-table output path. Empty string disables.",
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
        "--early-stop-monitor",
        default="val_loss",
        help="Metric for early stopping: val_loss or train_loss (default: val_loss).",
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
        "--card-loss-weight",
        type=float,
        default=2.0,
        help="Loss weight for card action head (default: 2.0).",
    )
    p.add_argument("--min-visits", type=int, default=12, help="Compat policy-table --min-visits.")
    p.add_argument(
        "--shape-immediate",
        type=float,
        default=0.4,
        help="Compat policy-table --shape-immediate in [0,1].",
    )
    return p.parse_args()


def parse_board(board: str) -> list[list[str]]:
    if not board:
        return []
    return [list(r) for r in board.split("/")]


def cell_value_for_player(ch: str, player: str) -> float:
    own = "B" if player == "black" else "W"
    opp = "W" if own == "B" else "B"
    if ch == own:
        return 1.0
    if ch == opp:
        return -1.0
    return 0.0


def build_card_counts(card_ids: list[str] | None) -> Counter[str]:
    if not isinstance(card_ids, list):
        return Counter()
    out: Counter[str] = Counter()
    for one in card_ids:
        if not isinstance(one, str):
            continue
        card_id = one.strip()
        if not card_id:
            continue
        out[card_id] += 1
    return out


def feature_vector(rec: dict) -> list[float]:
    board = parse_board(str(rec.get("board", "")))
    player = rec.get("player", "white")
    out = [0.0] * INPUT_DIM

    if len(board) == BOARD_SIZE and all(len(row) == BOARD_SIZE for row in board):
        idx = 0
        for row in board:
            for ch in row:
                out[idx] = cell_value_for_player(ch, player)
                idx += 1

    legal_moves = float(rec.get("legalMoves", 0) or 0)
    charge_black = float(rec.get("chargeBlack", 0) or 0)
    charge_white = float(rec.get("chargeWhite", 0) or 0)
    deck_count = float(rec.get("deckCount", 0) or 0)
    black_before = float(rec.get("blackCountBefore", 0) or 0)
    white_before = float(rec.get("whiteCountBefore", 0) or 0)
    pending_type = rec.get("pendingType")
    pending_flag = 0.0 if pending_type in (None, "", "-", "null") else 1.0

    own_charge = charge_black if player == "black" else charge_white
    opp_charge = charge_white if player == "black" else charge_black
    disc_diff = (black_before - white_before) if player == "black" else (white_before - black_before)

    out[64] = legal_moves / 60.0
    out[65] = disc_diff / 64.0
    out[66] = own_charge / 50.0
    out[67] = opp_charge / 50.0
    out[68] = deck_count / 60.0
    out[69] = pending_flag

    if CARD_ACTION_DIM > 0:
        hand_offset = BASE_INPUT_DIM
        usable_offset = BASE_INPUT_DIM + CARD_ACTION_DIM

        hand_counts = build_card_counts(rec.get("handCards"))
        for card_id, count in hand_counts.items():
            idx = CARD_ACTION_INDEX.get(card_id)
            if idx is None:
                continue
            out[hand_offset + idx] = min(MAX_HAND_SIZE, float(count)) / MAX_HAND_SIZE

        usable_cards = rec.get("usableCardIds")
        if isinstance(usable_cards, list):
            for one in usable_cards:
                if not isinstance(one, str):
                    continue
                idx = CARD_ACTION_INDEX.get(one)
                if idx is None:
                    continue
                out[usable_offset + idx] = 1.0
    return out


def place_target_index(rec: dict) -> int | None:
    if rec.get("actionType") != "place":
        return None
    row = rec.get("row")
    col = rec.get("col")
    if not isinstance(row, int) or not isinstance(col, int):
        return None
    if row < 0 or row >= BOARD_SIZE or col < 0 or col >= BOARD_SIZE:
        return None
    return (row * BOARD_SIZE) + col


def card_target_index(rec: dict) -> int | None:
    if CARD_ACTION_DIM <= 0:
        return None
    action_type = rec.get("actionType")
    if action_type == "use_card":
        card_id = rec.get("useCardId")
        if not isinstance(card_id, str):
            return None
        card_id = card_id.strip()
        if not card_id:
            return None
        return CARD_ACTION_INDEX.get(card_id)

    # Learn "hold card" explicitly when a place move is chosen while cards are usable.
    if action_type == "place" and NO_CARD_ACTION_INDEX is not None:
        usable_cards = rec.get("usableCardIds")
        if isinstance(usable_cards, list):
            for one in usable_cards:
                if isinstance(one, str) and one.strip():
                    return int(NO_CARD_ACTION_INDEX)
    return None


def load_dataset(path: str) -> DatasetBundle:
    xs: list[list[float]] = []
    y_place: list[int] = []
    y_card: list[int] = []
    records_read = 0
    train_records = 0
    place_records = 0
    card_records = 0

    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            records_read += 1
            rec = json.loads(line)
            place_t = place_target_index(rec)
            card_t = card_target_index(rec)
            if place_t is None and card_t is None:
                continue

            xs.append(feature_vector(rec))
            y_place.append(place_t if place_t is not None else IGNORE_INDEX)
            y_card.append(card_t if card_t is not None else IGNORE_INDEX)
            train_records += 1
            if place_t is not None:
                place_records += 1
            if card_t is not None:
                card_records += 1

    if train_records <= 0:
        raise ValueError("no training records were found in input data")

    x = torch.tensor(xs, dtype=torch.float32)
    y_place_tensor = torch.tensor(y_place, dtype=torch.long)
    y_card_tensor = torch.tensor(y_card, dtype=torch.long)
    return DatasetBundle(
        x=x,
        y_place=y_place_tensor,
        y_card=y_card_tensor,
        records_read=records_read,
        train_records=train_records,
        place_records=place_records,
        card_records=card_records,
    )


class PolicyNet(nn.Module):
    def __init__(self, input_dim: int, hidden_size: int, place_output_dim: int, card_output_dim: int):
        super().__init__()
        self.backbone = nn.Sequential(
            nn.Linear(input_dim, hidden_size),
            nn.ReLU(),
            nn.Linear(hidden_size, hidden_size),
            nn.ReLU(),
        )
        self.place_head = nn.Linear(hidden_size, place_output_dim)
        self.card_head = nn.Linear(hidden_size, card_output_dim) if card_output_dim > 0 else None

    def forward(self, obs: torch.Tensor):
        features = self.backbone(obs)
        place_logits = self.place_head(features)
        if self.card_head is None:
            return place_logits
        card_logits = self.card_head(features)
        return place_logits, card_logits


def choose_device(raw: str) -> str:
    if raw == "cpu":
        return "cpu"
    if raw == "cuda":
        if not torch.cuda.is_available():
            raise ValueError("--device=cuda was requested but CUDA is not available")
        return "cuda"
    return "cuda" if torch.cuda.is_available() else "cpu"


def _split_outputs(outputs):
    if isinstance(outputs, (tuple, list)):
        place_logits = outputs[0]
        card_logits = outputs[1] if len(outputs) > 1 else None
        return place_logits, card_logits
    return outputs, None


def _accuracy_from_logits(logits: torch.Tensor, target: torch.Tensor) -> tuple[int, int]:
    mask = target != IGNORE_INDEX
    samples = int(mask.sum().item())
    if samples <= 0:
        return 0, 0
    pred = torch.argmax(logits, dim=1)
    correct = int((pred[mask] == target[mask]).sum().item())
    return correct, samples


def train_model(
    data: DatasetBundle,
    epochs: int,
    batch_size: int,
    lr: float,
    hidden_size: int,
    device: str,
    seed: int,
    val_split: float = 0.1,
    early_stop_patience: int = 0,
    early_stop_min_delta: float = 0.0,
    early_stop_monitor: str = "val_loss",
    resume_checkpoint: str = "",
    log_interval_steps: int = 0,
    card_loss_weight: float = 2.0,
) -> tuple[nn.Module, torch.optim.Optimizer, TrainSummary, str | None, list[dict]]:
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
    if card_loss_weight <= 0:
        raise ValueError("--card-loss-weight must be > 0")
    monitor = str(early_stop_monitor or "").strip().lower()
    if monitor not in ("val_loss", "train_loss"):
        raise ValueError("--early-stop-monitor must be val_loss or train_loss")

    torch.manual_seed(seed)
    if device == "cuda":
        torch.cuda.manual_seed_all(seed)

    model = PolicyNet(INPUT_DIM, hidden_size, PLACE_OUTPUT_DIM, CARD_ACTION_DIM).to(device)
    x = data.x.to(device)
    y_place = data.y_place.to(device)
    y_card = data.y_card.to(device)
    opt = torch.optim.Adam(model.parameters(), lr=lr)
    loss_place_fn = nn.CrossEntropyLoss(ignore_index=IGNORE_INDEX)
    loss_card_fn = nn.CrossEntropyLoss(ignore_index=IGNORE_INDEX) if CARD_ACTION_DIM > 0 else None
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
            raise ValueError(f"failed to load model checkpoint: {resume_path}: {exc}") from exc
        if isinstance(ckpt, dict):
            optimizer_state = ckpt.get("optimizer_state")
            if optimizer_state:
                try:
                    opt.load_state_dict(optimizer_state)
                except Exception:
                    # Optimizer mismatch is non-fatal; keep resumed weights.
                    pass
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
    y_place_train = y_place[train_idx]
    y_card_train = y_card[train_idx]
    x_val = x[val_idx] if val_idx.shape[0] > 0 else None
    y_place_val = y_place[val_idx] if val_idx.shape[0] > 0 else None
    y_card_val = y_card[val_idx] if val_idx.shape[0] > 0 else None
    train_n = int(x_train.shape[0])

    epoch_metrics: list[dict] = []
    global_step = 0
    best_monitor = float("inf")
    best_epoch = 0
    no_improve_count = 0
    stopped_early = False
    early_stop_epoch = None
    best_state: dict | None = None

    for epoch_index in range(epochs):
        perm = torch.randperm(train_n, device=device)
        x_epoch = x_train[perm]
        y_place_epoch = y_place_train[perm]
        y_card_epoch = y_card_train[perm]
        epoch_loss_sum = 0.0
        epoch_samples = 0
        epoch_place_correct = 0
        epoch_place_samples = 0
        epoch_card_correct = 0
        epoch_card_samples = 0
        for i in range(0, train_n, batch_size):
            xb = x_epoch[i:i + batch_size]
            yb_place = y_place_epoch[i:i + batch_size]
            yb_card = y_card_epoch[i:i + batch_size]
            outputs = model(xb)
            place_logits, card_logits = _split_outputs(outputs)
            place_loss = loss_place_fn(place_logits, yb_place)
            loss = place_loss
            if card_logits is not None and loss_card_fn is not None:
                card_loss = loss_card_fn(card_logits, yb_card)
                loss = place_loss + (card_loss * card_loss_weight)
            with torch.no_grad():
                place_correct, place_samples = _accuracy_from_logits(place_logits, yb_place)
                epoch_place_correct += place_correct
                epoch_place_samples += place_samples
                if card_logits is not None:
                    card_correct, card_samples = _accuracy_from_logits(card_logits, yb_card)
                    epoch_card_correct += card_correct
                    epoch_card_samples += card_samples
                batch_size_now = int(yb_place.shape[0])
                epoch_samples += batch_size_now
                epoch_loss_sum += float(loss.item()) * batch_size_now
            opt.zero_grad(set_to_none=True)
            loss.backward()
            opt.step()
            global_step += 1
            if log_interval_steps > 0 and (global_step % log_interval_steps) == 0:
                print(
                    f"[train_policy_onnx] step={global_step} epoch={epoch_index + 1}/{epochs} loss={float(loss.item()):.6f}",
                    flush=True,
                )

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
        if (
            x_val is not None
            and y_place_val is not None
            and y_card_val is not None
            and int(y_place_val.shape[0]) > 0
        ):
            with torch.no_grad():
                outputs_val = model(x_val)
                val_place_logits, val_card_logits = _split_outputs(outputs_val)
                val_place_loss = loss_place_fn(val_place_logits, y_place_val)
                total_val_loss = val_place_loss
                if val_card_logits is not None and loss_card_fn is not None:
                    val_card_loss = loss_card_fn(val_card_logits, y_card_val)
                    total_val_loss = val_place_loss + (val_card_loss * card_loss_weight)
                val_loss = float(total_val_loss.item())

                val_place_correct, val_place_samples = _accuracy_from_logits(val_place_logits, y_place_val)
                val_card_correct = 0
                val_card_samples = 0
                if val_card_logits is not None:
                    val_card_correct, val_card_samples = _accuracy_from_logits(val_card_logits, y_card_val)
                val_place_acc = val_place_correct / max(1, val_place_samples)
                if val_card_samples > 0:
                    val_card_acc = val_card_correct / max(1, val_card_samples)
                val_total_samples = val_place_samples + val_card_samples
                val_total_correct = val_place_correct + val_card_correct
                val_acc = val_total_correct / max(1, val_total_samples)

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

        epoch_metrics.append(
            {
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
            }
        )

        parts = [
            f"[train_policy_onnx] epoch={epoch_index + 1}/{epochs}",
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
                f"[train_policy_onnx] early-stop triggered at epoch={early_stop_epoch} "
                f"best_epoch={best_epoch} best_{monitor}={best_monitor:.6f}",
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
        place_logits_all, card_logits_all = _split_outputs(outputs_all)
        place_correct_all, place_samples_all = _accuracy_from_logits(place_logits_all, y_place)
        card_correct_all = 0
        card_samples_all = 0
        if card_logits_all is not None:
            card_correct_all, card_samples_all = _accuracy_from_logits(card_logits_all, y_card)

    place_acc_all = place_correct_all / max(1, place_samples_all)
    card_acc_all = None
    if card_samples_all > 0:
        card_acc_all = card_correct_all / card_samples_all
    total_samples_all = place_samples_all + card_samples_all
    total_correct_all = place_correct_all + card_correct_all
    overall_acc = total_correct_all / max(1, total_samples_all)

    summary = TrainSummary(
        overall_acc=overall_acc,
        place_acc=place_acc_all,
        card_acc=card_acc_all,
        place_samples=place_samples_all,
        card_samples=card_samples_all,
    )
    return model, opt, summary, resumed_from, epoch_metrics


def export_onnx(model: nn.Module, onnx_out: str) -> None:
    os.makedirs(os.path.dirname(onnx_out) or ".", exist_ok=True)
    model.eval()
    dummy = torch.zeros((1, INPUT_DIM), dtype=torch.float32)

    output_names = ["place_logits"]
    dynamic_axes = {
        "obs": {0: "batch"},
        "place_logits": {0: "batch"},
    }
    if CARD_ACTION_DIM > 0:
        output_names.append("card_logits")
        dynamic_axes["card_logits"] = {0: "batch"}

    torch.onnx.export(
        model.cpu(),
        dummy,
        onnx_out,
        input_names=["obs"],
        output_names=output_names,
        dynamic_axes=dynamic_axes,
        opset_version=17,
    )


def write_meta(
    path: str,
    args: argparse.Namespace,
    data: DatasetBundle,
    train_summary: TrainSummary,
    device: str,
) -> None:
    feature_spec = [
        "board_8x8_perspective_flat",
        "legal_moves_norm",
        "disc_diff_before_norm",
        "own_charge_norm",
        "opp_charge_norm",
        "deck_count_norm",
        "pending_flag",
    ]
    if CARD_ACTION_DIM > 0:
        feature_spec += [
            "hand_card_counts_norm",
            "usable_card_mask",
        ]

    payload = {
        "schemaVersion": MODEL_SCHEMA_VERSION,
        "inputName": "obs",
        "outputName": "place_logits",
        "outputNames": ["place_logits"] + (["card_logits"] if CARD_ACTION_DIM > 0 else []),
        "placeOutputName": "place_logits",
        "cardOutputName": "card_logits" if CARD_ACTION_DIM > 0 else None,
        "inputDim": INPUT_DIM,
        "baseInputDim": BASE_INPUT_DIM,
        "outputDim": PLACE_OUTPUT_DIM,
        "cardOutputDim": CARD_ACTION_DIM,
        "boardSize": BOARD_SIZE,
        "actionSpace": "place_8x8+use_card",
        "cardActionIds": CARD_ACTION_IDS,
        "featureSpec": feature_spec,
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
            "earlyStopMonitor": args.early_stop_monitor,
            "cardLossWeight": args.card_loss_weight,
            "resumeCheckpoint": (args.resume_checkpoint or "").strip() or None,
            "checkpointOut": (args.checkpoint_out or "").strip() or None,
        },
        "stats": {
            "recordsRead": data.records_read,
            "trainRecords": data.train_records,
            "placeRecords": data.place_records,
            "cardRecords": data.card_records,
            "trainAccuracy": train_summary.overall_acc,
            "trainPlaceAccuracy": train_summary.place_acc,
            "trainCardAccuracy": train_summary.card_acc,
            "trainPlaceSamples": train_summary.place_samples,
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
    data: DatasetBundle,
    train_summary: TrainSummary,
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
            "inputDim": INPUT_DIM,
            "baseInputDim": BASE_INPUT_DIM,
            "placeOutputDim": PLACE_OUTPUT_DIM,
            "cardOutputDim": CARD_ACTION_DIM,
            "cardActionIds": CARD_ACTION_IDS,
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
        },
        "stats": {
            "recordsRead": int(data.records_read),
            "trainRecords": int(data.train_records),
            "placeRecords": int(data.place_records),
            "cardRecords": int(data.card_records),
            "trainAccuracy": float(train_summary.overall_acc),
            "trainPlaceAccuracy": float(train_summary.place_acc),
            "trainCardAccuracy": (
                float(train_summary.card_acc)
                if train_summary.card_acc is not None
                else None
            ),
            "trainPlaceSamples": int(train_summary.place_samples),
            "trainCardSamples": int(train_summary.card_samples),
        },
    }
    torch.save(payload, out)


def maybe_write_metrics(metrics_out: str, metrics: list[dict]) -> None:
    out = (metrics_out or "").strip()
    if not out:
        return
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        for entry in metrics:
            f.write(json.dumps(entry, ensure_ascii=False))
            f.write("\n")


def maybe_write_policy_table(args: argparse.Namespace) -> None:
    out = (args.policy_table_out or "").strip()
    if not out:
        return
    if args.min_visits < 1:
        raise ValueError("--min-visits must be >= 1")
    if args.shape_immediate < 0 or args.shape_immediate > 1:
        raise ValueError("--shape-immediate must be in [0,1]")

    policy_table._TRAINING_CONTEXT["shape_immediate"] = float(args.shape_immediate)
    model = policy_table.train(policy_table.iter_ndjson(args.input), int(args.min_visits))
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(model, f, ensure_ascii=False, indent=2)


def main() -> int:
    args = parse_args()
    device = choose_device(str(args.device).strip().lower())
    meta_out = args.meta_out or (args.onnx_out + ".meta.json")

    data = load_dataset(args.input)
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
        early_stop_monitor=str(args.early_stop_monitor or ""),
        resume_checkpoint=str(args.resume_checkpoint or ""),
        log_interval_steps=int(args.log_interval_steps),
        card_loss_weight=float(args.card_loss_weight),
    )
    export_onnx(model, args.onnx_out)
    write_meta(meta_out, args, data, train_summary, device)
    maybe_write_metrics(str(args.metrics_out or ""), epoch_metrics)
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
    maybe_write_policy_table(args)

    card_acc_text = (
        f" train_card_acc={train_summary.card_acc:.3f}"
        if train_summary.card_acc is not None
        else ""
    )
    print(
        "[train_policy_onnx] "
        f"records={data.records_read} "
        f"train_records={data.train_records} "
        f"place_records={data.place_records} "
        f"card_records={data.card_records} "
        f"train_acc={train_summary.overall_acc:.3f} "
        f"train_place_acc={train_summary.place_acc:.3f}"
        f"{card_acc_text} "
        f"onnx={args.onnx_out}"
    )
    if (args.policy_table_out or "").strip():
        print(f"[train_policy_onnx] policy_table={args.policy_table_out}")
    print(f"[train_policy_onnx] meta={meta_out}")
    if (args.checkpoint_out or "").strip():
        print(f"[train_policy_onnx] checkpoint={args.checkpoint_out}")
    if (args.metrics_out or "").strip():
        print(f"[train_policy_onnx] metrics={args.metrics_out}")
    if resumed_from:
        print(f"[train_policy_onnx] resumed_from={resumed_from}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
