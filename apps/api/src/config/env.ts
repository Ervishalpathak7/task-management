import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PRIMARY_KEY: z.string().optional(),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRY_SECONDS: z.coerce.number().int().positive().default(900), // 15 min
  JWT_REFRESH_EXPIRY_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(604800), // 7 days

  // Cookies
  COOKIE_DOMAIN: z.string().default("localhost"),
  COOKIE_SECURE: z.coerce.boolean().default(false),

  // CORS
  CORS_ORIGIN: z.string().default("http://localhost:3000"),

  // Feature flags
  ENABLE_EMAIL: z.coerce.boolean().default(false),
  ENABLE_GOOGLE_OAUTH: z.coerce.boolean().default(false),
  ENABLE_ASSIGNMENTS: z.coerce.boolean().default(false),
  ENABLE_PASSWORD_RESET: z.coerce.boolean().default(false),

  // Logging
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),

  // Datadog
  DD_API_KEY: z.string().optional(),
  DD_SITE: z.string().default("datadoghq.com"),
  DD_AGENT_HOST: z.string().default("localhost"),
  DD_TRACE_AGENT_PORT: z.coerce.number().default(8126),
  DD_SERVICE: z.string().default("task-management-api"),
  DD_ENV: z.string().optional(),
  DD_VERSION: z.string().default("0.0.1"),
});

export type EnvConfig = z.infer<typeof envSchema>;

let _config: EnvConfig | undefined;

export function loadConfig(): EnvConfig {
  if (_config) return _config;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const formatted = parsed.error.flatten().fieldErrors;
    const message = Object.entries(formatted)
      .map(([key, errors]) => `  ${key}: ${(errors ?? []).join(", ")}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${message}`);
  }

  _config = parsed.data;
  return _config;
}

export function getConfig(): EnvConfig {
  if (!_config) {
    throw new Error("Config not loaded. Call loadConfig() first.");
  }
  return _config;
}
