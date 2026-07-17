import importlib.util
import json
import os
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("build_snapshot", ROOT / "pipeline/build_snapshot.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class PipelineTests(unittest.TestCase):
    def test_cached_build_is_deterministic(self):
        first = module.canonical(module.build("2026-07", publication_mode=True, write=False))
        second = module.canonical(module.build("2026-07", publication_mode=True, write=False))
        self.assertEqual(first, second)

    def test_pending_profiles_publish_low_confidence_proxy_without_scores(self):
        snapshot = module.build("2026-07", publication_mode=True, write=False)
        for country in snapshot["countries"]:
            self.assertEqual(country["stage"], "Closed")
            self.assertIn("automated proxy", country["stageConfidence"])
            self.assertTrue(all(pillar["score"] is None for pillar in country["pillars"]))
            self.assertEqual(country["momentum"], [])

    def test_publication_gate_rejects_illustrative_evidence(self):
        snapshot = module.build("2026-07", write=False)
        snapshot["countries"][0]["pillars"][0]["evidence"] = [{"status":"illustrative","sourceUrl":"https://example.org/fixture","provenanceReferences":["fixture"]}]
        with self.assertRaises(AssertionError):
            module.validate(snapshot, publication_mode=True)

    def test_automated_stage_requires_explicit_machine_label(self):
        snapshot = module.build("2026-07", write=False)
        self.assertIn("Machine-generated", snapshot["countries"][0]["expertReview"])
        module.validate(snapshot)


class AdapterTests(unittest.TestCase):
    def test_openalex_requires_api_key_and_reports_failure(self):
        from pipeline.adapters.openalex import collect
        previous = os.environ.pop("OPENALEX_API_KEY", None)
        try:
            result = collect("brazil", "test", "2026-06-01", "2026-06-30")
        finally:
            if previous is not None:
                os.environ["OPENALEX_API_KEY"] = previous
        self.assertEqual(result["files"], [])
        self.assertIn("OPENALEX_API_KEY", result["failures"][0]["reason"])

    def test_source_configs_are_versioned(self):
        for name in ("openalex", "gdelt", "political"):
            config = json.loads((ROOT / f"config/queries/{name}.json").read_text())
            self.assertEqual(config["version"], "2026-07-pilot-v1")

    def test_saved_openalex_fixture_keeps_stable_records(self):
        from pipeline.adapters.openalex import parse_works
        fixture = json.loads((ROOT / "tests/fixtures/openalex.json").read_text())
        self.assertEqual([item["id"] for item in parse_works(fixture)], ["https://openalex.org/W1"])

    def test_saved_gdelt_fixture_is_deduplicated(self):
        from pipeline.adapters.gdelt import parse_articles
        fixture = json.loads((ROOT / "tests/fixtures/gdelt.json").read_text())
        self.assertEqual(len(parse_articles(fixture)), 2)


if __name__ == "__main__":
    unittest.main()
