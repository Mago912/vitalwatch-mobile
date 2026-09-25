import hashlib
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2]
BASELINE = ROOT / "esp32" / "VitalWatch_BIOSYS_1_0_16"
CANDIDATE = ROOT / "esp32" / "VitalWatch_BIOSYS_1_0_17"


def read(path: pathlib.Path) -> str:
    if not path.is_file():
        raise AssertionError(f"required candidate file is missing: {path}")
    return path.read_text(encoding="utf-8")


def sha256(path: pathlib.Path) -> str:
    if not path.is_file():
        raise AssertionError(f"required candidate file is missing: {path}")
    return hashlib.sha256(path.read_bytes()).hexdigest()


class TestBiosys1017Led18Experiment(unittest.TestCase):
    def test_candidate_identity(self) -> None:
        config = read(CANDIDATE / "Configuracion.h")
        self.assertIn('VERSION_PRODUCTO = "1.0.17"', config)
        self.assertIn('VERSION_SISTEMA = "0.9.9"', config)
        self.assertIn('VERSION_BIOMEDICA = "0.7.1"', config)
        self.assertIn('BIO_EXPERIMENT_ID = "PPG-LED-18-A"', config)
        self.assertIn("ALGORITHM_VERSION_HR = 0x0700", config)

    def test_only_research_led_power_changes_in_sensor_pipeline(self) -> None:
        sensor = read(CANDIDATE / "Sensor_Oxigeno.cpp")
        self.assertIn(
            "LED_INITIAL=0x18, LED_MIN=0x18, LED_MAX=0x18",
            sensor,
        )
        self.assertIn(
            "LED_INITIAL=0x50, LED_MIN=0x35, LED_MAX=0xC0",
            sensor,
        )

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

    def test_historical_candidate_remains_self_contained(self) -> None:
        self.assertTrue((CANDIDATE / "VitalWatch_BIOSYS_1_0_17.ino").is_file())
        self.assertTrue((CANDIDATE / "CAMBIOS_1_0_17.md").is_file())

    def test_documentation_keeps_the_safety_boundary(self) -> None:
        changes = read(CANDIDATE / "CAMBIOS_1_0_17.md").lower()
        self.assertIn("únicamente la potencia óptica", changes)
        self.assertIn("no constituye", changes)
        self.assertIn("clínica", changes)
        self.assertIn("10.000 ms continuos", changes)
        self.assertIn("biosys 1.0.17", read(CANDIDATE / "README.md").lower())


if __name__ == "__main__":
    unittest.main()
