// dd-trace MUST be imported before anything else.
// Loaded via --require in production: node --require ./dist/lib/tracer.js dist/server.js

import tracer from "dd-trace";

const service = process.env["DD_SERVICE"] ?? "task-management-api";
const env = process.env["DD_ENV"] ?? process.env["NODE_ENV"] ?? "development";
const version = process.env["DD_VERSION"] ?? "0.0.1";
const agentHost = process.env["DD_AGENT_HOST"] ?? "localhost";
const agentPort = parseInt(process.env["DD_TRACE_AGENT_PORT"] ?? "8126", 10);

tracer.init({
  service,
  env,
  version,
  hostname: agentHost,
  port: agentPort,
  logInjection: true, // Injects dd.trace_id + dd.span_id into Pino logs
  runtimeMetrics: true,
  profiling: true,
  startupLogs: true,
  plugins: true, // Auto-instrument fastify, pg, ioredis, etc.
});

export default tracer;
