"""CODEX REPRODUCTION TESTS for VitalWatch MAX30102 acquisition.

These are new, independent tests derived from the exact baseline source and
the written irregularity descriptions. They are not Cowork's original tests.
"""

from __future__ import annotations

import csv
import io
import unittest
from dataclasses import dataclass


MASK_18_BIT = 0x3FFFF
PERIOD_US = 40_000


class BaselineRing:
    """Exact index behavior used by the baseline SparkFun driver."""

    def __init__(self, size: int = 4) -> None:
        self.size = size
        self.head = 0
        self.tail = 0
        self.data = [0] * size

    def push(self, value: int) -> None:
        self.head = (self.head + 1) % self.size
        self.data[self.head] = value

    def available(self) -> int:
        count = self.head - self.tail
        return count + self.size if count < 0 else count

    def front(self) -> int:
        return self.data[self.tail]

    def pop(self) -> None:
        if self.available():
            self.tail = (self.tail + 1) % self.size


class CorrectedRing:
    """Reference contract expected from the experimental driver."""

    def __init__(self, size: int = 4) -> None:
        self.size = size
        self.write = 0
        self.read = 0
        self.count = 0
        self.software_overflow = 0
        self.data = [0] * size

    def push(self, value: int) -> None:
        if self.count == self.size:
            self.read = (self.read + 1) % self.size
            self.count -= 1
            self.software_overflow += 1
        self.data[self.write] = value
        self.write = (self.write + 1) % self.size
        self.count += 1

    def available(self) -> int:
        return self.count

    def front(self) -> int:
        if not self.count:
            raise IndexError("empty")
        return self.data[self.read]

    def pop(self) -> None:
        if self.count:
            self.read = (self.read + 1) % self.size
            self.count -= 1


def baseline_decode_three_bytes(values: list[int]) -> int:
    """Replicates assigning Wire.read() to uint8_t and masking to 18 bits."""
    b = [(value & 0xFF) for value in values]
    return ((b[0] << 16) | (b[1] << 8) | b[2]) & MASK_18_BIT


def corrected_decode_three_bytes(values: list[int]) -> tuple[str, int | None]:
    if len(values) != 3 or any(value < 0 or value > 255 for value in values):
        return "READ_SHORT", None
    return "READ_OK", ((values[0] << 16) | (values[1] << 8) | values[2]) & MASK_18_BIT


def baseline_batch(now_us: int, count: int) -> list[int]:
    first = now_us - max(0, count - 1) * PERIOD_US
    return [first + i * PERIOD_US for i in range(count)]


class EstimatedTimeline:
    def __init__(self) -> None:
        self.last = 0

    def batch(self, processing_us: int, count: int, gap_samples: int = 0) -> list[int]:
        if count == 0:
            return []
        if not self.last:
            first = processing_us - (count - 1) * PERIOD_US
        else:
            first = self.last + (gap_samples + 1) * PERIOD_US
        result = [first + i * PERIOD_US for i in range(count)]
        self.last = result[-1]
        return result


class MonotonicMicrosModel:
    def __init__(self) -> None:
        self.initialized = False
        self.last32 = 0
        self.epoch = 0

    def extend(self, value: int) -> int:
        value &= 0xFFFFFFFF
        if self.initialized and value < self.last32:
            self.epoch += 1 << 32
        self.initialized = True
        self.last32 = value
        return self.epoch + value


@dataclass
class LossCounters:
    hardware_overflow: int = 0
    software_overflow: int = 0
    short_read: int = 0
    sequence_gap: int = 0
    logger_drop: int = 0


class SequenceTracker:
    def __init__(self) -> None:
        self.last: int | None = None
        self.gaps = 0
        self.duplicates = 0

    def accept(self, value: int) -> None:
        if self.last is not None:
            if value == self.last:
                self.duplicates += 1
            elif value > self.last + 1:
                self.gaps += value - self.last - 1
        self.last = value


class HardwareOverflowTracker:
    """MAX30102 contract: OVF is per pre-pop snapshot, not a rollover clock."""

    def __init__(self) -> None:
        self.total = 0
        self.last_snapshot = 0

    def observe_before_fifo_pop(self, raw: int) -> None:
        if not 0 <= raw <= 0x1F:
            raise ValueError("invalid OVF_COUNTER")
        self.total += raw - self.last_snapshot if raw >= self.last_snapshot else raw
        self.last_snapshot = raw

    def complete_fifo_pop(self) -> None:
        self.last_snapshot = 0


def corroborated_hardware_loss(raw_delta: int, found: int, service_gap_us: int) -> int:
    fifo_capacity = 32
    plausible = found >= fifo_capacity - 1 or service_gap_us >= fifo_capacity * PERIOD_US
    return raw_delta if raw_delta and plausible else 0


