import { randomUUID } from "node:crypto";
import { getPrismaClient } from "../lib/prisma.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { generateOpaqueToken, hashToken } from "../lib/crypto.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../lib/jwt.js";
import { getConfig } from "../config/index.js";
import { getLogger } from "../lib/logger.js";
import type { User } from "@prisma/client";

// ─── Types ──────────────────────────────────────────────────

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface RegisterResult {
  user: Pick<User, "id" | "email" | "name" | "status">;
  verificationToken: string;
}

interface UserProfile {
  id: string;
  email: string;
  name: string;
  status: string;
  createdAt: Date;
}

// ─── Register ───────────────────────────────────────────────

export async function registerUser(input: {
  email: string;
  password: string;
  name: string;
}): Promise<RegisterResult> {
  const prisma = getPrismaClient();
  const logger = getLogger();

  const existing = await prisma.user.findUnique({
    where: { email: input.email },
  });
  if (existing) {
    throw new AuthError(
      "EMAIL_EXISTS",
      "A user with this email already exists",
      409,
    );
  }

  const passwordHash = await hashPassword(input.password);
  const { raw: verificationRaw, hash: verificationHash } =
    generateOpaqueToken();

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      name: input.name,
      status: "UNVERIFIED",
    },
    select: { id: true, email: true, name: true, status: true },
  });

  // Store verification token
  await prisma.verificationToken.create({
    data: {
      tokenHash: verificationHash,
      userId: user.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
    },
  });

  logger.info({ userId: user.id }, "User registered");
  return { user, verificationToken: verificationRaw };
}

// ─── Login ──────────────────────────────────────────────────

export async function loginUser(input: {
  email: string;
  password: string;
}): Promise<AuthTokens & { user: UserProfile }> {
  const prisma = getPrismaClient();
  const logger = getLogger();

  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !user.passwordHash) {
    throw new AuthError(
      "INVALID_CREDENTIALS",
      "Invalid email or password",
      401,
    );
  }

  if (user.deletedAt) {
    throw new AuthError(
      "ACCOUNT_DELETED",
      "This account has been deactivated",
      401,
    );
  }

  if (user.status === "SUSPENDED") {
    throw new AuthError(
      "ACCOUNT_SUSPENDED",
      "This account has been suspended",
      403,
    );
  }

  const valid = await verifyPassword(user.passwordHash, input.password);
  if (!valid) {
    throw new AuthError(
      "INVALID_CREDENTIALS",
      "Invalid email or password",
      401,
    );
  }

  const tokens = await createTokenPair(user.id, user.email, user.status);
  logger.info({ userId: user.id }, "User logged in");

  return {
    ...tokens,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      status: user.status,
      createdAt: user.createdAt,
    },
  };
}

// ─── Refresh ────────────────────────────────────────────────

export async function refreshTokens(
  rawRefreshToken: string,
): Promise<AuthTokens> {
  const prisma = getPrismaClient();
  const logger = getLogger();

  let claims: ReturnType<typeof verifyRefreshToken>;
  try {
    claims = verifyRefreshToken(rawRefreshToken);
  } catch {
    throw new AuthError("INVALID_TOKEN", "Invalid refresh token", 401);
  }

  const tokenHash = hashToken(rawRefreshToken);
  const storedToken = await prisma.refreshToken.findFirst({
    where: { tokenHash, userId: claims.sub },
  });

  if (!storedToken) {
    // Token not found — possible reuse attack. Revoke entire family.
    logger.warn(
      { userId: claims.sub, family: claims.family },
      "Refresh token reuse detected — revoking family",
    );
    await prisma.refreshToken.updateMany({
      where: { family: claims.family },
      data: { revoked: true },
    });
    throw new AuthError("TOKEN_REUSE", "Refresh token has been revoked", 401);
  }

  if (storedToken.revoked) {
    // Already-revoked token used again — revoke entire family
    logger.warn(
      { userId: claims.sub, family: claims.family },
      "Revoked refresh token reused — revoking family",
    );
    await prisma.refreshToken.updateMany({
      where: { family: claims.family },
      data: { revoked: true },
    });
    throw new AuthError("TOKEN_REUSE", "Refresh token has been revoked", 401);
  }

  if (storedToken.expiresAt < new Date()) {
    throw new AuthError("TOKEN_EXPIRED", "Refresh token has expired", 401);
  }

  // Revoke old token
  await prisma.refreshToken.update({
    where: { id: storedToken.id },
    data: { revoked: true },
  });

  // Fetch user for new access token
  const user = await prisma.user.findUnique({ where: { id: claims.sub } });
  if (!user || user.deletedAt) {
    throw new AuthError("USER_NOT_FOUND", "User not found", 401);
  }

  // Issue new pair in same family
  const tokens = await createTokenPair(
    user.id,
    user.email,
    user.status,
    claims.family,
  );
  logger.debug({ userId: user.id }, "Token refreshed");
  return tokens;
}

// ─── Logout ─────────────────────────────────────────────────

