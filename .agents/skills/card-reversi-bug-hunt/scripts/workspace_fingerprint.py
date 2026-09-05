#!/usr/bin/env python3
"""Create a deterministic, read-only fingerprint of Git-visible workspace state.

Schema version 1 hashes binary-safe, length-prefixed records with SHA-256. The
records contain HEAD, porcelain-v1 status, staged and unstaged binary diffs, and
every non-ignored untracked path plus its file bytes or symlink target. Only the
aggregate digest is printed for non-task-owned material. Optional task-owned
untracked paths produce path/size/digest metadata, never file contents.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import stat
import struct
import subprocess
import sys
from typing import BinaryIO, Iterable


SCHEMA_VERSION = 1
HASH_ALGORITHM = "sha256"
DOMAIN = b"card-reversi-bug-hunt/workspace-fingerprint"


class FingerprintError(RuntimeError):
    """Raised when a stable, complete fingerprint cannot be produced."""


def run_git(root: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess[bytes]:
    environment = os.environ.copy()
    environment["GIT_OPTIONAL_LOCKS"] = "0"
    result = subprocess.run(
        ["git", "-c", "core.quotepath=false", *args],
        cwd=root,
        env=environment,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if check and result.returncode != 0:
        stderr_details = ""
        if result.stderr:
            stderr_details = (
                f", stderrBytes={len(result.stderr)}, "
                f"stderrSha256={hashlib.sha256(result.stderr).hexdigest()}"
            )
        raise FingerprintError(
            f"git command failed (command={args[0] if args else '<none>'}, "
            f"returncode={result.returncode}{stderr_details})"
        )
    return result


def decode_git_path(raw: bytes) -> str:
    return raw.decode("utf-8", "surrogateescape")


def validate_git_path(value: str) -> PurePosixPath:
    path = PurePosixPath(value)
    if path.is_absolute() or not path.parts or any(part in {"", ".", ".."} for part in path.parts):
        raise FingerprintError(f"task untracked path must be a safe repository-relative path: {value!r}")
    return path


def parse_task_git_path(value: str) -> PurePosixPath:
    # Git paths use '/' as the directory separator. A backslash, when present,
    # is a literal filename character and must never be normalized to '/'.
    return validate_git_path(value)


def local_path(root: Path, git_path: PurePosixPath) -> Path:
    return root.joinpath(*git_path.parts)


class LengthPrefixedHasher:
    def __init__(self) -> None:
        self._hash = hashlib.sha256()
        self.record(b"domain", DOMAIN)
        self.record(b"schema-version", str(SCHEMA_VERSION).encode("ascii"))

    def _header(self, tag: bytes, payload_length: int) -> None:
        self._hash.update(struct.pack(">I", len(tag)))
        self._hash.update(tag)
        self._hash.update(struct.pack(">Q", payload_length))

    def record(self, tag: bytes, payload: bytes) -> None:
        self._header(tag, len(payload))
        self._hash.update(payload)

    def file_record(self, tag: bytes, path: Path) -> tuple[int, str]:
        before = path.stat(follow_symlinks=False)
        if not stat.S_ISREG(before.st_mode):
            raise FingerprintError(f"unsupported untracked entry type: {path}")

        self._header(tag, before.st_size)
        file_hash = hashlib.sha256()
        bytes_read = 0
        with path.open("rb") as stream:
            for chunk in iter_file_chunks(stream):
                bytes_read += len(chunk)
                self._hash.update(chunk)
                file_hash.update(chunk)

        after = path.stat(follow_symlinks=False)
        before_identity = (before.st_mode, before.st_size, before.st_mtime_ns)
        after_identity = (after.st_mode, after.st_size, after.st_mtime_ns)
        if bytes_read != before.st_size or before_identity != after_identity:
            raise FingerprintError(f"workspace changed while reading untracked file: {path}")
        return bytes_read, file_hash.hexdigest()

    def hexdigest(self) -> str:
        return self._hash.hexdigest()


def iter_file_chunks(stream: BinaryIO, chunk_size: int = 1024 * 1024) -> Iterable[bytes]:
    while True:
        chunk = stream.read(chunk_size)
        if not chunk:
            return
        yield chunk


def stable_file_sha256(path: Path) -> tuple[int, str]:
    before = path.stat(follow_symlinks=False)
    if not stat.S_ISREG(before.st_mode):
        raise FingerprintError(f"expected a regular file: {path}")
    digest = hashlib.sha256()
    bytes_read = 0
    with path.open("rb") as stream:
        for chunk in iter_file_chunks(stream):
            bytes_read += len(chunk)
            digest.update(chunk)
    after = path.stat(follow_symlinks=False)
    before_identity = (before.st_mode, before.st_size, before.st_mtime_ns)
    after_identity = (after.st_mode, after.st_size, after.st_mtime_ns)
    if bytes_read != before.st_size or before_identity != after_identity:
        raise FingerprintError(f"file changed while hashing: {path}")
    return bytes_read, digest.hexdigest()


def read_symlink(path: Path) -> bytes:
    target = os.readlink(path)
    if isinstance(target, bytes):
        return target
    return target.encode("utf-8", "surrogateescape")


def fingerprint_workspace(root: Path) -> tuple[dict[str, object], dict[str, tuple[Path, str, int, str]]]:
    head_result = run_git(root, "rev-parse", "--verify", "--quiet", "HEAD", check=False)
    head = head_result.stdout.strip() if head_result.returncode == 0 else b"<unborn>"
    status_bytes = run_git(root, "status", "--porcelain=v1", "-z", "--untracked-files=all").stdout
    staged_diff = run_git(root, "diff", "--cached", "--binary", "--no-ext-diff", "--no-textconv").stdout
    unstaged_diff = run_git(root, "diff", "--binary", "--no-ext-diff", "--no-textconv").stdout
    untracked_raw = run_git(root, "ls-files", "--others", "--exclude-standard", "-z").stdout
    untracked_paths = sorted(item for item in untracked_raw.split(b"\0") if item)

    workspace = LengthPrefixedHasher()
    workspace.record(b"head", head)
    workspace.record(b"porcelain-status-v1-z", status_bytes)
    workspace.record(b"staged-binary-diff", staged_diff)
    workspace.record(b"unstaged-binary-diff", unstaged_diff)
    workspace.record(b"untracked-count", str(len(untracked_paths)).encode("ascii"))

    untracked_metadata: dict[str, tuple[Path, str, int, str]] = {}
    for raw_path in untracked_paths:
        decoded = decode_git_path(raw_path)
        git_path = validate_git_path(decoded)
        path = local_path(root, git_path)
        entry_stat = path.lstat()

        workspace.record(b"untracked-path", raw_path)
        workspace.record(b"untracked-mode", str(entry_stat.st_mode).encode("ascii"))
        if stat.S_ISLNK(entry_stat.st_mode):
            target = read_symlink(path)
            after_stat = path.lstat()
            before_identity = (entry_stat.st_mode, entry_stat.st_size, entry_stat.st_mtime_ns)
            after_identity = (after_stat.st_mode, after_stat.st_size, after_stat.st_mtime_ns)
            if before_identity != after_identity:
                raise FingerprintError(f"workspace changed while reading untracked symlink: {path}")
            workspace.record(b"untracked-symlink-target", target)
            digest = hashlib.sha256(target).hexdigest()
            untracked_metadata[git_path.as_posix()] = (path, "symlink", len(target), digest)
        elif stat.S_ISREG(entry_stat.st_mode):
            size, digest = workspace.file_record(b"untracked-file-content", path)
            untracked_metadata[git_path.as_posix()] = (path, "file", size, digest)
        else:
            raise FingerprintError(f"unsupported untracked entry type: {path}")

    result: dict[str, object] = {
        "schemaVersion": SCHEMA_VERSION,
        "algorithm": HASH_ALGORITHM,
        "head": head.decode("ascii", "replace"),
        "workspaceFingerprint": workspace.hexdigest(),
        "untrackedFileCount": len(untracked_paths),
    }
    return result, untracked_metadata


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Print a deterministic read-only fingerprint of Git-visible workspace state."
    )
    parser.add_argument("--repo", default=".", help="Repository path; defaults to the current directory.")
    parser.add_argument(
        "--task-untracked",
        action="append",
        default=[],
        metavar="PATH",
        help="Repository-relative task-owned untracked file to expose as path/size/hash metadata.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    helper_path = Path(__file__).resolve()
    helper_byte_length, helper_sha256 = stable_file_sha256(helper_path)
    requested_root = Path(args.repo).resolve()
    top_level_result = run_git(requested_root, "rev-parse", "--show-toplevel")
    top_level_bytes = top_level_result.stdout
    if top_level_bytes.endswith(b"\r\n"):
        top_level_bytes = top_level_bytes[:-2]
    elif top_level_bytes.endswith(b"\n"):
        top_level_bytes = top_level_bytes[:-1]
    if not top_level_bytes:
        raise FingerprintError("git returned an empty repository root")
    root = Path(top_level_bytes.decode("utf-8", "surrogateescape")).resolve()

    first_result, _ = fingerprint_workspace(root)
    result, untracked_metadata = fingerprint_workspace(root)
    if first_result["workspaceFingerprint"] != result["workspaceFingerprint"]:
        raise FingerprintError("workspace changed between consecutive fingerprint snapshots")

    task_entries: list[dict[str, object]] = []
    seen: set[str] = set()
    for raw_value in args.task_untracked:
        git_path = parse_task_git_path(raw_value).as_posix()
        if git_path in seen:
            continue
        seen.add(git_path)
        metadata = untracked_metadata.get(git_path)
        if metadata is None:
            raise FingerprintError(f"task untracked path is not an untracked file: {git_path}")
        _, kind, byte_length, digest = metadata
        task_entries.append(
            {
                "path": git_path,
                "kind": kind,
                "byteLength": byte_length,
                "contentSha256": digest,
            }
        )

    result["taskUntracked"] = sorted(task_entries, key=lambda entry: str(entry["path"]))
    result["consecutiveMatchingSnapshots"] = 2
    final_helper_byte_length, final_helper_sha256 = stable_file_sha256(helper_path)
    if (helper_byte_length, helper_sha256) != (final_helper_byte_length, final_helper_sha256):
        raise FingerprintError("workspace fingerprint helper changed during execution")
    result["helperByteLength"] = helper_byte_length
    result["helperSha256"] = helper_sha256
    result["repositoryRoot"] = str(root)
    print(json.dumps(result, ensure_ascii=True, sort_keys=True, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (FingerprintError, FileNotFoundError, OSError) as error:
        safe_error = str(error).encode("utf-8", "backslashreplace").decode("utf-8")
        print(f"workspace fingerprint failed: {safe_error}", file=sys.stderr)
        raise SystemExit(2)
