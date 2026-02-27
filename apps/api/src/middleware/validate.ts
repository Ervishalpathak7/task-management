import type { FastifyRequest, FastifyReply } from "fastify";
import type { ZodSchema, ZodError } from "zod";
import type { ApiProblem } from "@task-management/types";

/**
 * Factory that returns a preHandler validating request.body against a Zod schema.
 * Attaches parsed data to request.body (replacing raw input with validated/transformed data).
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const result = schema.safeParse(request.body);
    if (!result.success) {
      const problem = zodErrorToProblem(result.error, request.url);
      await reply.status(400).send(problem);
      return;
    }
    (request.body as T) = result.data;
  };
}

/**
 * Factory that returns a preHandler validating request.params against a Zod schema.
 */
export function validateParams<T>(schema: ZodSchema<T>) {
  return async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const result = schema.safeParse(request.params);
    if (!result.success) {
      const problem = zodErrorToProblem(result.error, request.url);
      await reply.status(400).send(problem);
      return;
    }
    (request.params as T) = result.data;
  };
}

/**
 * Factory that returns a preHandler validating request.query against a Zod schema.
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const result = schema.safeParse(request.query);
    if (!result.success) {
      const problem = zodErrorToProblem(result.error, request.url);
      await reply.status(400).send(problem);
      return;
    }
    (request.query as T) = result.data;
  };
}

function zodErrorToProblem(error: ZodError, instance: string): ApiProblem {
  return {
    type: "https://api.taskmanagement.com/errors/validation-failed",
    title: "Validation Failed",
    status: 400,
    detail: "Request validation failed",
    instance,
    errors: error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    })),
  };
}
