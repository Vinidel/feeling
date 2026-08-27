import { strict as assert } from "node:assert";
import {
  applyLegacySecurityEvent,
  initialLegacyRollbackState,
  type LegacySecurityEvent,
} from "./heroku_sequence.ts";

function apply(events: LegacySecurityEvent[]) {
  return events.reduce(applyLegacySecurityEvent, initialLegacyRollbackState());
}

Deno.test("cutover isolates Heroku and permanently removes retired tokens", () => {
  const state = apply([
    "maintenance_on",
    "remove_retired_tokens",
    "verify_token_absence",
  ]);
  assert.equal(state.maintenance, true);
  assert.equal(state.retiredTokensConfigured, false);
  assert.equal(state.tokenAbsenceVerified, true);
  assert.equal(state.browserRoutesVerified, false);
});

Deno.test("browser rollback requires data and token gates before maintenance off", () => {
  const state = apply([
    "maintenance_on",
    "remove_retired_tokens",
    "verify_token_absence",
    "verify_rollback_data",
    "maintenance_off",
    "verify_browser_routes",
  ]);
  assert.equal(state.maintenance, false);
  assert.equal(state.browserRoutesVerified, true);
  assert.equal(state.retiredTokensConfigured, false);
});

Deno.test("unsafe ordering and token restoration are rejected", () => {
  assert.throws(() => apply(["remove_retired_tokens"]));
  assert.throws(() => apply(["maintenance_off"]));
  assert.throws(() =>
    apply([
      "maintenance_on",
      "remove_retired_tokens",
      "verify_token_absence",
      "maintenance_off",
    ])
  );
  assert.throws(() => apply(["restore_retired_tokens"]), {
    message: "retired machine tokens must never be restored",
  });
});
