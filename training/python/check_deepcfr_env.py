#!/usr/bin/env python3
"""Local diagnostics for DeepCFR/CFR+ foundation environment."""

from __future__ import annotations

import json
import platform
import sys
import time
from typing import Any


def try_import(module_name: str) -> tuple[Any | None, str | None]:
    try:
        module = __import__(module_name)
        return module, None
    except Exception as exc:  # pragma: no cover - defensive
        return None, str(exc)


def benchmark_matmul_torch(torch_mod: Any, device: str, size: int = 1024, rounds: int = 6) -> float:
    x = torch_mod.randn(size, size, device=device)
    y = torch_mod.randn(size, size, device=device)
    _ = x @ y  # warm-up
    if device.startswith("cuda"):
        torch_mod.cuda.synchronize()
    start = time.perf_counter()
    for _ in range(rounds):
        _ = x @ y
    if device.startswith("cuda"):
        torch_mod.cuda.synchronize()
    elapsed = time.perf_counter() - start
    return elapsed / rounds


def main() -> int:
    payload: dict[str, Any] = {
        "python": platform.python_version(),
        "platform": platform.platform(),
        "ok": True,
        "errors": [],
        "warnings": [],
        "modules": {},
    }

    required_modules = ("torch", "numpy", "onnx", "yaml")
    optional_modules = ("tensorboard",)
    loaded_modules: dict[str, Any] = {}

    for module_name in required_modules:
        module, err = try_import(module_name)
        payload["modules"][module_name] = {
            "available": module is not None,
            "error": err,
        }
        if module is None:
            payload["errors"].append(f"required module is missing: {module_name} ({err})")
            payload["ok"] = False
        else:
            loaded_modules[module_name] = module
            version = getattr(module, "__version__", None)
            if isinstance(version, str):
                payload["modules"][module_name]["version"] = version

    for module_name in optional_modules:
        module, err = try_import(module_name)
        payload["modules"][module_name] = {
            "available": module is not None,
            "error": err,
        }
        if module is not None:
            version = getattr(module, "__version__", None)
            if isinstance(version, str):
                payload["modules"][module_name]["version"] = version

    torch_mod = loaded_modules.get("torch")
    if torch_mod is not None:
        cuda_available = bool(torch_mod.cuda.is_available())
        payload["torch"] = {
            "version": str(getattr(torch_mod, "__version__", "unknown")),
            "cuda_available": cuda_available,
            "device_count": int(torch_mod.cuda.device_count()) if cuda_available else 0,
            "avg_matmul_sec_cpu": benchmark_matmul_torch(torch_mod, "cpu"),
        }
        if cuda_available:
            payload["torch"]["device_name_0"] = str(torch_mod.cuda.get_device_name(0))
            payload["torch"]["avg_matmul_sec_cuda"] = benchmark_matmul_torch(torch_mod, "cuda")
        else:
            payload["warnings"].append("CUDA is not available. Deep training will run slower on CPU.")

    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0 if payload["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
