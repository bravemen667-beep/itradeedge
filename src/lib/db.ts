import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL || "";

// Surface a clear warning when DATABASE_URL is missing instead of letting the
// first Prisma query fail with a cryptic adapter error. We do not throw at
// module load because that would break `next build` in environments without
// the env var (the schema/types are still needed to compile).
if (!connectionString) {
  console.error(
    "[db] DATABASE_URL is not set — Prisma queries will fail at runtime until it is configured"
  );
}

const globalForPrisma = globalThis as unknown as { prisma: InstanceType<typeof PrismaClient> };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
