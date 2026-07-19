import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("build_snapshot", ROOT / "pipeline/build_snapshot.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class PipelineTests(unittest.TestCase):
    def test_momentum_is_bounded_and_complete(self):
        series = module.momentum(5, 70, "up")
        self.assertEqual(len(series), 36)
        self.assertTrue(all(0 <= p["search"] <= 100 and 0 <= p["media"] <= 100 for p in series))

    def test_validation_rejects_invalid_stage(self):
        snapshot = {"countries":[{"id":"x","stage":"Maybe","pillars":[],"momentum":[]}]}
        with self.assertRaises(AssertionError):
            module.validate(snapshot)

if __name__ == "__main__":
    unittest.main()
