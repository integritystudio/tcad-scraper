import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

/**
 * Create a PrismaClient bound to Cloudflare Hyperdrive.
 * Must be called per-request — Workers are stateless,
 * and Hyperdrive handles connection pooling.
 */
export function createPrisma(hyperdrive: Hyperdrive): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: hyperdrive.connectionString,
  });
  return new PrismaClient({ adapter });
}
