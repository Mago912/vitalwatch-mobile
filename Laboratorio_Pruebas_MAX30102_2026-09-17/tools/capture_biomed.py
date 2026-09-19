#!/usr/bin/env python3
"""Captura reproducible del laboratorio VitalWatch MAX30102.

Conserva el flujo serie exacto y separa los registros @VW_* en artefactos CSV.
Requiere ``pyserial`` solamente para una captura física; el parser se prueba sin
hardware y sin esa dependencia.
"""
from __future__ import annotations

import argparse
import csv
import json
import queue
import re
import sys
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

RAW_COLUMNS = [
    "schema_version", "session_id", "sample_index", "sample_time_us",
    "service_time_us", "timestamp_source", "read_valid", "timing_valid",
    "red_raw", "ir_raw", "check_found", "software_available",
    "hardware_overflow_raw", "hardware_overflow_total",
    "software_overflow_total", "short_read_total", "sequence_gap_total",
    "logger_drop_total", "imu_valid", "imu_time_us", "ax_g", "ay_g",
    "az_g", "acceleration_magnitude_g", "gyro_magnitude_rad_s", "imu_dt_us",
    "imu_saturated",
]

FULL_COLUMNS = [
    "ir_dc", "ir_ac", "ir_filtered", "peak_bits", "ibi_ms", "bpm_instant",
    "bpm_result", "hr_status", "hr_quality", "hr_quality_flags",
    "spo2_result", "spo2_status", "spo2_quality", "led_amplitude",
    "spo2_maxim", "spo2_maxim_valid", "spo2_research_candidate",
    "measurement_state", "processing_us", "loop_last_us", "loop_max_us",
    "display_render_us", "i2c_failures",
]

EVENT_COLUMNS = [
    "session_id", "device_time_us", "event_type", "value_1", "value_2",
    "value_3", "note",
]
REFERENCE_COLUMNS = [
    "session_id", "device_time_us", "reference_type", "value", "source",
]
STATUS_COLUMNS = [
    "session_id", "device_time_us", "mode", "active", "queue_depth",
    "logger_drop_total", "session_samples", "hardware_overflow_total",
    "software_overflow_total", "short_read_total", "sequence_gap_total",
    "max_fifo_backlog",
]


def _csv_fields(text: str) -> list[str]:
    return next(csv.reader([text]))


def parse_protocol_line(text: str) -> tuple[str, object] | None:
    """Parsea una línea; lanza ValueError para registros @VW_* corruptos."""
    line = text.rstrip("\r\n")
    if not line.startswith("@VW_"):
        return None
    fields = _csv_fields(line)
    record_type = fields[0]
    if record_type == "@VW_META":
        if len(fields) != 3 or not fields[1]:
            raise ValueError("META requiere clave y valor")
        return "meta", (fields[1], fields[2])
    if record_type == "@VW_RAW":
        if len(fields) not in (1 + len(RAW_COLUMNS), 1 + len(RAW_COLUMNS) + len(FULL_COLUMNS)):
            raise ValueError(f"RAW tiene {len(fields)} campos")
        values = fields[1:]
        if len(values) == len(RAW_COLUMNS):
            values += [""] * len(FULL_COLUMNS)
        return "sample", dict(zip(RAW_COLUMNS + FULL_COLUMNS, values))
    if record_type == "@VW_EVT":
        if len(fields) != 1 + len(EVENT_COLUMNS):
            raise ValueError(f"EVT tiene {len(fields)} campos")
        return "event", dict(zip(EVENT_COLUMNS, fields[1:]))
    if record_type == "@VW_REF":
        if len(fields) != 1 + len(REFERENCE_COLUMNS):
            raise ValueError(f"REF tiene {len(fields)} campos")
        return "reference", dict(zip(REFERENCE_COLUMNS, fields[1:]))
    if record_type == "@VW_STAT":
        if len(fields) != 1 + len(STATUS_COLUMNS):
            raise ValueError(f"STAT tiene {len(fields)} campos")
        return "status", dict(zip(STATUS_COLUMNS, fields[1:]))
    raise ValueError(f"tipo desconocido: {record_type}")


