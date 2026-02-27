import type { FastifyInstance, FastifyRequest } from "fastify";
import fastifyRateLimit from "@fastify/rate-limit";
import type IORedis from "ioredis";
import { getRedisConnection } from "../lib/redis.js";
import { getLogger } from "../lib/logger.js";

const AUTH_RATE_LIMIT = { max: 10, timeWindow: "1 minute" } as const;
const API_RATE_LIMIT = { max: 100, timeWindow: "1 minute" } as const;

export async function registerRateLimiting(
  app: FastifyInstance,
): Promise<void> {
  const logger = getLogger();
  const redis = getRedisConnection();

  await app.register(fastifyRateLimit, {
    max: API_RATE_LIMIT.max,
    timeWindow: API_RATE_LIMIT.timeWindow,
    redis: redis as IORedis,
    nameSpace: "rl:",
    keyGenerator: (request: FastifyRequest) => {
      return request.user?.sub ?? request.ip;
    },
    errorResponseBuilder: (
      _request: FastifyRequest,
      context: { ttl: number },
    ) => ({
      type: "https://api.taskmanagement.com/errors/rate-limited",
      title: "Too Many Requests",
      status: 429,
      detail: `Rate limit exceeded. Retry after ${Math.ceil(context.ttl / 1000)} seconds.`,
    }),
    onExceeded: (request: FastifyRequest) => {
      logger.warn(
        {
          ip: request.ip,
          url: request.url,
          userId: request.user?.sub,
        },
        "Rate limit exceeded",
      );
    },
  });
}

/**
 * Stricter rate limit config for auth routes.
 * Apply via route-level config.
 */
export const authRateLimitConfig = {
  config: {
    rateLimit: {
      max: AUTH_RATE_LIMIT.max,
      timeWindow: AUTH_RATE_LIMIT.timeWindow,
    },
  },
};
