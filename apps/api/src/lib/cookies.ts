import type { FastifyReply } from "fastify";
import { getConfig } from "../config/index.js";

const ACCESS_TOKEN_COOKIE = "access_token";
const REFRESH_TOKEN_COOKIE = "refresh_token";

export function setAuthCookies(
  reply: FastifyReply,
  accessToken: string,
  refreshToken: string,
): void {
  const config = getConfig();

  void reply.setCookie(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure: config.COOKIE_SECURE,
    sameSite: "lax",
    domain: config.COOKIE_DOMAIN,
    path: "/",
    maxAge: config.JWT_ACCESS_EXPIRY_SECONDS,
  });

  void reply.setCookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    secure: config.COOKIE_SECURE,
    sameSite: "lax",
    domain: config.COOKIE_DOMAIN,
    path: "/api/v1/auth/refresh",
    maxAge: config.JWT_REFRESH_EXPIRY_SECONDS,
  });
}

export function clearAuthCookies(reply: FastifyReply): void {
  const config = getConfig();

  void reply.clearCookie(ACCESS_TOKEN_COOKIE, {
    httpOnly: true,
    secure: config.COOKIE_SECURE,
    sameSite: "lax",
    domain: config.COOKIE_DOMAIN,
    path: "/",
  });

  void reply.clearCookie(REFRESH_TOKEN_COOKIE, {
    httpOnly: true,
    secure: config.COOKIE_SECURE,
    sameSite: "lax",
    domain: config.COOKIE_DOMAIN,
    path: "/api/v1/auth/refresh",
  });
}

export function getAccessTokenFromCookie(
  cookies: Record<string, string | undefined>,
): string | undefined {
  return cookies[ACCESS_TOKEN_COOKIE];
}

export function getRefreshTokenFromCookie(
  cookies: Record<string, string | undefined>,
): string | undefined {
  return cookies[REFRESH_TOKEN_COOKIE];
}
