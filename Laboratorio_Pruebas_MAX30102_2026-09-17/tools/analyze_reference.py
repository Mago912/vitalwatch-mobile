#!/usr/bin/env python3
"""Compare MAX30102 results with manual reference readings.

The tool never changes or calibrates the firmware. It only pairs each manual
reference with nearby samples and reports the error of trusted sensor values.
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import statistics
from pathlib import Path
from typing import Iterable


METRICS = {
    "HR": {
        "value_field": "bpm_result",
        "status_field": "hr_status",
        "quality_field": "hr_quality",
        "valid_statuses": {"0", "VALID"},
        "target_error": 5.0,
        "unit": "bpm",
    },
    "SPO2": {
        "value_field": "spo2_result",
        "status_field": "spo2_status",
        "quality_field": "spo2_quality",
        "valid_statuses": {"0", "EXPERIMENTAL_VALID"},
        "target_error": 2.0,
        "unit": "%",
    },
}

TRUSTED_QUALITIES = {"0", "1", "GOOD", "FAIR"}
OUTPUT_COLUMNS = [
    "session_id",
    "reference_type",
    "reference_time_us",
    "reference_value",
    "source",
    "window_seconds",
    "samples_in_window",
    "finite_samples",
    "valid_status_samples",
    "trusted_samples",
    "sensor_median",
    "signed_error",
    "absolute_error",
    "target_error",
    "within_target",
    "comparison_status",
]


def _finite(value: object) -> float | None:
    try:
        parsed = float(str(value).strip())
    except (TypeError, ValueError):
        return None
    return parsed if math.isfinite(parsed) else None


def _time_us(value: object) -> int | None:
    parsed = _finite(value)
    if parsed is None or parsed < 0:
        return None
    return int(parsed)


def _read_csv(path: Path) -> list[dict[str, str]]:
    if not path.is_file():
        raise FileNotFoundError(f"No existe {path}")
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def _median(values: list[float]) -> float | None:
    return statistics.median(values) if values else None


def _rounded(value: float | None) -> str:
    return "" if value is None else f"{value:.3f}"


def compare_references(
    samples: list[dict[str, str]],
    references: list[dict[str, str]],
    window_seconds: float,
) -> list[dict[str, object]]:
    """Pair references with trusted nearby samples.

    A trusted sample must have the firmware's valid status and GOOD or FAIR
    quality. UNSTABLE and POOR readings remain counted for diagnosis but are
    never used as the reported estimate.
    """
    window_us = int(window_seconds * 1_000_000)
    timed_samples = [
        (sample_time, row)
        for row in samples
        if (sample_time := _time_us(row.get("sample_time_us"))) is not None
    ]
    comparisons: list[dict[str, object]] = []

    for reference in references:
        reference_type = str(reference.get("reference_type", "")).strip().upper()
        config = METRICS.get(reference_type)
        reference_time = _time_us(reference.get("device_time_us"))
        reference_value = _finite(reference.get("value"))
        base: dict[str, object] = {
            "session_id": reference.get("session_id", ""),
            "reference_type": reference_type,
            "reference_time_us": "" if reference_time is None else reference_time,
            "reference_value": _rounded(reference_value),
            "source": reference.get("source", ""),
            "window_seconds": window_seconds,
            "samples_in_window": 0,
            "finite_samples": 0,
            "valid_status_samples": 0,
            "trusted_samples": 0,
            "sensor_median": "",
            "signed_error": "",
            "absolute_error": "",
            "target_error": "" if config is None else config["target_error"],
            "within_target": "",
            "comparison_status": "INVALID_REFERENCE",
        }
        if config is None or reference_time is None or reference_value is None:
            comparisons.append(base)
            continue

        nearby = [
            row for sample_time, row in timed_samples
            if abs(sample_time - reference_time) <= window_us
        ]
        finite_values: list[float] = []
        valid_values: list[float] = []
        trusted_values: list[float] = []
        for row in nearby:
            value = _finite(row.get(str(config["value_field"])))
            if value is None:
                continue
            finite_values.append(value)
            status = str(row.get(str(config["status_field"]), "")).strip().upper()
            if status not in config["valid_statuses"]:
                continue
            valid_values.append(value)
            quality = str(row.get(str(config["quality_field"]), "")).strip().upper()
            if quality in TRUSTED_QUALITIES:
                trusted_values.append(value)

        estimate = _median(trusted_values)
        base.update({
            "samples_in_window": len(nearby),
            "finite_samples": len(finite_values),
            "valid_status_samples": len(valid_values),
            "trusted_samples": len(trusted_values),
        })
        if estimate is None:
            base["comparison_status"] = "NO_TRUSTED_SENSOR_VALUE"
            comparisons.append(base)
            continue

        signed_error = estimate - reference_value
        absolute_error = abs(signed_error)
        base.update({
            "sensor_median": _rounded(estimate),
            "signed_error": _rounded(signed_error),
            "absolute_error": _rounded(absolute_error),
            "within_target": absolute_error <= float(config["target_error"]),
            "comparison_status": "COMPARABLE",
        })
        comparisons.append(base)

    return comparisons


def summarize(comparisons: list[dict[str, object]]) -> dict[str, object]:
    result: dict[str, object] = {
        "warning": "Experimental engineering comparison; not clinical validation.",
        "metrics": {},
    }
    metrics: dict[str, object] = result["metrics"]  # type: ignore[assignment]
    for metric in METRICS:
        rows = [row for row in comparisons if row["reference_type"] == metric]
        comparable = [row for row in rows if row["comparison_status"] == "COMPARABLE"]
        errors = [float(row["absolute_error"]) for row in comparable]
        within = sum(row["within_target"] is True for row in comparable)
        metrics[metric] = {
            "references": len(rows),
            "comparable": len(comparable),
            "without_trusted_sensor_value": sum(
                row["comparison_status"] == "NO_TRUSTED_SENSOR_VALUE" for row in rows
            ),
            "mean_absolute_error": None if not errors else round(statistics.mean(errors), 3),
            "median_absolute_error": None if not errors else round(statistics.median(errors), 3),
            "maximum_absolute_error": None if not errors else round(max(errors), 3),
            "within_target": within,
            "within_target_ratio": None if not comparable else round(within / len(comparable), 3),
            "target_error": METRICS[metric]["target_error"],
            "unit": METRICS[metric]["unit"],
        }
    return result


def analyze_session(
    session: Path,
    window_seconds: float = 5.0,
) -> tuple[list[dict[str, object]], dict[str, object]]:
    if window_seconds <= 0:
        raise ValueError("window_seconds debe ser mayor que cero")
    samples = _read_csv(session / "samples.csv")
    references = _read_csv(session / "reference.csv")
    comparisons = compare_references(samples, references, window_seconds)
    return comparisons, summarize(comparisons)


def write_results(
    session: Path,
    comparisons: list[dict[str, object]],
    summary: dict[str, object],
) -> None:
    with (session / "reference_comparison.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=OUTPUT_COLUMNS)
        writer.writeheader()
        writer.writerows(comparisons)
    (session / "reference_summary.json").write_text(
        json.dumps(summary, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("session", type=Path, help="Carpeta RAW de una sesion")
    parser.add_argument("--window-seconds", type=float, default=5.0)
    parser.add_argument("--no-write", action="store_true", help="Solo mostrar el resumen")
    return parser


def main(argv: Iterable[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    session = args.session.resolve()
    try:
        comparisons, summary = analyze_session(session, args.window_seconds)
    except (FileNotFoundError, ValueError) as exc:
        print(f"ERROR: {exc}")
        return 2
    if not args.no_write:
        write_results(session, comparisons, summary)
    print(json.dumps(summary, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
