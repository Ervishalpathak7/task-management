import { getPrismaClient } from "../lib/prisma.js";
import { getLogger } from "../lib/logger.js";

// ─── Types ──────────────────────────────────────────────────

interface GroupResult {
  id: string;
  name: string;
  description: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

interface GroupWithMembers extends GroupResult {
  members: Array<{
    userId: string;
    role: string;
    user: { id: string; email: string; name: string };
    joinedAt: Date;
  }>;
}

// ─── Create ─────────────────────────────────────────────────

export async function createGroup(
  input: { name: string; description?: string },
  userId: string,
): Promise<GroupResult> {
  const prisma = getPrismaClient();
  const logger = getLogger();

  const group = await prisma.group.create({
    data: {
      name: input.name,
      description: input.description,
      createdById: userId,
      members: {
        create: {
          userId,
          role: "ADMIN",
        },
      },
    },
    select: {
      id: true,
      name: true,
      description: true,
      createdById: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  logger.info({ groupId: group.id, userId }, "Group created");
  return group;
}

// ─── Get by ID ──────────────────────────────────────────────

export async function getGroupById(
  groupId: string,
  userId: string,
): Promise<GroupWithMembers> {
  const prisma = getPrismaClient();

  await assertGroupMember(groupId, userId);

  const group = await prisma.group.findUnique({
    where: { id: groupId, deletedAt: null },
    select: {
      id: true,
      name: true,
      description: true,
      createdById: true,
      createdAt: true,
      updatedAt: true,
      members: {
        select: {
          userId: true,
          role: true,
          joinedAt: true,
          user: { select: { id: true, email: true, name: true } },
        },
      },
    },
  });

  if (!group) {
    throw new GroupError("GROUP_NOT_FOUND", "Group not found", 404);
  }

  return group;
}

// ─── List user's groups ─────────────────────────────────────

export async function listUserGroups(
  userId: string,
  pagination: { page: number; limit: number },
): Promise<{ groups: GroupResult[]; total: number }> {
  const prisma = getPrismaClient();
  const skip = (pagination.page - 1) * pagination.limit;

  const [groups, total] = await prisma.$transaction([
    prisma.group.findMany({
      where: {
        deletedAt: null,
        members: { some: { userId } },
      },
      select: {
        id: true,
        name: true,
        description: true,
        createdById: true,
        createdAt: true,
        updatedAt: true,
      },
      skip,
      take: pagination.limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.group.count({
      where: {
        deletedAt: null,
        members: { some: { userId } },
      },
    }),
  ]);

  return { groups, total };
}

// ─── Update ─────────────────────────────────────────────────

export async function updateGroup(
  groupId: string,
  input: { name?: string; description?: string },
  userId: string,
): Promise<GroupResult> {
  const prisma = getPrismaClient();

  await assertGroupAdmin(groupId, userId);

  const group = await prisma.group.update({
    where: { id: groupId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
    },
    select: {
      id: true,
      name: true,
      description: true,
      createdById: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return group;
}

// ─── Add member ─────────────────────────────────────────────

export async function addMember(
  groupId: string,
  input: { userId: string; role: string },
  actingUserId: string,
): Promise<void> {
  const prisma = getPrismaClient();
  const logger = getLogger();

  await assertGroupAdmin(groupId, actingUserId);

  // Check target user exists
  const targetUser = await prisma.user.findUnique({
    where: { id: input.userId },
  });
  if (!targetUser || targetUser.deletedAt) {
    throw new GroupError("USER_NOT_FOUND", "Target user not found", 404);
  }

  // Check not already a member
  const existing = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: input.userId, groupId } },
  });
  if (existing) {
    throw new GroupError(
      "ALREADY_MEMBER",
      "User is already a member of this group",
      409,
    );
  }

  await prisma.groupMember.create({
    data: {
      userId: input.userId,
      groupId,
      role: input.role as "ADMIN" | "MEMBER",
    },
  });

  logger.info(
    { groupId, targetUserId: input.userId, actingUserId },
    "Member added to group",
  );
}

// ─── Remove member ──────────────────────────────────────────

export async function removeMember(
  groupId: string,
  targetUserId: string,
  actingUserId: string,
): Promise<void> {
  const prisma = getPrismaClient();
  const logger = getLogger();

  await assertGroupAdmin(groupId, actingUserId);

  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: targetUserId, groupId } },
  });

  if (!membership) {
    throw new GroupError(
      "NOT_A_MEMBER",
      "User is not a member of this group",
      404,
    );
  }

  // Prevent removing the last admin
  if (membership.role === "ADMIN") {
    const adminCount = await prisma.groupMember.count({
      where: { groupId, role: "ADMIN" },
    });
    if (adminCount <= 1) {
      throw new GroupError(
        "LAST_ADMIN",
        "Cannot remove the last admin from the group",
        400,
      );
    }
  }

  await prisma.groupMember.delete({
    where: { userId_groupId: { userId: targetUserId, groupId } },
  });

  logger.info(
    { groupId, targetUserId, actingUserId },
    "Member removed from group",
  );
}

// ─── Authorization Helpers ──────────────────────────────────

export async function assertGroupMember(
  groupId: string,
  userId: string,
): Promise<void> {
  const prisma = getPrismaClient();
  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId } },
  });
  if (!membership) {
    throw new GroupError(
      "NOT_A_MEMBER",
      "You are not a member of this group",
      403,
    );
  }
}

export async function assertGroupAdmin(
  groupId: string,
  userId: string,
): Promise<void> {
  const prisma = getPrismaClient();
  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId } },
  });
  if (!membership || membership.role !== "ADMIN") {
    throw new GroupError(
      "NOT_ADMIN",
      "Admin access required for this group",
      403,
    );
  }
}

// ─── Error Class ────────────────────────────────────────────

export class GroupError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(code: string, message: string, statusCode: number) {
    super(message);
    this.name = "GroupError";
    this.code = code;
    this.statusCode = statusCode;
  }
}
