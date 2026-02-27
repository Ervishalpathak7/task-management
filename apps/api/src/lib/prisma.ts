import { PrismaClient } from "@prisma/client";
import { getLogger } from "./logger.js";

let _prisma: PrismaClient | undefined;

export function createPrismaClient(): PrismaClient {
  const logger = getLogger();

  _prisma = new PrismaClient({
    log: [
      { emit: "stdout", level: "error" },
      { emit: "stdout", level: "warn" },
    ],
  });

  _prisma
    .$connect()
    .then(() => logger.info("Prisma connected"))
    .catch((err: unknown) => logger.error({ err }, "Prisma connection failed"));

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
