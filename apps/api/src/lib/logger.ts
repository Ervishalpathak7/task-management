import pino from "pino";
import { getConfig } from "../config/index.js";

let _logger: pino.Logger | undefined;

export function createLogger(): pino.Logger {
  const config = getConfig();

  _logger = pino({
    level: config.LOG_LEVEL,
    // Structured JSON only. pino-pretty only in development via transport.
    ...(config.NODE_ENV === "development"
      ? {
          transport: {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "SYS:standard",
              ignore: "pid,hostname",
            },
          },
        }
      : {}),
    base: {
      env: config.NODE_ENV,
    },
    serializers: {
      req: pino.stdSerializers.req,
      res: pino.stdSerializers.res,
      err: pino.stdSerializers.err,
    },
    // Ensure no PII leaks
    redact: {
      paths: ["req.headers.authorization", "req.headers.cookie"],
      censor: "[REDACTED]",
    },
  });

  return _logger;
}

export function getLogger(): pino.Logger {
  if (!_logger) {
    throw new Error("Logger not initialized. Call createLogger() first.");
  }
  return _logger;
}
