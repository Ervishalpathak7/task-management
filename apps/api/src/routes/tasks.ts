import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { requireAuth, requireVerified } from "../middleware/auth.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../middleware/validate.js";
import {
  createTaskSchema,
  updateTaskSchema,
  updateTaskStatusSchema,
  assignTaskSchema,
  uuidParamSchema,
  paginationSchema,
} from "../schemas/index.js";
import type {
  CreateTaskInput,
  UpdateTaskInput,
  UpdateTaskStatusInput,
  AssignTaskInput,
  UuidParam,
  PaginationInput,
} from "../schemas/index.js";
import {
  createTask,
  getTaskById,
  listTasksByGroup,
  updateTask,
  updateTaskStatus,
  acceptTask,
  assignTask,
  deleteTask,
  TaskError,
} from "../services/task.service.js";
import { GroupError } from "../services/group.service.js";
import { z } from "zod";

function handleTaskError(
  err: unknown,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  if (err instanceof TaskError || err instanceof GroupError) {
    void reply.status(err.statusCode).send({
      type: `https://api.taskmanagement.com/errors/${err.code.toLowerCase().replace(/_/g, "-")}`,
      title: err.code,
      status: err.statusCode,
      detail: err.message,
      instance: request.url,
    });
    return;
  }
  throw err;
}

const groupTasksParamsSchema = z.object({
  groupId: z.string().uuid(),
});

export async function registerTaskRoutes(app: FastifyInstance): Promise<void> {
  // ─── POST /api/v1/tasks ─────────────────────────────────

  app.post(
    "/api/v1/tasks",
    {
      preHandler: [
        requireAuth,
        requireVerified,
        validateBody(createTaskSchema),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      try {
        const body = request.body as CreateTaskInput;
        const task = await createTask(body, request.user!.sub);
        await reply.status(201).send({ task });
      } catch (err: unknown) {
        handleTaskError(err, request, reply);
      }
    },
  );

  // ─── GET /api/v1/groups/:groupId/tasks ──────────────────

  app.get(
    "/api/v1/groups/:groupId/tasks",
    {
      preHandler: [
        requireAuth,
        requireVerified,
        validateParams(groupTasksParamsSchema),
        validateQuery(paginationSchema),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      try {
        const params = request.params as { groupId: string };
        const query = request.query as PaginationInput;
        const result = await listTasksByGroup(
          params.groupId,
          request.user!.sub,
          query,
        );
        await reply.status(200).send({
          tasks: result.tasks,
          pagination: {
            page: query.page,
            limit: query.limit,
            total: result.total,
            totalPages: Math.ceil(result.total / query.limit),
          },
        });
      } catch (err: unknown) {
        handleTaskError(err, request, reply);
      }
    },
  );

  // ─── GET /api/v1/tasks/:id ──────────────────────────────

  app.get(
    "/api/v1/tasks/:id",
    {
      preHandler: [
        requireAuth,
        requireVerified,
        validateParams(uuidParamSchema),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      try {
        const params = request.params as UuidParam;
        const task = await getTaskById(params.id, request.user!.sub);
        await reply.status(200).send({ task });
      } catch (err: unknown) {
        handleTaskError(err, request, reply);
      }
    },
  );

  // ─── PATCH /api/v1/tasks/:id ────────────────────────────

  app.patch(
    "/api/v1/tasks/:id",
    {
      preHandler: [
        requireAuth,
        requireVerified,
        validateParams(uuidParamSchema),
        validateBody(updateTaskSchema),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      try {
        const params = request.params as UuidParam;
        const body = request.body as UpdateTaskInput;
        const task = await updateTask(params.id, body, request.user!.sub);
        await reply.status(200).send({ task });
      } catch (err: unknown) {
        handleTaskError(err, request, reply);
      }
    },
  );

  // ─── PATCH /api/v1/tasks/:id/status ─────────────────────

  app.patch(
    "/api/v1/tasks/:id/status",
    {
      preHandler: [
        requireAuth,
        requireVerified,
        validateParams(uuidParamSchema),
        validateBody(updateTaskStatusSchema),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      try {
        const params = request.params as UuidParam;
        const body = request.body as UpdateTaskStatusInput;
        const task = await updateTaskStatus(
          params.id,
          body.status,
          request.user!.sub,
        );
        await reply.status(200).send({ task });
      } catch (err: unknown) {
        handleTaskError(err, request, reply);
      }
    },
  );

  // ─── POST /api/v1/tasks/:id/accept ─────────────────────

  app.post(
    "/api/v1/tasks/:id/accept",
    {
      preHandler: [
        requireAuth,
        requireVerified,
        validateParams(uuidParamSchema),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      try {
        const params = request.params as UuidParam;
        const task = await acceptTask(params.id, request.user!.sub);
        await reply.status(200).send({ task });
      } catch (err: unknown) {
        handleTaskError(err, request, reply);
      }
    },
  );

  // ─── POST /api/v1/tasks/:id/assign ─────────────────────

  app.post(
    "/api/v1/tasks/:id/assign",
    {
      preHandler: [
        requireAuth,
        requireVerified,
        validateParams(uuidParamSchema),
        validateBody(assignTaskSchema),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      try {
        const params = request.params as UuidParam;
        const body = request.body as AssignTaskInput;
        const task = await assignTask(
          params.id,
          body.assigneeId,
          request.user!.sub,
        );
        await reply.status(200).send({ task });
      } catch (err: unknown) {
        handleTaskError(err, request, reply);
      }
    },
  );

  // ─── DELETE /api/v1/tasks/:id ───────────────────────────

  app.delete(
    "/api/v1/tasks/:id",
    {
      preHandler: [
        requireAuth,
        requireVerified,
        validateParams(uuidParamSchema),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      try {
        const params = request.params as UuidParam;
        await deleteTask(params.id, request.user!.sub);
        await reply.status(200).send({ message: "Task deleted" });
      } catch (err: unknown) {
        handleTaskError(err, request, reply);
      }
    },
  );
}
