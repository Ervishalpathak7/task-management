import IORedis from "ioredis";
import { getConfig } from "../config/index.js";
import { getLogger } from "./logger.js";

let _connection: IORedis | undefined;

export function createRedisConnection(): IORedis {
  if (_connection) return _connection;

  const config = getConfig();
  const logger = getLogger();

  const useTls = !!config.REDIS_PRIMARY_KEY;

  _connection = new IORedis({
    host: config.REDIS_HOST,
    port: config.REDIS_PORT,
    ...(config.REDIS_PRIMARY_KEY ? { password: config.REDIS_PRIMARY_KEY } : {}),
    ...(useTls ? { tls: { servername: config.REDIS_HOST } } : {}),
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: true,
    connectTimeout: 15000,
    retryStrategy(times: number) {
      const delay = Math.min(times * 200, 5000);
      logger.warn({ attempt: times, delayMs: delay }, "Redis reconnecting");
      return delay;
    },
  });

  _connection.on("connect", () => {
    logger.info(
      { host: config.REDIS_HOST, port: config.REDIS_PORT, tls: useTls },
      "Redis connected",
    );
  });

  _connection.on("error", (err: Error) => {
    logger.error({ err }, "Redis connection error");
  });

  return _connection;
}

export function getRedisConnection(): IORedis {
  if (!_connection) {
    throw new Error(
      "Redis not initialized. Call createRedisConnection() first.",
    );
  }
  return _connection;
}

export async function disconnectRedis(): Promise<void> {
  if (_connection) {
    await _connection.quit();
    _connection = undefined;
  }
}
