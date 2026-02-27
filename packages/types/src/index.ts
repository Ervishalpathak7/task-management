// ─── Domain Enums ───────────────────────────────────────────

export const UserStatus = {
  UNVERIFIED: "UNVERIFIED",
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
} as const;

export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const TaskStatus = {
  PENDING_ACCEPTANCE: "PENDING_ACCEPTANCE",
  OPEN: "OPEN",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  CLOSED: "CLOSED",
} as const;

export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const GroupRole = {
  ADMIN: "ADMIN",
  MEMBER: "MEMBER",
} as const;

export type GroupRole = (typeof GroupRole)[keyof typeof GroupRole];

// ─── Feature Flags ──────────────────────────────────────────

export interface FeatureFlags {
  readonly ENABLE_EMAIL: boolean;
  readonly ENABLE_GOOGLE_OAUTH: boolean;
  readonly ENABLE_ASSIGNMENTS: boolean;
  readonly ENABLE_PASSWORD_RESET: boolean;
}

// ─── API Error Response (RFC 7807) ─────────────────────────

export interface ApiProblem {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail: string;
  readonly instance?: string;
  readonly errors?: ReadonlyArray<FieldError>;
}

export interface FieldError {
  readonly field: string;
  readonly message: string;
}

// ─── API Health Check ───────────────────────────────────────

export interface HealthCheckResponse {
  readonly status: "ok" | "degraded" | "down";
  readonly timestamp: string;
  readonly services: {
    readonly database: "ok" | "down";
    readonly redis: "ok" | "down";
  };
}
