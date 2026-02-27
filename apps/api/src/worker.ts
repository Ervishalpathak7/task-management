import { loadConfig, getConfig } from "./config/index.js";
import { createLogger, getLogger } from "./lib/logger.js";
import { createPrismaClient, disconnectPrisma } from "./lib/prisma.js";
import { createRedisConnection, disconnectRedis } from "./lib/redis.js";
import { initEmailProvider } from "./services/email.service.js";
import { initQueues, closeQueues } from "./queue/producer.js";
import { startEmailWorker, stopEmailWorker } from "./queue/consumer.js";

async function main(): Promise<void> {
  // 1. Config + Logger
  loadConfig();
  const config = getConfig();
  createLogger();
  const logger = getLogger();

  logger.info({ env: config.NODE_ENV }, "Starting worker process");

  // 2. Database (for job processors that need DB access)
  createPrismaClient();

  // 3. Redis
  createRedisConnection();

  // 4. Email provider
  const emailProviderType = config.ENABLE_EMAIL ? "console" : "noop";
  initEmailProvider(emailProviderType);
  logger.info({ provider: emailProviderType }, "Email provider initialized");

  // 5. Initialize queues + start workers
  initQueues();
  startEmailWorker();

  logger.info("Worker process ready");

  // ─── Graceful shutdown ──────────────────────────────────

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, "Worker shutting down gracefully");
    try {
      await stopEmailWorker();
      await closeQueues();
      await disconnectRedis();
      await disconnectPrisma();
      logger.info("Worker shutdown complete");
      process.exit(0);
    } catch (err: unknown) {
      logger.error({ err }, "Error during worker shutdown");
      process.exit(1);
    }
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

void main();
