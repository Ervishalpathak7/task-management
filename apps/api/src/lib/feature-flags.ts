import type { FeatureFlags } from "@task-management/types";
import { getConfig } from "../config/index.js";

export function getFeatureFlags(): FeatureFlags {
  const config = getConfig();
  return {
    ENABLE_EMAIL: config.ENABLE_EMAIL,
    ENABLE_GOOGLE_OAUTH: config.ENABLE_GOOGLE_OAUTH,
    ENABLE_ASSIGNMENTS: config.ENABLE_ASSIGNMENTS,
    ENABLE_PASSWORD_RESET: config.ENABLE_PASSWORD_RESET,
  };
}

export function isFeatureEnabled(flag: keyof FeatureFlags): boolean {
  return getFeatureFlags()[flag];
}
