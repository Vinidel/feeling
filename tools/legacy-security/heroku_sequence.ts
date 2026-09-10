export interface LegacyRollbackState {
  maintenance: boolean;
  retiredTokensConfigured: boolean;
  tokenAbsenceVerified: boolean;
  rollbackDataVerified: boolean;
  browserRoutesVerified: boolean;
}

export type LegacySecurityEvent =
  | "maintenance_on"
  | "remove_retired_tokens"
  | "verify_token_absence"
  | "verify_rollback_data"
  | "maintenance_off"
  | "verify_browser_routes"
  | "restore_retired_tokens";

export function initialLegacyRollbackState(): LegacyRollbackState {
  return {
    maintenance: false,
    retiredTokensConfigured: true,
    tokenAbsenceVerified: false,
    rollbackDataVerified: false,
    browserRoutesVerified: false,
  };
}

export function applyLegacySecurityEvent(
  current: LegacyRollbackState,
  event: LegacySecurityEvent,
): LegacyRollbackState {
  const state = { ...current };
  switch (event) {
    case "maintenance_on":
      state.maintenance = true;
      state.browserRoutesVerified = false;
      return state;
    case "remove_retired_tokens":
      if (!state.maintenance) {
        throw new Error("retired tokens may be removed only in maintenance");
      }
      state.retiredTokensConfigured = false;
      state.tokenAbsenceVerified = false;
      return state;
    case "verify_token_absence":
      if (!state.maintenance || state.retiredTokensConfigured) {
        throw new Error(
          "token absence cannot be verified in the current state",
        );
      }
      state.tokenAbsenceVerified = true;
      return state;
    case "verify_rollback_data":
      if (!state.maintenance) {
        throw new Error(
          "rollback data must be verified while writes are suspended",
        );
      }
      state.rollbackDataVerified = true;
      return state;
    case "maintenance_off":
      if (
        !state.maintenance || state.retiredTokensConfigured ||
        !state.tokenAbsenceVerified || !state.rollbackDataVerified
      ) {
        throw new Error("browser rollback gates are incomplete");
      }
      state.maintenance = false;
      return state;
    case "verify_browser_routes":
      if (
        state.maintenance || !state.rollbackDataVerified ||
        state.retiredTokensConfigured
      ) {
        throw new Error(
          "browser routes cannot be accepted in the current state",
        );
      }
      state.browserRoutesVerified = true;
      return state;
    case "restore_retired_tokens":
      throw new Error("retired machine tokens must never be restored");
  }
}