class TestBaselineReproduction(unittest.TestCase):
    def test_irr001_fifo_order_is_independently_reproduced(self) -> None:
        fifo = BaselineRing()
        fifo.push(200)
        first = fifo.front()
        fifo.pop()
        fifo.push(201)
        second = fifo.front()
        self.assertEqual([first, second], [0, 200])

    def test_irr002_full_fifo_looks_empty_is_independently_reproduced(self) -> None:
        fifo = BaselineRing()
        for value in range(4):
            fifo.push(value + 100)
        self.assertEqual(fifo.head, fifo.tail)
        self.assertEqual(fifo.available(), 0)

    def test_irr003_short_read_becomes_262143_is_independently_reproduced(self) -> None:
        self.assertEqual(baseline_decode_three_bytes([-1, -1, -1]), 262143)

    def test_irr004_batch_reanchoring_changes_interval(self) -> None:
        first = baseline_batch(160_000, 2)
        second = baseline_batch(260_000, 2)
        self.assertEqual(first, [120_000, 160_000])
        self.assertEqual(second, [220_000, 260_000])
        self.assertEqual(second[0] - first[-1], 60_000)

    def test_irr005_cast_after_rollover_goes_backwards(self) -> None:
        before = int(0xFFFFFF00)
        after = int(0x00000100)
        self.assertLess(after, before)
        self.assertGreater((after - before) & 0xFFFFFFFFFFFFFFFF, 1 << 63)

    def test_irr006_loss_dimensions_are_not_equivalent(self) -> None:
        counters = LossCounters(hardware_overflow=1, short_read=1)
        self.assertEqual(counters.software_overflow, 0)
        self.assertEqual(counters.logger_drop, 0)
        self.assertNotEqual(counters.hardware_overflow, counters.software_overflow)


class TestCorrectedContract(unittest.TestCase):
    def test_fifo_order(self) -> None:
        fifo = CorrectedRing()
        fifo.push(200)
        fifo.push(201)
        out = []
        while fifo.available():
            out.append(fifo.front())
            fifo.pop()
        self.assertEqual(out, [200, 201])

    def test_fifo_full(self) -> None:
        fifo = CorrectedRing()
        for value in range(4):
            fifo.push(value)
        self.assertEqual(fifo.available(), 4)
        self.assertEqual(fifo.software_overflow, 0)

    def test_fifo_overflow_accounting(self) -> None:
        fifo = CorrectedRing()
        for value in range(5):
            fifo.push(value)
        self.assertEqual(fifo.available(), 4)
        self.assertEqual(fifo.software_overflow, 1)
        self.assertEqual(fifo.front(), 1)

    def test_short_read_rejected(self) -> None:
        status, value = corrected_decode_three_bytes([0x01, 0x02, -1])
        self.assertEqual(status, "READ_SHORT")
        self.assertIsNone(value)

    def test_sample_sequence_gap_and_duplicate(self) -> None:
        tracker = SequenceTracker()
        for value in [1, 2, 2, 5]:
            tracker.accept(value)
        self.assertEqual(tracker.duplicates, 1)
        self.assertEqual(tracker.gaps, 2)

    def test_timestamp_monotonicity_with_processing_jitter(self) -> None:
        timeline = EstimatedTimeline()
        stamps = timeline.batch(160_000, 2) + timeline.batch(260_000, 2)
        self.assertEqual(stamps, [120_000, 160_000, 200_000, 240_000])
        self.assertTrue(all(b > a for a, b in zip(stamps, stamps[1:])))

    def test_micros_rollover(self) -> None:
        clock = MonotonicMicrosModel()
        before = clock.extend(0xFFFFFF00)
        after = clock.extend(0x00000100)
        self.assertGreater(after, before)
        self.assertEqual(after - before, 0x200)

    def test_logger_drop_accounting(self) -> None:
        counters = LossCounters()
        capacity = 2
        queue: list[int] = []
        for value in range(3):
            if len(queue) >= capacity:
                counters.logger_drop += 1
            else:
                queue.append(value)
        self.assertEqual(counters.logger_drop, 1)

    def test_hardware_overflow_counter_reset_is_not_rollover(self) -> None:
        tracker = HardwareOverflowTracker()
        tracker.observe_before_fifo_pop(1)
        tracker.observe_before_fifo_pop(1)  # mismo evento todavía pendiente
        tracker.complete_fifo_pop()
        # La lectura de una muestra reinicia OVF a cero. 1 -> 0 no son 31.
        tracker.observe_before_fifo_pop(0)
        self.assertEqual(tracker.total, 1)

    def test_equal_hardware_pointers_do_not_create_phantom_samples(self) -> None:
        read_pointer = write_pointer = 7
        overflow_counter = 1
        available = (write_pointer - read_pointer) % 32
        self.assertEqual(available, 0)
        self.assertEqual(overflow_counter, 1)

    def test_startup_fifo_is_quarantined_before_first_service_sample(self) -> None:
        stale_fifo = CorrectedRing(size=4)
        for value in [10, 11, 12, 13]:
            stale_fifo.push(value)
        # Contrato del firmware: clearFIFO antes de aceptar la primera muestra
        # del loop cooperativo; los valores acumulados durante setup no salen.
        stale_fifo.write = stale_fifo.read = stale_fifo.count = 0
        stale_fifo.push(100)
        self.assertEqual(stale_fifo.front(), 100)
        self.assertEqual(stale_fifo.available(), 1)

    def test_unphysical_overflow_raw_is_logged_but_not_sequence_loss(self) -> None:
        self.assertEqual(corroborated_hardware_loss(1, found=1, service_gap_us=40_000), 0)
        self.assertEqual(corroborated_hardware_loss(1, found=31, service_gap_us=40_000), 1)
        self.assertEqual(corroborated_hardware_loss(2, found=1, service_gap_us=1_280_000), 2)

    def test_csv_parsing_and_corrupt_line_handling(self) -> None:
        good = "schema_version,session_id,sample_index,red_raw,ir_raw\n1,S1,1,100,200\n"
        rows = list(csv.DictReader(io.StringIO(good)))
        self.assertEqual(rows[0]["ir_raw"], "200")

        corrupt = "@VW_RAW,1,S1,not_an_index,100\n"
        parts = corrupt.strip().split(",")
        with self.assertRaises(ValueError):
            int(parts[3])


if __name__ == "__main__":
    unittest.main(verbosity=2)
