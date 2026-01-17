import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function makePrismaClient() {
  const direct = process.env.DIRECT_URL;
  if (!direct) throw new Error("DIRECT_URL is not set");

  // Neon driver needs ws in Node runtime
  neonConfig.webSocketConstructor = ws as unknown as typeof WebSocket;

  const adapter = new PrismaNeon({ connectionString: direct });

  return new PrismaClient({
    adapter,
    log: ["error", "warn"],
  });
}

export const prisma = globalForPrisma.prisma ?? makePrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