@dataclass
class CaptureSummary:
    received_lines: int = 0
    protocol_lines: int = 0
    samples: int = 0
    events: int = 0
    references: int = 0
    statuses: int = 0
    corrupt_protocol_lines: int = 0
    sequence_gaps_observed: int = 0
    duplicate_sequences: int = 0
    first_sequence: int | None = None
    last_sequence: int | None = None
    started_utc: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    ended_utc: str | None = None

    def observe_sequence(self, value: str) -> None:
        sequence = int(value)
        if self.first_sequence is None:
            self.first_sequence = sequence
        if self.last_sequence is not None:
            if sequence == self.last_sequence:
                self.duplicate_sequences += 1
            elif sequence > self.last_sequence + 1:
                self.sequence_gaps_observed += sequence - self.last_sequence - 1
        self.last_sequence = sequence


class SessionWriter:
    def __init__(self, directory: Path, host_metadata: dict[str, object]):
        directory.mkdir(parents=True, exist_ok=False)
        self.directory = directory
        self.metadata: dict[str, object] = {"host": host_metadata, "device": {}}
        self.summary = CaptureSummary()
        self.raw_log = (directory / "serial_raw.log").open("wb")
        self.samples_file, self.samples = self._csv("samples.csv", RAW_COLUMNS + FULL_COLUMNS)
        self.events_file, self.events = self._csv("events.csv", EVENT_COLUMNS)
        self.references_file, self.references = self._csv("reference.csv", REFERENCE_COLUMNS)
        self.status_file, self.status = self._csv("status.csv", STATUS_COLUMNS)

    def _csv(self, name: str, columns: list[str]):
        handle = (self.directory / name).open("w", encoding="utf-8", newline="")
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        return handle, writer

    def consume(self, raw: bytes) -> None:
        self.raw_log.write(raw)
        self.raw_log.flush()
        self.summary.received_lines += 1
        text = raw.decode("utf-8", errors="replace")
        try:
            parsed = parse_protocol_line(text)
        except (ValueError, csv.Error, UnicodeError) as exc:
            if text.lstrip().startswith("@VW_"):
                self.summary.corrupt_protocol_lines += 1
                self.events.writerow({
                    "session_id": "", "device_time_us": "",
                    "event_type": "HOST_PARSE_ERROR", "value_1": "",
                    "value_2": "", "value_3": "", "note": str(exc),
                })
                self.events_file.flush()
            return
        if parsed is None:
            return
        self.summary.protocol_lines += 1
        kind, payload = parsed
        if kind == "meta":
            key, value = payload
            self.metadata["device"][key] = value
        elif kind == "sample":
            self.samples.writerow(payload)
            self.samples_file.flush()
            self.summary.samples += 1
            self.summary.observe_sequence(payload["sample_index"])
        elif kind == "event":
            self.events.writerow(payload); self.events_file.flush(); self.summary.events += 1
        elif kind == "reference":
            self.references.writerow(payload); self.references_file.flush(); self.summary.references += 1
        elif kind == "status":
            self.status.writerow(payload); self.status_file.flush(); self.summary.statuses += 1

    def close(self) -> None:
        self.summary.ended_utc = datetime.now(timezone.utc).isoformat()
        for handle in (self.raw_log, self.samples_file, self.events_file,
                       self.references_file, self.status_file):
            handle.close()
        (self.directory / "metadata.json").write_text(
            json.dumps(self.metadata, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        (self.directory / "session_summary.json").write_text(
            json.dumps(self.summary.__dict__, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def _safe_name(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_.-]+", "_", value).strip("._")
    if not cleaned:
        raise ValueError("identificador vacío")
    return cleaned[:31]


def _stdin_commands(target: queue.SimpleQueue[str]) -> None:
    for line in sys.stdin:
        command = line.strip()
        if command:
            target.put(command)


def list_ports() -> int:
    try:
        from serial.tools import list_ports as serial_list_ports
    except ImportError:
        print("Falta pyserial: instale con 'python -m pip install pyserial'", file=sys.stderr)
        return 2
    for port in serial_list_ports.comports():
        print(f"{port.device}\t{port.description}\t{port.hwid}")
    return 0


def capture(args: argparse.Namespace) -> int:
    try:
        import serial
    except ImportError:
        print("Falta pyserial: instale con 'python -m pip install pyserial'", file=sys.stderr)
        return 2
    test_id, subject_id = _safe_name(args.test_id), _safe_name(args.subject_id)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output = Path(args.output).resolve() / f"{stamp}_{test_id}_{subject_id}"
    writer = SessionWriter(output, {
        "tool": "capture_biomed.py", "port": args.port, "baud": args.baud,
        "requested_mode": args.mode, "test_id": test_id, "subject_id": subject_id,
    })
    commands: queue.SimpleQueue[str] = queue.SimpleQueue()
    if not args.no_stdin:
        threading.Thread(target=_stdin_commands, args=(commands,), daemon=True).start()
    ser = None
    try:
        ser = serial.Serial(args.port, args.baud, timeout=0.1, write_timeout=1)
        time.sleep(args.boot_wait)
        ser.reset_input_buffer()
        for command in (f"BIO MODE {args.mode}", f"BIO TEST START {test_id} {subject_id}"):
            ser.write((command + "\n").encode("ascii")); ser.flush()
        print(f"Capturando en {output}")
        print("Puede escribir BIO MARK ..., BIO REF HR ..., BIO REF SPO2 ..., BIO STATUS o STOP.")
        started = time.monotonic()
        stopping = False
        stop_sent_at = 0.0
        while True:
            raw = ser.readline()
            if raw:
                writer.consume(raw)
            while not commands.empty():
                command = commands.get()
                if command.upper() == "STOP":
                    command = "BIO TEST STOP"; stopping = True; stop_sent_at = time.monotonic()
                elif not command.startswith("BIO "):
                    print("Comando rechazado: debe comenzar con BIO o ser STOP.")
                    continue
                ser.write((command + "\n").encode("ascii")); ser.flush()
            if args.duration and not stopping and time.monotonic() - started >= args.duration:
                ser.write(b"BIO TEST STOP\n"); ser.flush(); stopping = True; stop_sent_at = time.monotonic()
            if stopping and time.monotonic() - stop_sent_at >= 1.0:
                break
    except KeyboardInterrupt:
        if ser and ser.is_open:
            ser.write(b"BIO TEST STOP\n"); ser.flush(); time.sleep(0.5)
    finally:
        if ser:
            ser.close()
        writer.close()
    print(f"Sesión cerrada: {writer.summary.samples} muestras; "
          f"{writer.summary.corrupt_protocol_lines} líneas estructuradas corruptas.")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--list-ports", action="store_true")
    parser.add_argument("--port")
    parser.add_argument("--baud", type=int, default=460800)
    parser.add_argument("--mode", choices=("RAW", "FULL"), default="FULL")
    parser.add_argument("--test-id", default="baseline")
    parser.add_argument("--subject-id", default="anon")
    parser.add_argument("--output", default=str(Path(__file__).resolve().parents[1] / "RAW"))
    parser.add_argument("--duration", type=float, default=0.0)
    parser.add_argument("--boot-wait", type=float, default=1.0)
    parser.add_argument("--no-stdin", action="store_true")
    return parser


def main(argv: Iterable[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.list_ports:
        return list_ports()
    if not args.port:
        print("--port es obligatorio (o use --list-ports)", file=sys.stderr)
        return 2
    return capture(args)


if __name__ == "__main__":
    raise SystemExit(main())
