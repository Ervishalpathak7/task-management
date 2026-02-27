import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import { getConfig } from "./config/index.js";
import { getLogger } from "./lib/logger.js";
import { globalErrorHandler } from "./lib/error-handler.js";
import { healthCheckHandler } from "./routes/health.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerGroupRoutes } from "./routes/groups.js";
import { registerTaskRoutes } from "./routes/tasks.js";
import { registerRateLimiting } from "./middleware/rate-limit.js";

export async function buildApp(): Promise<FastifyInstance> {
  const config = getConfig();
  const logger = getLogger();

  const app = Fastify({
    logger: false,
    requestTimeout: 30_000,
    bodyLimit: 1_048_576, // 1 MB
    trustProxy: true, // Required for rate limiting behind proxy
  });

  // ─── Security Headers (Helmet) ─────────────────────────

  await app.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // Swagger UI needs inline scripts
        styleSrc: ["'self'", "'unsafe-inline'"], // Swagger UI needs inline styles
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    crossOriginEmbedderPolicy: false, // Swagger UI compatibility
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    noSniff: true,
    xssFilter: true,
    hidePoweredBy: true,
  });

  // ─── Plugins ────────────────────────────────────────────

  await app.register(fastifyCookie);

  await app.register(fastifyCors, {
    origin: config.CORS_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Origin"],
    maxAge: 600, // Preflight cache: 10 minutes
  });

  // ─── Rate Limiting (Redis-backed) ──────────────────────

  await registerRateLimiting(app);

  // ─── Swagger ────────────────────────────────────────────

  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: "Task Management API",
        version: "1.0.0",
        description: "Production-grade Task Management SaaS API",
      },
      servers: [
        {
          url: `http://localhost:${String(config.PORT)}`,
          description: "Local development",
        },
      ],
      components: {
        securitySchemes: {
          cookieAuth: {
            type: "apiKey",
            in: "cookie",
            name: "access_token",
          },
        },
      },
    },
  });

  await app.register(fastifySwaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
    },
  });

  // ─── Global error handler ───────────────────────────────

  app.setErrorHandler(globalErrorHandler);

  // ─── Origin validation for mutating requests ────────────

  app.addHook("onRequest", async (request, reply) => {
    const method = request.method.toUpperCase();
    if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
      return;
    }

    const origin = request.headers["origin"];
    if (origin && origin !== config.CORS_ORIGIN) {
      logger.warn(
        { origin, url: request.url, ip: request.ip },
        "Origin header mismatch on mutating request",
      );
      await reply.status(403).send({
        type: "https://api.taskmanagement.com/errors/origin-mismatch",
        title: "Forbidden",
        status: 403,
        detail: "Origin header validation failed",
        instance: request.url,
      });
    }
  });

  // ─── Request logging with tracing ──────────────────────

  app.addHook("onRequest", (request, _reply, done) => {
    logger.info(
      {
        requestId: request.id,
        method: request.method,
        url: request.url,
        ip: request.ip,
      },
      "Incoming request",
    );
    done();
  });

  app.addHook("onResponse", async (request, reply) => {
    const responseTime = reply.elapsedTime;
    const logLevel = responseTime > 500 ? "warn" : "info";

    logger[logLevel](
      {
        requestId: request.id,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTime: Math.round(responseTime),
      },
      responseTime > 500 ? "Slow request" : "Request completed",
    );
  });

  // ─── Routes ─────────────────────────────────────────────

  // Health check (no auth)
  app.get("/api/v1/health", healthCheckHandler);

  // Root
  app.get("/", async (_request, reply) => {
    await reply.send({
      service: "task-management-api",
      version: "0.0.1",
      env: config.NODE_ENV,
    });
  });

  // Auth routes
  registerAuthRoutes(app);

  // Group routes
  registerGroupRoutes(app);

  // Task routes
  registerTaskRoutes(app);

  // Generate Swagger spec after routes are registered
  await app.ready();

  return app;
}
