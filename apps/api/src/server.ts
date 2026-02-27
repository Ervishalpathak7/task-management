import { loadConfig, getConfig } from "./config/index.js";
import { createLogger, getLogger } from "./lib/logger.js";
import { createPrismaClient, disconnectPrisma } from "./lib/prisma.js";
import { createRedisConnection, disconnectRedis } from "./lib/redis.js";
import { initQueues, closeQueues } from "./queue/producer.js";
import { buildApp } from "./app.js";

async function main(): Promise<void> {
  // 1. Load and validate configuration
  loadConfig();
  const config = getConfig();

  // 2. Initialize structured logger
  createLogger();
  const logger = getLogger();

  // 3. Initialize database client
  createPrismaClient();

  // 4. Initialize Redis + BullMQ queues (producer side)
  createRedisConnection();
  initQueues();

  // 5. Build and start Fastify
  const app = await buildApp();

  try {
    await app.listen({ port: config.PORT, host: config.HOST });
    logger.info(
      {
        port: config.PORT,
        host: config.HOST,
        docs: `http://localhost:${config.PORT}/docs`,
      },
      "Server started",
    );
  } catch (err: unknown) {
    logger.fatal({ err }, "Failed to start server");
    process.exit(1);
  }

  // ─── Graceful shutdown ──────────────────────────────────

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, "Shutting down gracefully");
    try {
      await app.close();
      await closeQueues();
      await disconnectRedis();
      await disconnectPrisma();
      logger.info("Shutdown complete");
      process.exit(0);
    } catch (err: unknown) {
      logger.error({ err }, "Error during shutdown");
      process.exit(1);
    }
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

void main();
