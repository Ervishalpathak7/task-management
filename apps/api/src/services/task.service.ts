import { getPrismaClient } from "../lib/prisma.js";
import { getLogger } from "../lib/logger.js";
import { assertGroupMember } from "./group.service.js";
import { isFeatureEnabled } from "../lib/feature-flags.js";
import { enqueueEmail } from "../queue/producer.js";
import { taskAssignmentEmail } from "./email-templates.js";
import { getConfig } from "../config/index.js";
import { audit } from "../lib/audit.js";
import type { TaskStatus } from "@task-management/types";

// ─── State Machine ──────────────────────────────────────────

const VALID_TRANSITIONS: Record<string, readonly string[]> = {
  PENDING_ACCEPTANCE: ["OPEN", "CLOSED"],
  OPEN: ["IN_PROGRESS", "CLOSED"],
  IN_PROGRESS: ["COMPLETED", "OPEN", "CLOSED"],
  COMPLETED: ["CLOSED"],
  CLOSED: [],
} as const;

function isValidTransition(from: string, to: string): boolean {
  const allowed = VALID_TRANSITIONS[from];
  return allowed !== undefined && allowed.includes(to);
}

// ─── Types ──────────────────────────────────────────────────

interface TaskResult {
  id: string;
  title: string;
  description: string | null;
  status: string;
  groupId: string;
  createdById: string;
  assigneeId: string | null;
  acceptedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Create ─────────────────────────────────────────────────

export async function createTask(
  input: {
    title: string;
    description?: string;
    groupId: string;
    assigneeId?: string;
  },
  userId: string,
): Promise<TaskResult> {
  const prisma = getPrismaClient();
  const logger = getLogger();

  // Verify creator is member of group
  await assertGroupMember(input.groupId, userId);

  let initialStatus: string = "OPEN";

  // If assigning, verify assignee is in the same group
  if (input.assigneeId) {
    if (!isFeatureEnabled("ENABLE_ASSIGNMENTS")) {
      throw new TaskError(
        "FEATURE_DISABLED",
        "Task assignments are currently disabled",
        400,
      );
    }

    await assertGroupMember(input.groupId, input.assigneeId);
    initialStatus = "PENDING_ACCEPTANCE";
  }

  const task = await prisma.task.create({
    data: {
      title: input.title,
      description: input.description,
      groupId: input.groupId,
      createdById: userId,
      assigneeId: input.assigneeId,
      status: initialStatus as TaskStatus,
    },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      groupId: true,
      createdById: true,
      assigneeId: true,
      acceptedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  logger.info(
    { taskId: task.id, groupId: input.groupId, userId },
    "Task created",
  );
  audit({
    action: "TASK_CREATED",
    actorId: userId,
    targetId: task.id,
    targetType: "task",
    metadata: { assigneeId: input.assigneeId ?? "none" },
  });

  // Enqueue assignment email (async — never blocks response)
  if (input.assigneeId && isFeatureEnabled("ENABLE_EMAIL")) {
    void enqueueAssignmentEmail(userId, input.assigneeId, task.title, task.id);
  }

  return task;
}

// ─── Get by ID ──────────────────────────────────────────────

export async function getTaskById(
  taskId: string,
  userId: string,
): Promise<TaskResult> {
  const prisma = getPrismaClient();

  const task = await prisma.task.findUnique({
    where: { id: taskId, deletedAt: null },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      groupId: true,
      createdById: true,
      assigneeId: true,
      acceptedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!task) {
    throw new TaskError("TASK_NOT_FOUND", "Task not found", 404);
  }

  // Verify user has access to the task's group
  await assertGroupMember(task.groupId, userId);

  return task;
}

// ─── List tasks by group ────────────────────────────────────

export async function listTasksByGroup(
  groupId: string,
  userId: string,
  pagination: { page: number; limit: number },
): Promise<{ tasks: TaskResult[]; total: number }> {
  const prisma = getPrismaClient();

  await assertGroupMember(groupId, userId);

  const skip = (pagination.page - 1) * pagination.limit;

  const [tasks, total] = await prisma.$transaction([
    prisma.task.findMany({
      where: { groupId, deletedAt: null },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        groupId: true,
        createdById: true,
        assigneeId: true,
        acceptedAt: true,
        createdAt: true,
        updatedAt: true,
      },
      skip,
      take: pagination.limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.task.count({
      where: { groupId, deletedAt: null },
    }),
  ]);

  return { tasks, total };
}

// ─── Update (title/description) ─────────────────────────────

export async function updateTask(
  taskId: string,
  input: { title?: string; description?: string },
  userId: string,
): Promise<TaskResult> {
  const prisma = getPrismaClient();

  const task = await getTaskById(taskId, userId);

  // Only creator can update task metadata
  if (task.createdById !== userId) {
    throw new TaskError(
      "FORBIDDEN",
      "Only the task creator can update this task",
      403,
    );
  }

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
    },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      groupId: true,
      createdById: true,
      assigneeId: true,
      acceptedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return updated;
}

// ─── Update status (state machine) ──────────────────────────

export async function updateTaskStatus(
  taskId: string,
  newStatus: string,
  userId: string,
): Promise<TaskResult> {
  const prisma = getPrismaClient();
  const logger = getLogger();

  const task = await getTaskById(taskId, userId);

  if (!isValidTransition(task.status, newStatus)) {
    throw new TaskError(
      "INVALID_TRANSITION",
      `Cannot transition from ${task.status} to ${newStatus}`,
      400,
    );
  }

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: { status: newStatus as TaskStatus },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      groupId: true,
      createdById: true,
      assigneeId: true,
      acceptedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  logger.info(
    { taskId, from: task.status, to: newStatus, userId },
    "Task status updated",
  );
  audit({
    action: "TASK_STATUS_CHANGED",
    actorId: userId,
    targetId: taskId,
    targetType: "task",
    metadata: { from: task.status, to: newStatus },
  });
  return updated;
}

// ─── Accept assignment ──────────────────────────────────────

export async function acceptTask(
  taskId: string,
  userId: string,
): Promise<TaskResult> {
  const prisma = getPrismaClient();
  const logger = getLogger();

  const task = await getTaskById(taskId, userId);

  if (task.assigneeId !== userId) {
    throw new TaskError(
      "FORBIDDEN",
      "Only the assigned user can accept this task",
      403,
    );
  }

  if (task.status !== "PENDING_ACCEPTANCE") {
    throw new TaskError("INVALID_STATE", "Task is not pending acceptance", 400);
  }

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      status: "OPEN",
      acceptedAt: new Date(),
    },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      groupId: true,
      createdById: true,
      assigneeId: true,
      acceptedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  logger.info({ taskId, userId }, "Task accepted by assignee");
  audit({
    action: "TASK_ACCEPTED",
    actorId: userId,
    targetId: taskId,
    targetType: "task",
  });
  return updated;
}

// ─── Assign task ────────────────────────────────────────────

export async function assignTask(
  taskId: string,
  assigneeId: string,
  userId: string,
): Promise<TaskResult> {
  const prisma = getPrismaClient();
  const logger = getLogger();

  if (!isFeatureEnabled("ENABLE_ASSIGNMENTS")) {
    throw new TaskError(
      "FEATURE_DISABLED",
      "Task assignments are currently disabled",
      400,
    );
  }

  const task = await getTaskById(taskId, userId);

  if (task.createdById !== userId) {
    throw new TaskError(
      "FORBIDDEN",
      "Only the task creator can assign this task",
      403,
    );
  }

  // Verify assignee is in the same group
  await assertGroupMember(task.groupId, assigneeId);

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      assigneeId,
      status: "PENDING_ACCEPTANCE",
      acceptedAt: null,
    },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      groupId: true,
      createdById: true,
      assigneeId: true,
      acceptedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  logger.info({ taskId, assigneeId, userId }, "Task assigned");
  audit({
    action: "TASK_ASSIGNED",
    actorId: userId,
    targetId: taskId,
    targetType: "task",
    metadata: { assigneeId },
  });

  // Enqueue assignment email (async — never blocks response)
  if (isFeatureEnabled("ENABLE_EMAIL")) {
    void enqueueAssignmentEmail(userId, assigneeId, updated.title, taskId);
  }

  return updated;
}

// ─── Soft delete ────────────────────────────────────────────

export async function deleteTask(
  taskId: string,
  userId: string,
): Promise<void> {
  const prisma = getPrismaClient();
  const logger = getLogger();

  const task = await getTaskById(taskId, userId);

  if (task.createdById !== userId) {
    throw new TaskError(
      "FORBIDDEN",
      "Only the task creator can delete this task",
      403,
    );
  }

  await prisma.task.update({
    where: { id: taskId },
    data: { deletedAt: new Date() },
  });

  logger.info({ taskId, userId }, "Task soft-deleted");
  audit({
    action: "TASK_DELETED",
    actorId: userId,
    targetId: taskId,
    targetType: "task",
  });
}

// ─── Internal Helpers ───────────────────────────────────────

async function enqueueAssignmentEmail(
  assignerUserId: string,
  assigneeUserId: string,
  taskTitle: string,
  taskId: string,
): Promise<void> {
  const prisma = getPrismaClient();
  const logger = getLogger();
  const config = getConfig();

  try {
    const [assigner, assignee] = await Promise.all([
      prisma.user.findUnique({
        where: { id: assignerUserId },
        select: { name: true },
      }),
      prisma.user.findUnique({
        where: { id: assigneeUserId },
        select: { email: true },
      }),
    ]);

    if (!assigner || !assignee) {
      logger.warn(
        { assignerUserId, assigneeUserId },
        "Cannot send assignment email — user not found",
      );
      return;
    }

    const emailData = taskAssignmentEmail(
      assignee.email,
      assigner.name,
      taskTitle,
      taskId,
      config.CORS_ORIGIN,
    );

    await enqueueEmail({ type: "task-assignment", payload: emailData });
  } catch (err: unknown) {
    // Never let email failures affect task operations
    logger.error(
      { err, taskId, assigneeUserId },
      "Failed to enqueue assignment email",
    );
  }
}

// ─── Error Class ────────────────────────────────────────────

export class TaskError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(code: string, message: string, statusCode: number) {
    super(message);
    this.name = "TaskError";
    this.code = code;
    this.statusCode = statusCode;
  }
}