export async function logoutUser(
  rawRefreshToken: string | undefined,
  userId: string,
): Promise<void> {
  const prisma = getPrismaClient();
  const logger = getLogger();

  if (rawRefreshToken) {
    const tokenHash = hashToken(rawRefreshToken);
    const storedToken = await prisma.refreshToken.findFirst({
      where: { tokenHash, userId },
    });
    if (storedToken) {
      // Revoke entire family
      await prisma.refreshToken.updateMany({
        where: { family: storedToken.family },
        data: { revoked: true },
      });
    }
  }

  logger.info({ userId }, "User logged out");
}

// ─── Email Verification ────────────────────────────────────

export async function verifyEmail(rawToken: string): Promise<void> {
  const prisma = getPrismaClient();
  const logger = getLogger();
  const tokenHash = hashToken(rawToken);

  const stored = await prisma.verificationToken.findUnique({
    where: { tokenHash },
  });

  if (!stored) {
    throw new AuthError(
      "INVALID_TOKEN",
      "Invalid or expired verification token",
      400,
    );
  }

  if (stored.expiresAt < new Date()) {
    await prisma.verificationToken.delete({ where: { id: stored.id } });
    throw new AuthError("TOKEN_EXPIRED", "Verification token has expired", 400);
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: stored.userId },
      data: { status: "ACTIVE" },
    }),
    prisma.verificationToken.delete({ where: { id: stored.id } }),
  ]);

  logger.info({ userId: stored.userId }, "Email verified");
}

export async function resendVerification(
  email: string,
): Promise<string | null> {
  const prisma = getPrismaClient();

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status !== "UNVERIFIED") {
    // Don't reveal user existence
    return null;
  }

  // Delete old tokens
  await prisma.verificationToken.deleteMany({ where: { userId: user.id } });

  const { raw, hash } = generateOpaqueToken();
  await prisma.verificationToken.create({
    data: {
      tokenHash: hash,
      userId: user.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
    },
  });

  return raw;
}

// ─── Password Reset ────────────────────────────────────────

export async function requestPasswordReset(
  email: string,
): Promise<string | null> {
  const prisma = getPrismaClient();

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.deletedAt) {
    // Don't reveal user existence
    return null;
  }

  // Delete old tokens
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

  const { raw, hash } = generateOpaqueToken();
  await prisma.passwordResetToken.create({
    data: {
      tokenHash: hash,
      userId: user.id,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
    },
  });

  return raw;
}

export async function resetPassword(
  rawToken: string,
  newPassword: string,
): Promise<void> {
  const prisma = getPrismaClient();
  const logger = getLogger();
  const tokenHash = hashToken(rawToken);

  const stored = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });

  if (!stored) {
    throw new AuthError("INVALID_TOKEN", "Invalid or expired reset token", 400);
  }

  if (stored.expiresAt < new Date()) {
    await prisma.passwordResetToken.delete({ where: { id: stored.id } });
    throw new AuthError("TOKEN_EXPIRED", "Reset token has expired", 400);
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: stored.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.delete({ where: { id: stored.id } }),
    // Invalidate all refresh tokens
    prisma.refreshToken.updateMany({
      where: { userId: stored.userId },
      data: { revoked: true },
    }),
  ]);

  logger.info(
    { userId: stored.userId },
    "Password reset completed, all sessions revoked",
  );
}

// ─── Profile ────────────────────────────────────────────────

export async function getUserProfile(userId: string): Promise<UserProfile> {
  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new AuthError("USER_NOT_FOUND", "User not found", 404);
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    status: user.status,
    createdAt: user.createdAt,
  };
}

export async function updateProfile(
  userId: string,
  input: { name?: string },
): Promise<UserProfile> {
  const prisma = getPrismaClient();
  const user = await prisma.user.update({
    where: { id: userId, deletedAt: null },
    data: { ...(input.name ? { name: input.name } : {}) },
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
      createdAt: true,
    },
  });

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    status: user.status,
    createdAt: user.createdAt,
  };
}

// ─── Internal Helpers ───────────────────────────────────────

async function createTokenPair(
  userId: string,
  email: string,
  status: string,
  family?: string,
): Promise<AuthTokens> {
  const prisma = getPrismaClient();
  const config = getConfig();
  const tokenFamily = family ?? randomUUID();

  const accessToken = signAccessToken({ userId, email, status });

  // Create refresh token DB record first to get its ID
  const refreshTokenRecord = await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: "", // Placeholder — updated below
      family: tokenFamily,
      expiresAt: new Date(
        Date.now() + config.JWT_REFRESH_EXPIRY_SECONDS * 1000,
      ),
    },
  });

  // Sign refresh JWT containing the record ID
  const refreshToken = signRefreshToken({
    userId,
    tokenId: refreshTokenRecord.id,
    family: tokenFamily,
  });

  // Store the hash of the signed JWT
  const refreshHash = hashToken(refreshToken);
  await prisma.refreshToken.update({
    where: { id: refreshTokenRecord.id },
    data: { tokenHash: refreshHash },
  });

  return { accessToken, refreshToken };
}

// ─── Error Class ────────────────────────────────────────────

export class AuthError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(code: string, message: string, statusCode: number) {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.statusCode = statusCode;
  }
}
