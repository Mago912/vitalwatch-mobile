import hashlib
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2]
BASELINE = ROOT / "esp32" / "VitalWatch_BIOSYS_1_0_19"
CANDIDATE = ROOT / "esp32" / "VitalWatch_BIOSYS_1_0_20"


def read(path: pathlib.Path) -> str:
    if not path.is_file():
        raise AssertionError(f"required candidate file is missing: {path}")
    return path.read_text(encoding="utf-8")


def sha256(path: pathlib.Path) -> str:
    if not path.is_file():
        raise AssertionError(f"required candidate file is missing: {path}")
    return hashlib.sha256(path.read_bytes()).hexdigest()


class TestBiosys1020WristStability(unittest.TestCase):
    def test_candidate_identity(self) -> None:
        config = read(CANDIDATE / "Configuracion.h")
        self.assertIn('VERSION_PRODUCTO = "1.0.20"', config)
        self.assertIn('VERSION_SISTEMA = "0.9.9"', config)
        self.assertIn('VERSION_BIOMEDICA = "0.7.4"', config)
        self.assertIn(
            'BIO_EXPERIMENT_ID = "PPG-WRIST-STABILITY-20-A"', config
        )
        self.assertIn("ALGORITHM_VERSION_HR = 0x0701", config)

    def test_wrist_confirmation_is_conservative(self) -> None:
        header = read(CANDIDATE / "PpgValidityGate.h")
        source = read(CANDIDATE / "PpgValidityGate.cpp")
        config = read(CANDIDATE / "Configuracion.h")

        self.assertIn("BPM_CONFIRMATION_COUNT=5", header)
        self.assertIn("BPM_CONFIRMATION_RANGE_MAX=12.0f", header)
        self.assertIn("BPM_CONFIRMATION_MIN_US=2500000UL", header)
        self.assertIn("QR_BPM_UNCONFIRMED", config)
        self.assertIn("addBpmCandidate(beat.bpm,sample.sampleTimeUs)", source)
        self.assertIn("publishedBpm_=NAN", source)

    def test_product_diagnostic_separates_authoritative_and_maxim_hr(self) -> None:
        main = read(CANDIDATE / "VitalWatch_BIOSYS_1_0_20.ino")
        self.assertIn("hr=%s(%s) maximHr=%ld/%d", main)
        self.assertIn("nombreEstadoHR(hr.status)", main)
        self.assertIn("hrBpm", main)
        self.assertNotIn("hr=%s(%ld/%d)", main)

    def test_autogain_and_existing_safety_modules_are_preserved(self) -> None:
        sensor = read(CANDIDATE / "Sensor_Oxigeno.cpp")
        self.assertIn(
            "LED_INITIAL=0x18, LED_MIN=0x18, LED_MAX=0x50, LED_STEP=0x08",
            sensor,
        )
        self.assertIn("IR_TARGET_MIN=45000UL, IR_TARGET_MAX=95000UL", sensor)

        for name in (
            "PpgSampleTimeline.h",
            "PpgChannelDetector.cpp",
            "PpgChannelDetector.h",
            "PpgBeatFusion.cpp",
            "PpgBeatFusion.h",
            "Sensor_Movimiento.cpp",
            "Sensor_Movimiento.h",
            "Control_Remoto.h",
            "Sincronizacion_Medicacion.h",
            "Telemetria.h",
        ):
            self.assertEqual(sha256(BASELINE / name), sha256(CANDIDATE / name), name)

    def test_replay_contains_jump_rejection(self) -> None:
        replay = read(CANDIDATE / "BioReplay.cpp")
        tool = read(ROOT / "scripts" / "replay-biosys-ppg.ps1")
        self.assertIn('strcmp(name,"INVALID_BPM_JUMP")', replay)
        self.assertIn("QR_BPM_UNCONFIRMED", replay)
        self.assertIn("INVALID_BPM_JUMP", tool)

    def test_tooling_targets_1_0_20(self) -> None:
        firmware_tool = read(ROOT / "scripts" / "esp32-firmware.ps1")
        capture_tool = read(ROOT / "scripts" / "capture-biosys-research.ps1")
        replay_tool = read(ROOT / "scripts" / "replay-biosys-ppg.ps1")
        replay_test = read(ROOT / "scripts" / "test-biosys-ppg-replay.mjs")

        self.assertIn("VitalWatch_BIOSYS_1_0_20", firmware_tool)
        self.assertIn("biosys-1.0.20-research", firmware_tool)
        self.assertIn("biosys-1.0.20-replay", firmware_tool)
        self.assertIn("measurements\\biosys-1.0.20", capture_tool)
        self.assertIn("BIOSYS 1.0.20", capture_tool)
        self.assertIn("measurements\\biosys-1.0.20", replay_tool)
        self.assertIn("VitalWatch_BIOSYS_1_0_20", replay_test)

    def test_documentation_requires_physical_wrist_evidence(self) -> None:
        changes = read(CANDIDATE / "CAMBIOS_1_0_20.md").lower()
        manifest = read(CANDIDATE / "MANIFEST.md").lower()
        self.assertIn("muñeca", changes)
        self.assertIn("constituye validación clínica", changes)
        self.assertIn("pendiente", manifest)
        self.assertIn("movimiento", manifest)


if __name__ == "__main__":
    unittest.main()
