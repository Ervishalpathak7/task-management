import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth, requireVerified } from "../middleware/auth.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../middleware/validate.js";
import {
  createGroupSchema,
  updateGroupSchema,
  addGroupMemberSchema,
  uuidParamSchema,
  paginationSchema,
} from "../schemas/index.js";
import type {
  CreateGroupInput,
  UpdateGroupInput,
  AddGroupMemberInput,
  UuidParam,
  PaginationInput,
} from "../schemas/index.js";
import {
  createGroup,
  getGroupById,
  listUserGroups,
  updateGroup,
  addMember,
  removeMember,
  GroupError,
} from "../services/group.service.js";

const removeMemberParamsSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
});

function handleGroupError(
  err: unknown,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  if (err instanceof GroupError) {
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

function getUserId(
  request: FastifyRequest,
  reply: FastifyReply,
): string | null {
  const userId = request.user?.sub;
  if (!userId) {
    void reply.status(401).send({ status: 401, detail: "Unauthorized" });
    return null;
  }
  return userId;
}

export function registerGroupRoutes(app: FastifyInstance): void {
  // ─── POST /api/v1/groups ────────────────────────────────

  app.post(
    "/api/v1/groups",
    {
      preHandler: [
        requireAuth,
        requireVerified,
        validateBody(createGroupSchema),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      try {
        const userId = getUserId(request, reply);
        if (!userId) return;
        const body = request.body as CreateGroupInput;
        const group = await createGroup(body, userId);
        await reply.status(201).send({ group });
      } catch (err: unknown) {
        handleGroupError(err, request, reply);
      }
    },
  );

  // ─── GET /api/v1/groups ─────────────────────────────────

  app.get(
    "/api/v1/groups",
    {
      preHandler: [
        requireAuth,
        requireVerified,
        validateQuery(paginationSchema),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const userId = getUserId(request, reply);
      if (!userId) return;
      const query = request.query as PaginationInput;
      const result = await listUserGroups(userId, query);
      await reply.status(200).send({
        groups: result.groups,
        pagination: {
          page: query.page,
          limit: query.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / query.limit),
        },
      });
    },
  );

  // ─── GET /api/v1/groups/:id ─────────────────────────────

  app.get(
    "/api/v1/groups/:id",
    {
      preHandler: [
        requireAuth,
        requireVerified,
        validateParams(uuidParamSchema),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      try {
        const userId = getUserId(request, reply);
        if (!userId) return;
        const params = request.params as UuidParam;
        const group = await getGroupById(params.id, userId);
        await reply.status(200).send({ group });
      } catch (err: unknown) {
        handleGroupError(err, request, reply);
      }
    },
  );

  // ─── PATCH /api/v1/groups/:id ───────────────────────────

  app.patch(
    "/api/v1/groups/:id",
    {
      preHandler: [
        requireAuth,
        requireVerified,
        validateParams(uuidParamSchema),
        validateBody(updateGroupSchema),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      try {
        const userId = getUserId(request, reply);
        if (!userId) return;
        const params = request.params as UuidParam;
        const body = request.body as UpdateGroupInput;
        const group = await updateGroup(params.id, body, userId);
        await reply.status(200).send({ group });
      } catch (err: unknown) {
        handleGroupError(err, request, reply);
      }
    },
  );

  // ─── POST /api/v1/groups/:id/members ────────────────────

  app.post(
    "/api/v1/groups/:id/members",
    {
      preHandler: [
        requireAuth,
        requireVerified,
        validateParams(uuidParamSchema),
        validateBody(addGroupMemberSchema),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      try {
        const userId = getUserId(request, reply);
        if (!userId) return;
        const params = request.params as UuidParam;
        const body = request.body as AddGroupMemberInput;
        await addMember(params.id, body, userId);
        await reply.status(201).send({ message: "Member added" });
      } catch (err: unknown) {
        handleGroupError(err, request, reply);
      }
    },
  );

  // ─── DELETE /api/v1/groups/:id/members/:userId ──────────

  app.delete(
    "/api/v1/groups/:id/members/:userId",
    {
      preHandler: [
        requireAuth,
        requireVerified,
        validateParams(removeMemberParamsSchema),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      try {
        const userId = getUserId(request, reply);
        if (!userId) return;
        const params = request.params as { id: string; userId: string };
        await removeMember(params.id, params.userId, userId);
        await reply.status(200).send({ message: "Member removed" });
      } catch (err: unknown) {
        handleGroupError(err, request, reply);
      }
    },
  );
}
