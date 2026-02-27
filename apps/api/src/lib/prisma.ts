import { PrismaClient } from "@prisma/client";
import { getConfig } from "../config/index.js";
import { getLogger } from "./logger.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

let _prisma: PrismaClient | undefined;

export function createPrismaClient(): PrismaClient {
  const config = getConfig();
  const logger = getLogger();
  const pool = new Pool({
    connectionString: config.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  const adapter = new PrismaPg(pool);

  _prisma = new PrismaClient({
    adapter,
    log: [
      { emit: "stdout", level: "error" },
      { emit: "stdout", level: "warn" },
    ],
  });

  _prisma
    .$connect()
    .then(() => {
      logger.info("Prisma connected");
    })
    .catch((err: unknown) => {
      logger.error({ err }, "Prisma connection failed");
    });

  return _prisma;
}

export function getPrismaClient(): PrismaClient {
  if (!_prisma) {
    throw new Error(
      "Prisma client not initialized. Call createPrismaClient() first.",
    );
  }
  return _prisma;
}

export async function disconnectPrisma(): Promise<void> {
  if (_prisma) {
    await _prisma.$disconnect();
    _prisma = undefined;
  }
}
