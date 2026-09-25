import hashlib
import json
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2]
BASELINE = ROOT / "esp32" / "VitalWatch_BIOSYS_1_0_15"
CANDIDATE = ROOT / "esp32" / "VitalWatch_BIOSYS_1_0_16"


def read(path: pathlib.Path) -> str:
    if not path.is_file():
        raise AssertionError(f"required candidate file is missing: {path}")
    return path.read_text(encoding="utf-8")


def sha256(path: pathlib.Path) -> str:
    if not path.is_file():
        raise AssertionError(f"required candidate file is missing: {path}")
    return hashlib.sha256(path.read_bytes()).hexdigest()


class TestBiosys1016PpgValidity(unittest.TestCase):
    def test_candidate_identity(self) -> None:
        config = read(CANDIDATE / "Configuracion.h")
        self.assertIn('VERSION_PRODUCTO = "1.0.16"', config)
        self.assertIn('VERSION_SISTEMA = "0.9.9"', config)
        self.assertIn('VERSION_BIOMEDICA = "0.7.0"', config)
        self.assertIn('BIO_EXPERIMENT_ID = "PPG-DUAL-CHANNEL-A"', config)
        self.assertIn("ALGORITHM_VERSION_HR = 0x0700", config)

    def test_immutable_sensor_files(self) -> None:
        for name in (
            "Sensor_Movimiento.cpp",
            "Sensor_Movimiento.h",
            "PpgSampleTimeline.h",
        ):
            self.assertEqual(sha256(BASELINE / name), sha256(CANDIDATE / name), name)

    def test_release_tooling_targets_1_0_16(self) -> None:
        package = json.loads(read(ROOT / "package.json"))
        scripts = package["scripts"]
        self.assertIn("firmware:biosys:replay", scripts)
        self.assertIn("firmware:biosys:replay:upload", scripts)
        tooling = read(ROOT / "scripts" / "esp32-firmware.ps1")
        self.assertIn("VitalWatch_BIOSYS_1_0_16", tooling)
        self.assertIn("biosys-1.0.16-research", tooling)
        self.assertIn("biosys-1.0.16-replay", tooling)

    def test_release_documentation_names_the_pipeline_and_scope(self) -> None:
        manifest = read(CANDIDATE / "MANIFEST.md")
        for name in (
            "PpgChannelDetector.cpp",
            "PpgBeatFusion.cpp",
            "PpgValidityGate.cpp",
        ):
            self.assertIn(name, manifest)
        changes = read(CANDIDATE / "CAMBIOS_1_0_16.md").lower()
        self.assertIn("validez técnica", changes)
        self.assertIn("no constituye validación clínica", changes)
        self.assertIn("biosys 1.0.16", read(CANDIDATE / "README.md").lower())


if __name__ == "__main__":
    unittest.main()
