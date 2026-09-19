"""CODEX REPRODUCTION TESTS for the new host capture protocol."""
from __future__ import annotations

import csv
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))

from capture_biomed import (  # noqa: E402
    FULL_COLUMNS,
    RAW_COLUMNS,
    SessionWriter,
    parse_protocol_line,
)


def raw_values(sequence: int = 1) -> list[str]:
    values = ["0"] * len(RAW_COLUMNS)
    values[0] = "1"
    values[1] = "123"
    values[2] = str(sequence)
    values[3] = str(sequence * 40_000)
    values[4] = str(sequence * 40_000 + 100)
    values[5] = "ESTIMATED_PERIODIC"
    values[6] = "1"
    values[7] = "1"
    values[8] = "10000"
    values[9] = "20000"
    return values


class TestCaptureProtocol(unittest.TestCase):
    def test_raw_and_full_schema(self) -> None:
        kind, record = parse_protocol_line("@VW_RAW," + ",".join(raw_values()) + "\n")
        self.assertEqual(kind, "sample")
        self.assertEqual(record["sample_index"], "1")
        self.assertEqual(record["ir_raw"], "20000")
        self.assertEqual(record[FULL_COLUMNS[-1]], "")

        full = raw_values(2) + ["0"] * len(FULL_COLUMNS)
        kind, record = parse_protocol_line("@VW_RAW," + ",".join(full))
        self.assertEqual(kind, "sample")
        self.assertEqual(record["sample_index"], "2")

    def test_corrupt_structured_line_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            parse_protocol_line("@VW_RAW,1,too,few")
        with self.assertRaises(ValueError):
            parse_protocol_line("@VW_UNKNOWN,1,2")

    def test_session_files_and_sequence_evidence(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp) / "session"
            writer = SessionWriter(directory, {"test": True})
            writer.consume(b"@VW_META,lab_id,test_lab\n")
            writer.consume(("@VW_RAW," + ",".join(raw_values(1)) + "\n").encode())
            writer.consume(("@VW_RAW," + ",".join(raw_values(3)) + "\n").encode())
            writer.consume(b"@VW_RAW,broken\n")
            writer.close()

            self.assertEqual((directory / "serial_raw.log").read_bytes().count(b"\n"), 4)
            with (directory / "samples.csv").open(encoding="utf-8", newline="") as handle:
                rows = list(csv.DictReader(handle))
            self.assertEqual([row["sample_index"] for row in rows], ["1", "3"])
            summary = json.loads((directory / "session_summary.json").read_text(encoding="utf-8"))
            self.assertEqual(summary["sequence_gaps_observed"], 1)
            self.assertEqual(summary["corrupt_protocol_lines"], 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
