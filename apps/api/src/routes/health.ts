import type { FastifyReply, FastifyRequest } from "fastify";
import type { HealthCheckResponse } from "@task-management/types";
import { getPrismaClient } from "../lib/prisma.js";
import { getLogger } from "../lib/logger.js";

export async function healthCheckHandler(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const logger = getLogger();
  let dbStatus: "ok" | "down" = "down";
  let redisStatus: "ok" | "down" = "down";

  // Check database
  try {
    await getPrismaClient().$queryRaw`SELECT 1`;
    dbStatus = "ok";
  } catch (err: unknown) {
    logger.error({ err }, "Health check: database unreachable");
  }

  // Check Redis
  try {
    const { getRedisConnection } = await import("../lib/redis.js");
    const redis = getRedisConnection();
    const pong = await redis.ping();
    if (pong === "PONG") {
      redisStatus = "ok";
    }
  } catch (err: unknown) {
    logger.error({ err }, "Health check: redis unreachable");
  }

  const overallStatus =
    dbStatus === "ok" && redisStatus === "ok" ? "ok" : "degraded";

  const response: HealthCheckResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    services: {
      database: dbStatus,
      redis: redisStatus,
    },
  };

  const statusCode = overallStatus === "ok" ? 200 : 503;
  await reply.status(statusCode).send(response);
}
