"""Tests for the external-reference comparison tool."""
from __future__ import annotations

import csv
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))

from analyze_reference import analyze_session, write_results  # noqa: E402


class TestReferenceAnalysis(unittest.TestCase):
    def _session(self, root: Path, samples: list[dict[str, object]], references: list[dict[str, object]]) -> Path:
        session = root / "session"
        session.mkdir()
        sample_fields = [
            "sample_time_us", "bpm_result", "hr_status", "hr_quality",
            "spo2_result", "spo2_status", "spo2_quality",
        ]
        with (session / "samples.csv").open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=sample_fields)
            writer.writeheader()
            writer.writerows(samples)
        reference_fields = ["session_id", "device_time_us", "reference_type", "value", "source"]
        with (session / "reference.csv").open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=reference_fields)
            writer.writeheader()
            writer.writerows(references)
        return session

    def test_uses_median_of_valid_fair_hr_and_rejects_unstable_outlier(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            session = self._session(Path(temp), [
                {"sample_time_us": 900_000, "bpm_result": 70, "hr_status": 0, "hr_quality": 1},
                {"sample_time_us": 1_000_000, "bpm_result": 72, "hr_status": 0, "hr_quality": 1},
                {"sample_time_us": 1_100_000, "bpm_result": 140, "hr_status": 2, "hr_quality": 2},
                {"sample_time_us": 8_000_000, "bpm_result": 40, "hr_status": 0, "hr_quality": 0},
            ], [{
                "session_id": "1", "device_time_us": 1_000_000,
                "reference_type": "HR", "value": 71, "source": "oximetro",
            }])
            rows, summary = analyze_session(session, window_seconds=1)
            self.assertEqual(rows[0]["sensor_median"], "71.000")
            self.assertEqual(rows[0]["trusted_samples"], 2)
            self.assertEqual(rows[0]["finite_samples"], 3)
            self.assertEqual(rows[0]["comparison_status"], "COMPARABLE")
            self.assertEqual(summary["metrics"]["HR"]["mean_absolute_error"], 0.0)

    def test_does_not_promote_unstable_or_poor_samples(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            session = self._session(Path(temp), [
                {"sample_time_us": 1_000_000, "bpm_result": 130, "hr_status": 2, "hr_quality": 2},
                {"sample_time_us": 1_100_000, "bpm_result": 75, "hr_status": 0, "hr_quality": 2},
            ], [{
                "session_id": "1", "device_time_us": 1_000_000,
                "reference_type": "HR", "value": 74, "source": "oximetro",
            }])
            rows, _ = analyze_session(session, window_seconds=1)
            self.assertEqual(rows[0]["comparison_status"], "NO_TRUSTED_SENSOR_VALUE")
            self.assertEqual(rows[0]["sensor_median"], "")
            self.assertEqual(rows[0]["valid_status_samples"], 1)

    def test_compares_spo2_and_writes_artifacts(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            session = self._session(Path(temp), [
                {"sample_time_us": 2_000_000, "spo2_result": 97, "spo2_status": 0, "spo2_quality": 1},
                {"sample_time_us": 2_100_000, "spo2_result": 99, "spo2_status": 0, "spo2_quality": 1},
            ], [{
                "session_id": "2", "device_time_us": 2_000_000,
                "reference_type": "SPO2", "value": 98, "source": "oximetro",
            }])
            rows, summary = analyze_session(session, window_seconds=1)
            write_results(session, rows, summary)
            self.assertTrue((session / "reference_comparison.csv").is_file())
            self.assertTrue((session / "reference_summary.json").is_file())
            self.assertEqual(summary["metrics"]["SPO2"]["within_target_ratio"], 1.0)

    def test_rejects_non_positive_window(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            session = self._session(Path(temp), [], [])
            with self.assertRaises(ValueError):
                analyze_session(session, window_seconds=0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
