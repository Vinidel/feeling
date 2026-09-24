from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[3]
WORKFLOW = ROOT / ".github/workflows/deploy-production.yml"


class WorkflowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.text = WORKFLOW.read_text()

    def test_only_master_push_triggers(self):
        trigger = self.text.split("permissions:", 1)[0]
        self.assertIn("push:", trigger)
        self.assertIn("- master", trigger)
        self.assertNotIn("pull_request", trigger)
        self.assertNotIn("paths:", trigger)

    def test_exact_sha_and_required_validation_gate(self):
        self.assertGreaterEqual(self.text.count("ref: ${{ github.sha }}"), 2)
        self.assertIn("needs: validate-and-build", self.text)
        self.assertIn("persist-credentials: false", self.text)

    def test_permissions_and_lock_are_scoped(self):
        self.assertIn("group: feeling-production", self.text)
        self.assertIn("cancel-in-progress: false", self.text)
        self.assertIn("queue: max", self.text)
        self.assertEqual(self.text.count("id-token: write"), 1)
        self.assertNotIn("DATABASE_URL", self.text)
        self.assertNotIn("client-secret", self.text)

    def test_all_actions_use_full_commit_pins(self):
        uses = re.findall(r"uses:\s+([^\s]+)", self.text)
        self.assertTrue(uses)
        for value in uses:
            self.assertRegex(value, r"^[^@]+@[0-9a-f]{40}$")

    def test_artifact_is_bound_to_same_run_attempt(self):
        expression = "steady-image-${{ github.run_id }}-${{ github.run_attempt }}"
        self.assertEqual(self.text.count(expression), 2)
        self.assertIn('"archive_sha256"', self.text)
        self.assertIn('"source_label"', self.text)

    def test_runner_loss_evidence_upload_is_non_destructive(self):
        self.assertIn("if: always()", self.text)
        self.assertIn("if-no-files-found: warn", self.text)
        self.assertIn("retention-days: 7", self.text)


if __name__ == "__main__":
    unittest.main()
