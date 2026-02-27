import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import type { ApiProblem } from "@task-management/types";
import { getLogger } from "../lib/logger.js";
import { AuthError } from "../services/auth.service.js";
import { GroupError } from "../services/group.service.js";
import { TaskError } from "../services/task.service.js";

type ServiceError = AuthError | GroupError | TaskError;

function isServiceError(err: unknown): err is ServiceError {
  return (
    err instanceof AuthError ||
    err instanceof GroupError ||
    err instanceof TaskError
  );
}

export function globalErrorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  const logger = getLogger();

  // Handle domain service errors
  if (isServiceError(error)) {
    void reply.status(error.statusCode).send({
      type: `https://api.taskmanagement.com/errors/${error.code.toLowerCase().replace(/_/g, "-")}`,
      title: error.code,
      status: error.statusCode,
      detail: error.message,
      instance: request.url,
    } satisfies ApiProblem);
    return;
  }

  const fastifyError = error as FastifyError;
  const statusCode = fastifyError.statusCode ?? 500;

  if (statusCode >= 500) {
    logger.error(
      {
        err: error,
        requestId: request.id,
        url: request.url,
        method: request.method,
      },
      "Unhandled server error",
    );
  } else {
    logger.warn(
      { err: error, requestId: request.id, url: request.url },
      "Client error",
    );
  }

  const problem: ApiProblem = {
    type: `https://api.taskmanagement.com/errors/${(fastifyError.code as string | undefined) ?? "internal-error"}`,
    title: (error.name as string | undefined) ?? "Internal Server Error",
    status: statusCode,
    detail: statusCode >= 500 ? "An unexpected error occurred" : error.message,
    instance: request.url,
  };

  void reply.status(statusCode).send(problem);
}
