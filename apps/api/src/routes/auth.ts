import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { requireAuth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from "../schemas/index.js";
import type {
  RegisterInput,
  LoginInput,
  VerifyEmailInput,
  ResendVerificationInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  UpdateProfileInput,
} from "../schemas/index.js";
import {
  registerUser,
  loginUser,
  refreshTokens,
  logoutUser,
  verifyEmail,
  resendVerification,
  requestPasswordReset,
  resetPassword,
  getUserProfile,
  updateProfile,
  AuthError,
} from "../services/auth.service.js";
import {
  setAuthCookies,
  clearAuthCookies,
  getRefreshTokenFromCookie,
} from "../lib/cookies.js";
import { isFeatureEnabled } from "../lib/feature-flags.js";
import { enqueueEmail } from "../queue/producer.js";
import {
  verificationEmail,
  passwordResetEmail,
} from "../services/email-templates.js";
import { getConfig } from "../config/index.js";
import { audit } from "../lib/audit.js";

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  // ─── POST /api/v1/auth/register ─────────────────────────

  app.post(
    "/api/v1/auth/register",
    { preHandler: [validateBody(registerSchema)] },
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      try {
        const body = request.body as RegisterInput;
        const result = await registerUser(body);

        // Enqueue verification email (async — never blocks response)
        if (isFeatureEnabled("ENABLE_EMAIL")) {
          const config = getConfig();
          const emailData = verificationEmail(
            result.user.email,
            result.verificationToken,
            config.CORS_ORIGIN,
          );
          void enqueueEmail({ type: "verification", payload: emailData });
        }

        const responsePayload: Record<string, unknown> = {
          user: result.user,
          message: "Registration successful. Please verify your email.",
        };

        // Only include token in non-production for testing
        if (process.env["NODE_ENV"] !== "production") {
          responsePayload["verificationToken"] = result.verificationToken;
        }

        audit({
          action: "AUTH_REGISTER",
          actorId: result.user.id,
          targetId: result.user.id,
          targetType: "user",
          ip: request.ip,
          userAgent: request.headers["user-agent"],
        });

        await reply.status(201).send(responsePayload);
      } catch (err: unknown) {
        if (err instanceof AuthError) {
          await reply.status(err.statusCode).send({
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
    },
  );

  // ─── POST /api/v1/auth/login ────────────────────────────

  app.post(
    "/api/v1/auth/login",
    { preHandler: [validateBody(loginSchema)] },
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      try {
        const body = request.body as LoginInput;
        const result = await loginUser(body);
        setAuthCookies(reply, result.accessToken, result.refreshToken);

        audit({
          action: "AUTH_LOGIN_SUCCESS",
          actorId: result.user.id,
          targetType: "user",
          ip: request.ip,
          userAgent: request.headers["user-agent"],
        });

        await reply.status(200).send({ user: result.user });
      } catch (err: unknown) {
        if (err instanceof AuthError) {
          audit({
            action: "AUTH_LOGIN_FAILURE",
            metadata: { reason: err.code },
            ip: request.ip,
            userAgent: request.headers["user-agent"],
          });
          await reply.status(err.statusCode).send({
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
    },
  );

  // ─── POST /api/v1/auth/refresh ──────────────────────────

  app.post(
    "/api/v1/auth/refresh",
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      try {
        const rawToken = getRefreshTokenFromCookie(
          request.cookies as Record<string, string | undefined>,
        );
        if (!rawToken) {
          await reply.status(401).send({
            type: "https://api.taskmanagement.com/errors/no-refresh-token",
            title: "Unauthorized",
            status: 401,
            detail: "No refresh token provided",
            instance: request.url,
          });
          return;
        }

        const tokens = await refreshTokens(rawToken);
        setAuthCookies(reply, tokens.accessToken, tokens.refreshToken);

        await reply.status(200).send({ message: "Tokens refreshed" });
      } catch (err: unknown) {
        if (err instanceof AuthError) {
          clearAuthCookies(reply);
          await reply.status(err.statusCode).send({
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
    },
  );

  // ─── POST /api/v1/auth/logout ───────────────────────────

  app.post(
    "/api/v1/auth/logout",
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const rawToken = getRefreshTokenFromCookie(
        request.cookies as Record<string, string | undefined>,
      );
      await logoutUser(rawToken, request.user!.sub);
      clearAuthCookies(reply);
      audit({
        action: "AUTH_LOGOUT",
        actorId: request.user!.sub,
        targetType: "user",
      });
      await reply.status(200).send({ message: "Logged out" });
    },
  );

  // ─── POST /api/v1/auth/verify-email ─────────────────────

  app.post(
    "/api/v1/auth/verify-email",
    { preHandler: [validateBody(verifyEmailSchema)] },
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      try {
        const body = request.body as VerifyEmailInput;
        await verifyEmail(body.token);
        audit({ action: "AUTH_EMAIL_VERIFIED", ip: request.ip });
        await reply
          .status(200)
          .send({ message: "Email verified successfully" });
      } catch (err: unknown) {
        if (err instanceof AuthError) {
          await reply.status(err.statusCode).send({
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
    },
  );

  // ─── POST /api/v1/auth/resend-verification ──────────────

  app.post(
    "/api/v1/auth/resend-verification",
    { preHandler: [validateBody(resendVerificationSchema)] },
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const body = request.body as ResendVerificationInput;
      const token = await resendVerification(body.email);

      // Enqueue verification email (async)
      if (token && isFeatureEnabled("ENABLE_EMAIL")) {
        const config = getConfig();
        const emailData = verificationEmail(
          body.email,
          token,
          config.CORS_ORIGIN,
        );
        void enqueueEmail({ type: "verification", payload: emailData });
      }

      // Always return success to prevent user enumeration
      const responsePayload: Record<string, unknown> = {
        message:
          "If an unverified account exists, a verification email has been sent.",
      };

      if (process.env["NODE_ENV"] !== "production" && token) {
        responsePayload["verificationToken"] = token;
      }

      await reply.status(200).send(responsePayload);
    },
  );

  // ─── POST /api/v1/auth/forgot-password ──────────────────

  app.post(
    "/api/v1/auth/forgot-password",
    { preHandler: [validateBody(forgotPasswordSchema)] },
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      if (!isFeatureEnabled("ENABLE_PASSWORD_RESET")) {
        await reply.status(400).send({
          type: "https://api.taskmanagement.com/errors/feature-disabled",
          title: "Feature Disabled",
          status: 400,
          detail: "Password reset is currently disabled",
          instance: request.url,
        });
        return;
      }

      const body = request.body as ForgotPasswordInput;
      const token = await requestPasswordReset(body.email);
      audit({
        action: "AUTH_PASSWORD_RESET_REQUEST",
        ip: request.ip,
        userAgent: request.headers["user-agent"],
      });

      // Enqueue password reset email (async)
      if (token && isFeatureEnabled("ENABLE_EMAIL")) {
        const config = getConfig();
        const emailData = passwordResetEmail(
          body.email,
          token,
          config.CORS_ORIGIN,
        );
        void enqueueEmail({ type: "password-reset", payload: emailData });
      }

      // Always return success to prevent user enumeration
      const responsePayload: Record<string, unknown> = {
        message: "If an account exists, a password reset link has been sent.",
      };

      if (process.env["NODE_ENV"] !== "production" && token) {
        responsePayload["resetToken"] = token;
      }

      await reply.status(200).send(responsePayload);
    },
  );

  // ─── POST /api/v1/auth/reset-password ───────────────────

  app.post(
    "/api/v1/auth/reset-password",
    { preHandler: [validateBody(resetPasswordSchema)] },
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      if (!isFeatureEnabled("ENABLE_PASSWORD_RESET")) {
        await reply.status(400).send({
          type: "https://api.taskmanagement.com/errors/feature-disabled",
          title: "Feature Disabled",
          status: 400,
          detail: "Password reset is currently disabled",
          instance: request.url,
        });
        return;
      }

      try {
        const body = request.body as ResetPasswordInput;
        await resetPassword(body.token, body.password);
        clearAuthCookies(reply);
        audit({ action: "AUTH_PASSWORD_RESET_COMPLETE", ip: request.ip });
        await reply
          .status(200)
          .send({ message: "Password reset successful. Please log in." });
      } catch (err: unknown) {
        if (err instanceof AuthError) {
          await reply.status(err.statusCode).send({
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
    },
  );

  // ─── GET /api/v1/auth/me ────────────────────────────────

  app.get(
    "/api/v1/auth/me",
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      try {
        const profile = await getUserProfile(request.user!.sub);
        await reply.status(200).send({ user: profile });
      } catch (err: unknown) {
        if (err instanceof AuthError) {
          await reply.status(err.statusCode).send({
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
    },
  );

  // ─── PATCH /api/v1/auth/me ──────────────────────────────

  app.patch(
    "/api/v1/auth/me",
    { preHandler: [requireAuth, validateBody(updateProfileSchema)] },
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const body = request.body as UpdateProfileInput;
      const profile = await updateProfile(request.user!.sub, body);
      await reply.status(200).send({ user: profile });
    },
  );
}
