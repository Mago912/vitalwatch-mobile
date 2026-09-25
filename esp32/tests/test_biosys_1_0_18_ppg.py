import hashlib
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2]
BASELINE = ROOT / "esp32" / "VitalWatch_BIOSYS_1_0_17"
CANDIDATE = ROOT / "esp32" / "VitalWatch_BIOSYS_1_0_18"


def read(path: pathlib.Path) -> str:
    if not path.is_file():
        raise AssertionError(f"required candidate file is missing: {path}")
    return path.read_text(encoding="utf-8")


def sha256(path: pathlib.Path) -> str:
    if not path.is_file():
        raise AssertionError(f"required candidate file is missing: {path}")
    return hashlib.sha256(path.read_bytes()).hexdigest()


class TestBiosys1018AutogainExperiment(unittest.TestCase):
    def test_candidate_identity(self) -> None:
        config = read(CANDIDATE / "Configuracion.h")
        self.assertIn('VERSION_PRODUCTO = "1.0.18"', config)
        self.assertIn('VERSION_SISTEMA = "0.9.9"', config)
        self.assertIn('VERSION_BIOMEDICA = "0.7.2"', config)
        self.assertIn('BIO_EXPERIMENT_ID = "PPG-AUTOGAIN-18-A"', config)
        self.assertIn("ALGORITHM_VERSION_HR = 0x0700", config)

    def test_research_autogain_is_bounded_and_product_is_unchanged(self) -> None:
        sensor = read(CANDIDATE / "Sensor_Oxigeno.cpp")
        self.assertIn(
            "LED_INITIAL=0x18, LED_MIN=0x18, LED_MAX=0x50, LED_STEP=0x08",
            sensor,
        )
        self.assertIn(
            "LED_INITIAL=0x50, LED_MIN=0x35, LED_MAX=0xC0, LED_STEP=0x10",
            sensor,
        )

    def test_safety_pipeline_and_motion_are_byte_identical(self) -> None:
        for name in (
            "PpgSampleTimeline.h",
            "PpgChannelDetector.cpp",
            "PpgChannelDetector.h",
            "PpgBeatFusion.cpp",
            "PpgBeatFusion.h",
            "PpgValidityGate.cpp",
            "PpgValidityGate.h",
            "Sensor_Movimiento.cpp",
            "Sensor_Movimiento.h",
        ):
            self.assertEqual(sha256(BASELINE / name), sha256(CANDIDATE / name), name)

    def test_documentation_preserves_research_boundary(self) -> None:
        changes = read(CANDIDATE / "CAMBIOS_1_0_18.md").lower()
        self.assertIn("autoganancia", changes)
        self.assertIn("no constituye", changes)
        self.assertIn("clínica", changes)
        self.assertIn("10.000 ms", changes)


if __name__ == "__main__":
    unittest.main()
