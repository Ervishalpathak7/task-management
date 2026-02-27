import jwt from "jsonwebtoken";
import { getConfig } from "../config/index.js";

export interface AccessTokenPayload {
  sub: string; // userId
  email: string;
  status: string;
  iat: number;
  exp: number;
}

export interface RefreshTokenClaims {
  sub: string; // userId
  tokenId: string; // RefreshToken.id
  family: string; // rotation family
  iat: number;
  exp: number;
}

export function signAccessToken(payload: {
  userId: string;
  email: string;
  status: string;
}): string {
  const config = getConfig();
  return jwt.sign(
    { sub: payload.userId, email: payload.email, status: payload.status },
    config.JWT_ACCESS_SECRET,
    { expiresIn: config.JWT_ACCESS_EXPIRY_SECONDS, algorithm: "HS256" },
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const config = getConfig();
  return jwt.verify(token, config.JWT_ACCESS_SECRET, {
    algorithms: ["HS256"],
  }) as AccessTokenPayload;
}

export function signRefreshToken(payload: {
  userId: string;
  tokenId: string;
  family: string;
}): string {
  const config = getConfig();
  return jwt.sign(
    { sub: payload.userId, tokenId: payload.tokenId, family: payload.family },
    config.JWT_REFRESH_SECRET,
    { expiresIn: config.JWT_REFRESH_EXPIRY_SECONDS, algorithm: "HS256" },
  );
}

export function verifyRefreshToken(token: string): RefreshTokenClaims {
  const config = getConfig();
  return jwt.verify(token, config.JWT_REFRESH_SECRET, {
    algorithms: ["HS256"],
  }) as RefreshTokenClaims;
}
