import hashlib
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2]
BASELINE = ROOT / "esp32" / "VitalWatch_BIOSYS_1_0_18"
CANDIDATE = ROOT / "esp32" / "VitalWatch_BIOSYS_1_0_19"


def read(path: pathlib.Path) -> str:
    if not path.is_file():
        raise AssertionError(f"required candidate file is missing: {path}")
    return path.read_text(encoding="utf-8")


def sha256(path: pathlib.Path) -> str:
    if not path.is_file():
        raise AssertionError(f"required candidate file is missing: {path}")
    return hashlib.sha256(path.read_bytes()).hexdigest()


class TestBiosys1019ProductAutogain(unittest.TestCase):
    def test_candidate_identity(self) -> None:
        config = read(CANDIDATE / "Configuracion.h")
        self.assertIn('VERSION_PRODUCTO = "1.0.19"', config)
        self.assertIn('VERSION_SISTEMA = "0.9.9"', config)
        self.assertIn('VERSION_BIOMEDICA = "0.7.3"', config)
        self.assertIn(
            'BIO_EXPERIMENT_ID = "PPG-AUTOGAIN-PRODUCT-19-A"', config
        )
        self.assertIn("ALGORITHM_VERSION_HR = 0x0700", config)

    def test_validated_autogain_is_the_product_profile(self) -> None:
        sensor = read(CANDIDATE / "Sensor_Oxigeno.cpp")
        validated = (
            "LED_INITIAL=0x18, LED_MIN=0x18, LED_MAX=0x50, LED_STEP=0x08"
        )
        self.assertEqual(sensor.count(validated), 1)
        self.assertNotIn(
            "LED_INITIAL=0x50, LED_MIN=0x35, LED_MAX=0xC0, LED_STEP=0x10",
            sensor,
        )
        self.assertIn(
            "IR_TARGET_MIN=45000UL, IR_TARGET_MAX=95000UL", sensor
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

    def test_tooling_targets_1_0_19(self) -> None:
        firmware_tool = read(ROOT / "scripts" / "esp32-firmware.ps1")
        capture_tool = read(ROOT / "scripts" / "capture-biosys-research.ps1")
        replay_tool = read(ROOT / "scripts" / "replay-biosys-ppg.ps1")
        replay_test = read(ROOT / "scripts" / "test-biosys-ppg-replay.mjs")

        self.assertIn("VitalWatch_BIOSYS_1_0_19", firmware_tool)
        self.assertIn("biosys-1.0.19-research", firmware_tool)
        self.assertIn("biosys-1.0.19-replay", firmware_tool)
        self.assertIn("measurements\\biosys-1.0.19", capture_tool)
        self.assertIn("BIOSYS 1.0.19", capture_tool)
        self.assertIn("measurements\\biosys-1.0.19", replay_tool)
        self.assertIn("VitalWatch_BIOSYS_1_0_19", replay_test)

    def test_documentation_keeps_the_validation_boundary(self) -> None:
        changes = read(CANDIDATE / "CAMBIOS_1_0_19.md").lower()
        self.assertIn("autoganancia", changes)
        self.assertIn("no se atribuye", changes)
        self.assertIn("no constituye", changes)
        self.assertIn("clínica", changes)


if __name__ == "__main__":
    unittest.main()
