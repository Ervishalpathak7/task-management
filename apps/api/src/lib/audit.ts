import { getLogger } from "./logger.js";

// ─── Audit Event Types ──────────────────────────────────────

type AuditAction =
  | "AUTH_LOGIN_SUCCESS"
  | "AUTH_LOGIN_FAILURE"
  | "AUTH_REGISTER"
  | "AUTH_LOGOUT"
  | "AUTH_PASSWORD_RESET_REQUEST"
  | "AUTH_PASSWORD_RESET_COMPLETE"
  | "AUTH_EMAIL_VERIFIED"
  | "AUTH_TOKEN_REFRESH"
  | "TASK_ASSIGNED"
  | "TASK_ACCEPTED"
  | "TASK_STATUS_CHANGED"
  | "TASK_CREATED"
  | "TASK_DELETED"
  | "GROUP_CREATED"
  | "GROUP_MEMBER_ADDED"
  | "GROUP_MEMBER_REMOVED";

interface AuditEntry {
  action: AuditAction;
  actorId?: string; // userId performing action (undefined = anonymous)
  targetId?: string; // affected resource ID
  targetType?: string; // "user" | "task" | "group"
  metadata?: Record<string, string | number | boolean>;
  ip?: string;
  userAgent?: string;
}

// ─── Audit Logger ───────────────────────────────────────────

/**
 * Emits a structured audit log entry.
 *
 * Rules:
 * - No PII (no emails, no names, no passwords)
 * - Only IDs and action metadata
 * - IPs are logged for auth events only (security requirement)
 * - User agents are truncated to 100 chars
 */
export function audit(entry: AuditEntry): void {
  const logger = getLogger();

  logger.info(
    {
      audit: true,
      action: entry.action,
      actorId: entry.actorId ?? "anonymous",
      targetId: entry.targetId,
      targetType: entry.targetType,
      metadata: entry.metadata,
      ip: entry.ip ? maskIp(entry.ip) : undefined,
      userAgent: entry.userAgent ? entry.userAgent.slice(0, 100) : undefined,
    },
    `AUDIT: ${entry.action}`,
  );
}

/**
 * Mask last octet of IPv4, last 4 groups of IPv6.
 * Preserves enough for abuse detection, not enough for PII.
 */
function maskIp(ip: string): string {
  if (ip.includes(":")) {
    // IPv6: keep first 4 groups
    const groups = ip.split(":");
    return groups.slice(0, 4).join(":") + ":****";
  }
  // IPv4: mask last octet
  const parts = ip.split(".");
  if (parts.length === 4) {
    parts[3] = "***";
    return parts.join(".");
  }
  return "***";
}
