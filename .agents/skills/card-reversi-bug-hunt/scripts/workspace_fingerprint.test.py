#!/usr/bin/env python3
"""Regression coverage for workspace_fingerprint.py's Git process handling."""

from __future__ import annotations

import importlib.util
from pathlib import Path
import subprocess
import unittest
from unittest.mock import patch


SCRIPT_PATH = Path(__file__).with_name("workspace_fingerprint.py")
SPEC = importlib.util.spec_from_file_location("workspace_fingerprint_under_test", SCRIPT_PATH)
assert SPEC is not None and SPEC.loader is not None
workspace_fingerprint = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(workspace_fingerprint)


class RunGitTests(unittest.TestCase):
    def test_accepts_successful_git_command_with_stderr_warning(self) -> None:
        completed = subprocess.CompletedProcess(
            args=["git", "diff"],
            returncode=0,
            stdout=b"diff --git a/file b/file\n",
            stderr=b"warning: LF will be replaced by CRLF\n",
        )

        with patch.object(workspace_fingerprint.subprocess, "run", return_value=completed):
            result = workspace_fingerprint.run_git(Path("fixture"), "diff")

        self.assertIs(result, completed)

    def test_reports_nonzero_git_command_without_exposing_stderr(self) -> None:
        completed = subprocess.CompletedProcess(
            args=["git", "diff"],
            returncode=128,
            stdout=b"",
            stderr=b"fatal: private diagnostic\n",
        )

        with patch.object(workspace_fingerprint.subprocess, "run", return_value=completed):
            with self.assertRaisesRegex(workspace_fingerprint.FingerprintError, r"returncode=128") as caught:
                workspace_fingerprint.run_git(Path("fixture"), "diff")

        self.assertNotIn("private diagnostic", str(caught.exception))

    def test_allows_expected_nonzero_result_when_check_is_disabled(self) -> None:
        completed = subprocess.CompletedProcess(
            args=["git", "rev-parse"],
            returncode=1,
            stdout=b"",
            stderr=b"",
        )

        with patch.object(workspace_fingerprint.subprocess, "run", return_value=completed):
            result = workspace_fingerprint.run_git(Path("fixture"), "rev-parse", check=False)

        self.assertIs(result, completed)


if __name__ == "__main__":
    unittest.main()
