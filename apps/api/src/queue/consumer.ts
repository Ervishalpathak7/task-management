import { Worker, type Job } from "bullmq";
import type IORedis from "ioredis";
import { getRedisConnection } from "../lib/redis.js";
import { getLogger } from "../lib/logger.js";
import { getEmailProvider } from "../services/email.service.js";
import { QUEUE_NAMES, type EmailJobData } from "./producer.js";

let _emailWorker: Worker | undefined;

export function startEmailWorker(): Worker {
  const connection = getRedisConnection();
  const logger = getLogger();

  _emailWorker = new Worker<EmailJobData>(
    QUEUE_NAMES.EMAIL,
    async (job: Job<EmailJobData>) => {
      const { type, payload } = job.data;
      logger.info(
        { jobId: job.id, type, to: payload.to, attempt: job.attemptsMade + 1 },
        "Processing email job",
      );

      const provider = getEmailProvider();
      await provider.send(payload);

      logger.info(
        { jobId: job.id, type, to: payload.to },
        "Email job completed",
      );
    },
    {
      connection: connection as IORedis,
      concurrency: 5,
      limiter: {
        max: 10,
        duration: 1000, // max 10 emails/second
      },
    },
  );

  // ─── Event handlers ─────────────────────────────────────

  _emailWorker.on("completed", (job: Job<EmailJobData>) => {
    logger.debug({ jobId: job.id, type: job.data.type }, "Email job success");
  });

  _emailWorker.on(
    "failed",
    (job: Job<EmailJobData> | undefined, err: Error) => {
      if (!job) {
        logger.error({ err }, "Email job failed (unknown job)");
        return;
      }

      const isLastAttempt = job.attemptsMade >= (job.opts.attempts ?? 5);

      if (isLastAttempt) {
        // Dead-letter: log for manual review
        logger.error(
          {
            jobId: job.id,
            type: job.data.type,
            to: job.data.payload.to,
            attempts: job.attemptsMade,
            err,
          },
          "EMAIL DEAD-LETTER: Job exhausted all retries",
        );
      } else {
        logger.warn(
          {
            jobId: job.id,
            type: job.data.type,
            attempt: job.attemptsMade,
            err: err.message,
          },
          "Email job failed, will retry",
        );
      }
    },
  );

  _emailWorker.on("error", (err: Error) => {
    logger.error({ err }, "Email worker error");
  });

  logger.info(
    { concurrency: 5, queue: QUEUE_NAMES.EMAIL },
    "Email worker started",
  );

  return _emailWorker;
}

export async function stopEmailWorker(): Promise<void> {
  if (_emailWorker) {
    await _emailWorker.close();
    _emailWorker = undefined;
  }
}
