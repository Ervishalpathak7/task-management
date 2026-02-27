import type { FastifyRequest, FastifyReply } from "fastify";
import { verifyAccessToken } from "../lib/jwt.js";
import { getAccessTokenFromCookie } from "../lib/cookies.js";
import { getLogger } from "../lib/logger.js";
import type { AccessTokenPayload } from "../lib/jwt.js";

// Extend Fastify request type
declare module "fastify" {
  interface FastifyRequest {
    user?: AccessTokenPayload;
  }
}

/**
 * Pre-handler hook: Requires a valid access token.
 * Attach to individual routes — NOT globally.
 */
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const logger = getLogger();
  const token = getAccessTokenFromCookie(
    request.cookies as Record<string, string | undefined>,
  );

  if (!token) {
    await reply.status(401).send({
      type: "https://api.taskmanagement.com/errors/unauthorized",
      title: "Unauthorized",
      status: 401,
      detail: "Authentication required",
      instance: request.url,
    });
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    request.user = payload;
  } catch (err: unknown) {
    logger.debug({ err, url: request.url }, "Invalid access token");
    await reply.status(401).send({
      type: "https://api.taskmanagement.com/errors/token-expired",
      title: "Unauthorized",
      status: 401,
      detail: "Access token is invalid or expired",
      instance: request.url,
    });
  }
}

/**
 * Pre-handler hook: Requires user to be in ACTIVE status.
 * Must be used AFTER requireAuth.
 */
export async function requireVerified(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (!request.user) {
    await reply.status(401).send({
      type: "https://api.taskmanagement.com/errors/unauthorized",
      title: "Unauthorized",
      status: 401,
      detail: "Authentication required",
      instance: request.url,
    });
    return;
  }

  if (request.user.status !== "ACTIVE") {
    await reply.status(403).send({
      type: "https://api.taskmanagement.com/errors/unverified",
      title: "Forbidden",
      status: 403,
      detail: "Email verification required before accessing this resource",
      instance: request.url,
    });
  }
}
