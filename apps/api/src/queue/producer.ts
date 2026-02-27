import { Queue } from "bullmq";
import type IORedis from "ioredis";
import { getRedisConnection } from "../lib/redis.js";
import { getLogger } from "../lib/logger.js";
import type { EmailPayload } from "../services/email.service.js";

// ─── Queue Names ────────────────────────────────────────────

export const QUEUE_NAMES = {
  EMAIL: "email",
} as const;

// ─── Queue Instances ────────────────────────────────────────

let _emailQueue: Queue | undefined;

export function initQueues(): void {
  const connection = getRedisConnection();
  const logger = getLogger();

  _emailQueue = new Queue(QUEUE_NAMES.EMAIL, {
    connection: connection as IORedis,
    defaultJobOptions: {
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 500 },
      attempts: 5,
      backoff: {
        type: "exponential",
        delay: 2000, // 2s, 4s, 8s, 16s, 32s
      },
    },
  });

  logger.info("BullMQ queues initialized");
}

export function getEmailQueue(): Queue {
  if (!_emailQueue) {
    throw new Error("Email queue not initialized. Call initQueues() first.");
  }
  return _emailQueue;
}

// ─── Job Types ──────────────────────────────────────────────

export interface EmailJobData {
  type: "verification" | "password-reset" | "task-assignment";
  payload: EmailPayload;
}

// ─── Enqueue Helpers ────────────────────────────────────────

export async function enqueueEmail(data: EmailJobData): Promise<void> {
  const logger = getLogger();

  try {
    const queue = getEmailQueue();
    await queue.add(`email:${data.type}`, data, {
      // Dedup: same email type + recipient within 60s
      jobId: `${data.type}:${data.payload.to}:${Math.floor(Date.now() / 60000)}`,
    });
    logger.debug(
      { type: data.type, to: data.payload.to },
      "Email job enqueued",
    );
  } catch (err: unknown) {
    // Never let queue failure crash the API request
    logger.error(
      { err, type: data.type, to: data.payload.to },
      "Failed to enqueue email job",
    );
  }
}

// ─── Cleanup ────────────────────────────────────────────────

export async function closeQueues(): Promise<void> {
  if (_emailQueue) {
    await _emailQueue.close();
    _emailQueue = undefined;
  }
}
